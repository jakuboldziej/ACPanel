import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "../../config.js";
import { HttpError } from "../../core/fsutil.js";
import { extractArchive, listArchive } from "./archive.js";
import { detectItems } from "./detect.js";
import { expandNestedArchives } from "./nested.js";
import { UPLOAD_ID, archivePath, extractDir, freeBytes, loadMeta, saveMeta, uploadDir, view } from "./store.js";
import { ALLOWED_EXT, CHUNK_SIZE, type UploadMeta, type UploadView } from "./types.js";

const STALE_MS = 12 * 60 * 60 * 1000;

export async function createUpload(fileName: string, size: number): Promise<UploadView & { chunkSize: number }> {
  const base = path.basename(fileName.replace(/\\/g, "/"));
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new HttpError(400, "Only .zip, .rar and .7z files are supported");
  if (size <= 0) throw new HttpError(400, "Empty file");
  if (size > config.maxUploadMb * 1024 * 1024) throw new HttpError(400, `File is larger than ${config.maxUploadMb} MB`);

  await fs.mkdir(config.uploadsDir, { recursive: true });
  const free = await freeBytes(config.uploadsDir);
  if (free < size * 3) {
    throw new HttpError(507, `Not enough disk space: ${(free / 1024 ** 3).toFixed(1)} GB free, need about ${((size * 3) / 1024 ** 3).toFixed(1)} GB`);
  }

  const meta: UploadMeta = {
    id: crypto.randomUUID(),
    fileName: base,
    size,
    chunks: Math.ceil(size / CHUNK_SIZE),
    received: [],
    status: "uploading",
    error: null,
    items: [],
    progress: null,
    createdAt: Date.now(),
  };
  await fs.mkdir(uploadDir(meta.id), { recursive: true });
  const handle = await fs.open(archivePath(meta), "w");
  await handle.truncate(size);
  await handle.close();
  await saveMeta(meta);
  return { ...view(meta), chunkSize: CHUNK_SIZE };
}

export async function writeChunk(id: string, index: number, body: Readable): Promise<UploadView> {
  const meta = await loadMeta(id);
  if (meta.status !== "uploading") throw new HttpError(409, `Upload is ${meta.status}`);
  if (!Number.isInteger(index) || index < 0 || index >= meta.chunks) throw new HttpError(400, "Invalid chunk index");

  const start = index * CHUNK_SIZE;
  const expected = Math.min(CHUNK_SIZE, meta.size - start);
  let written = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length;
      if (written > expected) cb(new HttpError(400, "Chunk is larger than expected"));
      else cb(null, chunk);
    },
  });
  await pipeline(body, limiter, createWriteStream(archivePath(meta), { flags: "r+", start }));
  if (written !== expected) throw new HttpError(400, `Chunk ${index} is incomplete (${written}/${expected} bytes)`);

  const fresh = await loadMeta(id);
  if (!fresh.received.includes(index)) fresh.received.push(index);
  await saveMeta(fresh);
  return view(fresh);
}

export async function completeUpload(id: string): Promise<UploadView> {
  const meta = await loadMeta(id);
  if (meta.status !== "uploading") throw new HttpError(409, `Upload is ${meta.status}`);
  if (meta.received.length !== meta.chunks) {
    throw new HttpError(400, `Missing chunks: received ${meta.received.length} of ${meta.chunks}`);
  }
  meta.status = "extracting";
  await saveMeta(meta);
  void processUpload(meta);
  return view(meta);
}

async function processUpload(meta: UploadMeta): Promise<void> {
  try {
    const listing = await listArchive(archivePath(meta));
    const free = await freeBytes(config.uploadsDir);
    if (free < listing.unpackedBytes * 1.2) {
      throw new HttpError(507, `Not enough disk space to extract (${(listing.unpackedBytes / 1024 ** 3).toFixed(1)} GB needed)`);
    }
    await extractArchive(archivePath(meta), extractDir(meta.id));
    await fs.rm(archivePath(meta), { force: true });
    await expandNestedArchives(extractDir(meta.id), {
      budgetBytes: config.maxExtractMb * 1024 * 1024 - listing.unpackedBytes,
      freeBytes: () => freeBytes(config.uploadsDir),
      onProgress: async (done, total) => {
        meta.progress = `Unpacking nested archives ${done + 1}/${total}`;
        await saveMeta(meta);
      },
    });
    meta.progress = "Scanning for cars and tracks";
    await saveMeta(meta);
    meta.items = await detectItems(extractDir(meta.id), meta.fileName);
    meta.progress = null;
    meta.status = "ready";
    if (meta.items.length === 0) {
      meta.status = "failed";
      meta.error = "No cars or tracks found in the archive";
    }
  } catch (e) {
    meta.status = "failed";
    meta.error = (e as Error).message;
  }
  if (meta.status === "failed") {
    meta.progress = null;
    await fs.rm(archivePath(meta), { force: true }).catch(() => {});
    await fs.rm(extractDir(meta.id), { recursive: true, force: true }).catch(() => {});
  }
  await saveMeta(meta).catch(() => {});
}

export function uploadSettings() {
  return {
    chunkSize: CHUNK_SIZE,
    maxUploadMb: config.maxUploadMb,
    lanUrl: config.lanUrl || null,
    extensions: [...ALLOWED_EXT],
  };
}

export async function listUploads(): Promise<UploadView[]> {
  const entries = await fs.readdir(config.uploadsDir, { withFileTypes: true }).catch(() => []);
  const metas = await Promise.all(
    entries.filter((e) => e.isDirectory() && UPLOAD_ID.test(e.name)).map((e) => loadMeta(e.name).catch(() => null)),
  );
  return metas
    .filter((m): m is UploadMeta => m !== null && m.status !== "uploading")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(view);
}

export async function getUpload(id: string): Promise<UploadView> {
  return view(await loadMeta(id));
}

export async function deleteUpload(id: string): Promise<void> {
  const meta = await loadMeta(id);
  if (meta.status === "extracting" || meta.status === "installing") throw new HttpError(409, `Upload is ${meta.status}`);
  await fs.rm(uploadDir(id), { recursive: true, force: true });
}

export async function cleanupStaleUploads(): Promise<void> {
  const entries = await fs.readdir(config.uploadsDir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isDirectory() || !UPLOAD_ID.test(e.name)) continue;
    const dir = path.join(config.uploadsDir, e.name);
    const meta = await loadMeta(e.name).catch(() => null);
    const stat = await fs.stat(dir);
    const age = Date.now() - (meta?.createdAt ?? stat.mtimeMs);
    const stuck = meta && (meta.status === "extracting" || meta.status === "installing");
    if (age > STALE_MS || (!meta && age > 60 * 60 * 1000) || (stuck && age > STALE_MS)) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export async function markInterruptedUploads(): Promise<void> {
  const entries = await fs.readdir(config.uploadsDir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isDirectory() || !UPLOAD_ID.test(e.name)) continue;
    const meta = await loadMeta(e.name).catch(() => null);
    if (meta && (meta.status === "extracting" || meta.status === "installing")) {
      meta.status = "failed";
      meta.error = "Interrupted by a panel restart";
      await saveMeta(meta).catch(() => {});
    }
  }
}
