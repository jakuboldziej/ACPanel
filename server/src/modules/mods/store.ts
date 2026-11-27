import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { HttpError } from "../../core/fsutil.js";
import type { UploadMeta, UploadView } from "./types.js";

export const UPLOAD_ID = /^[0-9a-f-]{36}$/;

export const uploadDir = (id: string) => path.join(config.uploadsDir, id);

export const archivePath = (meta: UploadMeta) => path.join(uploadDir(meta.id), `archive${path.extname(meta.fileName).toLowerCase()}`);
export const extractDir = (id: string) => path.join(uploadDir(id), "extracted");

export function view(meta: UploadMeta): UploadView {
  const { received, ...rest } = meta;
  return { ...rest, receivedChunks: received.length };
}

export async function saveMeta(meta: UploadMeta): Promise<void> {
  const file = path.join(uploadDir(meta.id), "meta.json");
  await fs.writeFile(`${file}.tmp`, JSON.stringify(meta));
  await fs.rename(`${file}.tmp`, file);
}

export async function loadMeta(id: string): Promise<UploadMeta> {
  if (!UPLOAD_ID.test(id)) throw new HttpError(400, "Invalid upload id");
  try {
    return JSON.parse(await fs.readFile(path.join(uploadDir(id), "meta.json"), "utf8")) as UploadMeta;
  } catch {
    throw new HttpError(404, "Upload not found (it may have expired)");
  }
}

export async function freeBytes(dir: string): Promise<number> {
  const s = await fs.statfs(dir);
  return s.bavail * s.bsize;
}
