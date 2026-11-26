import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";
import { config } from "../config.js";
import { dirSize, extractArchive, listArchive } from "./archive.js";
import { findCarImage, trackImagePath, type ImageKind } from "./preview.js";
import { readUiJson } from "./uiMeta.js";
import { HttpError, SAFE_NAME, exists, isEmptyDir, moveDir } from "./fsutil.js";

export const CHUNK_SIZE = 32 * 1024 * 1024;
const ALLOWED_EXT = new Set([".zip", ".rar", ".7z"]);
const UPLOAD_ID = /^[0-9a-f-]{36}$/;
const STALE_MS = 12 * 60 * 60 * 1000;

export type UploadStatus = "uploading" | "extracting" | "ready" | "installing" | "installed" | "failed";
export type ItemKind = "car" | "track";
export type ExistingState = "enabled" | "disabled" | "installed" | null;

export interface ModItem {
  key: string;
  kind: ItemKind;
  id: string;
  name: string;
  relPath: string;
  sizeBytes: number;
  existing: ExistingState;
  validId: boolean;
  image: ImageKind | null;
  warnings: string[];
}

interface UploadMeta {
  id: string;
  fileName: string;
  size: number;
  chunks: number;
  received: number[];
  status: UploadStatus;
  error: string | null;
  items: ModItem[];
  createdAt: number;
}

export type UploadView = Omit<UploadMeta, "received"> & { receivedChunks: number };

const uploadDir = (id: string) => path.join(config.uploadsDir, id);
const archivePath = (meta: UploadMeta) => path.join(uploadDir(meta.id), `archive${path.extname(meta.fileName).toLowerCase()}`);
const extractDir = (id: string) => path.join(uploadDir(id), "extracted");

function view(meta: UploadMeta): UploadView {
  const { received, ...rest } = meta;
  return { ...rest, receivedChunks: received.length };
}

async function saveMeta(meta: UploadMeta): Promise<void> {
  const file = path.join(uploadDir(meta.id), "meta.json");
  await fs.writeFile(`${file}.tmp`, JSON.stringify(meta));
  await fs.rename(`${file}.tmp`, file);
}

async function loadMeta(id: string): Promise<UploadMeta> {
  if (!UPLOAD_ID.test(id)) throw new HttpError(400, "Invalid upload id");
  try {
    return JSON.parse(await fs.readFile(path.join(uploadDir(id), "meta.json"), "utf8")) as UploadMeta;
  } catch {
    throw new HttpError(404, "Upload not found (it may have expired)");
  }
}

async function freeBytes(dir: string): Promise<number> {
  const s = await fs.statfs(dir);
  return s.bavail * s.bsize;
}

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
    meta.items = await detectItems(extractDir(meta.id), meta.fileName);
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
    await fs.rm(archivePath(meta), { force: true }).catch(() => {});
    await fs.rm(extractDir(meta.id), { recursive: true, force: true }).catch(() => {});
  }
  await saveMeta(meta).catch(() => {});
}

async function isCarDir(dir: string): Promise<boolean> {
  return (await exists(path.join(dir, "data.acd"))) || (await exists(path.join(dir, "data", "car.ini")));
}

async function isTrackDir(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && /^models.*\.ini$/i.test(e.name))) return true;
  if (await exists(path.join(dir, "data", "surfaces.ini"))) return true;
  for (const e of entries) {
    if (e.isDirectory() && (await exists(path.join(dir, e.name, "data", "surfaces.ini")))) return true;
  }
  return false;
}

async function existingState(kind: ItemKind, id: string): Promise<ExistingState> {
  const full = async (dir: string) => (await exists(dir)) && !(await isEmptyDir(dir));
  if (kind === "car") {
    if (await full(path.join(config.carsDir, id))) return "enabled";
    if (await full(path.join(config.carsOffDir, id))) return "disabled";
    return null;
  }
  return (await full(path.join(config.tracksDir, id))) ? "installed" : null;
}

async function itemName(dir: string, kind: ItemKind, id: string): Promise<string> {
  const ui = await readUiJson(path.join(dir, "ui", kind === "car" ? "ui_car.json" : "ui_track.json"));
  return typeof ui?.name === "string" && ui.name.trim() ? ui.name.trim() : id;
}

async function itemWarnings(dir: string, kind: ItemKind): Promise<string[]> {
  const out: string[] = [];
  if (kind === "car" && !(await exists(path.join(dir, "data.acd"))) && (await exists(path.join(dir, "data")))) {
    out.push("No data.acd, only an unpacked data/ folder: the server cannot verify the car physics");
  }
  return out;
}

async function firstTrackPreview(dir: string): Promise<string | null> {
  const root = trackImagePath(dir, "", "preview");
  if (await exists(root)) return root;
  const layouts = (await fs.readdir(path.join(dir, "ui"), { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
  for (const l of layouts) {
    const file = trackImagePath(dir, l, "preview");
    if (await exists(file)) return file;
  }
  return null;
}

async function itemImage(dir: string, kind: ItemKind): Promise<{ file: string; kind: ImageKind } | null> {
  if (kind === "car") return findCarImage(dir);
  const file = await firstTrackPreview(dir);
  return file ? { file, kind: "preview" } : null;
}

export async function uploadItemImage(id: string, index: number): Promise<{ file: string; root: string }> {
  const meta = await loadMeta(id);
  if (meta.status !== "ready") throw new HttpError(404, "No image");
  const item = meta.items[index];
  if (!item) throw new HttpError(404, "No image");
  const dir = item.relPath ? path.join(extractDir(id), item.relPath) : extractDir(id);
  const image = await itemImage(dir, item.kind);
  if (!image) throw new HttpError(404, "No image");
  return { file: image.file, root: extractDir(id) };
}

async function detectItems(root: string, archiveName: string): Promise<ModItem[]> {
  const items: ModItem[] = [];
  const stem = path.basename(archiveName, path.extname(archiveName)).replace(/[^A-Za-z0-9_.-]/g, "_");

  async function visit(dir: string, depth: number): Promise<void> {
    const kind: ItemKind | null = (await isCarDir(dir)) ? "car" : (await isTrackDir(dir)) ? "track" : null;
    if (kind) {
      const relPath = path.relative(root, dir);
      const id = relPath ? path.basename(dir) : stem;
      const validId = SAFE_NAME.test(id) && !id.includes("..");
      items.push({
        key: relPath || ".",
        kind,
        id,
        name: await itemName(dir, kind, id),
        relPath,
        sizeBytes: await dirSize(dir),
        existing: validId ? await existingState(kind, id) : null,
        validId,
        image: await itemImage(dir, kind).then((i) => i?.kind ?? null),
        warnings: await itemWarnings(dir, kind),
      });
      return;
    }
    if (depth >= 6) return;
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith("__MACOSX")) await visit(path.join(dir, e.name), depth + 1);
    }
  }

  await visit(root, 0);
  return items.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
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

const SLIM_DIRS = new Set(["skins", "texture", "sfx", "animations"]);

async function slimSkins(skinsDir: string, keep: string | null): Promise<void> {
  for (const e of await fs.readdir(skinsDir, { withFileTypes: true })) {
    const full = path.join(skinsDir, e.name);
    if (!keep || !keep.startsWith(full + path.sep)) {
      await fs.rm(full, { recursive: true, force: true });
      continue;
    }
    for (const f of await fs.readdir(full, { withFileTypes: true })) {
      const file = path.join(full, f.name);
      if (file !== keep) await fs.rm(file, { recursive: true, force: true });
    }
  }
}

async function slimCar(dir: string): Promise<number> {
  const before = await dirSize(dir);
  const preview = await findCarImage(dir);
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name.toLowerCase() === "skins") {
      await slimSkins(full, preview?.kind === "preview" ? preview.file : null);
      continue;
    }
    if (e.isDirectory() && SLIM_DIRS.has(e.name.toLowerCase())) await fs.rm(full, { recursive: true, force: true });
    if (e.isFile() && /\.(kn5|fbx|pdf)$/i.test(e.name) && e.name.toLowerCase() !== "collider.kn5") await fs.rm(full, { force: true });
  }
  return before - (await dirSize(dir));
}

async function removeEmptyPlaceholder(dir: string): Promise<void> {
  if ((await exists(dir)) && (await isEmptyDir(dir))) await fs.rmdir(dir);
}

export interface InstallRequest {
  key: string;
  overwrite: boolean;
}

export interface InstallResult {
  key: string;
  kind: ItemKind;
  id: string;
  target: string;
  replacedBackup: string | null;
  slimmedBytes: number;
}

export async function installUpload(id: string, requests: InstallRequest[], slim: boolean): Promise<{ installed: InstallResult[] }> {
  const meta = await loadMeta(id);
  if (meta.status !== "ready") throw new HttpError(409, `Upload is ${meta.status}`);
  if (requests.length === 0) throw new HttpError(400, "Nothing selected");

  const byKey = new Map(meta.items.map((i) => [i.key, i]));
  const plan = requests.map((r) => {
    const item = byKey.get(r.key);
    if (!item) throw new HttpError(400, `Unknown item: ${r.key}`);
    if (!item.validId) throw new HttpError(400, `Folder name "${item.id}" is not allowed`);
    return { item, overwrite: r.overwrite };
  });
  const ids = plan.map((p) => `${p.item.kind}:${p.item.id}`);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "Two selected items have the same folder name");

  for (const { item, overwrite } of plan) {
    const state = await existingState(item.kind, item.id);
    if (state && !overwrite) throw new HttpError(409, `${item.kind} ${item.id} already exists, confirm overwrite`);
  }

  meta.status = "installing";
  await saveMeta(meta);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const installed: InstallResult[] = [];
  try {
    for (const { item } of plan) {
      const src = item.relPath ? path.join(extractDir(id), item.relPath) : extractDir(id);
      const state = await existingState(item.kind, item.id);
      const parent = item.kind === "track" ? config.tracksDir : state === "enabled" ? config.carsDir : config.carsOffDir;
      const target = path.join(parent, item.id);

      let replacedBackup: string | null = null;
      if (state) {
        const backupParent = path.join(config.backupsDir, stamp, "content", path.basename(parent));
        await fs.mkdir(backupParent, { recursive: true });
        replacedBackup = path.join(backupParent, item.id);
        await moveDir(target, replacedBackup);
      }
      if (item.kind === "car") {
        await removeEmptyPlaceholder(path.join(config.carsDir, item.id));
        await removeEmptyPlaceholder(path.join(config.carsOffDir, item.id));
      } else {
        await removeEmptyPlaceholder(target);
      }

      const slimmedBytes = slim && item.kind === "car" ? await slimCar(src) : 0;
      await fs.mkdir(parent, { recursive: true });
      await moveDir(src, target);
      installed.push({ key: item.key, kind: item.kind, id: item.id, target, replacedBackup, slimmedBytes });
    }
  } catch (e) {
    meta.status = "failed";
    meta.error = `Install stopped: ${(e as Error).message}. Installed so far: ${installed.map((i) => i.id).join(", ") || "none"}`;
    await saveMeta(meta);
    throw new HttpError(500, meta.error);
  }

  await fs.rm(uploadDir(id), { recursive: true, force: true });
  return { installed };
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
