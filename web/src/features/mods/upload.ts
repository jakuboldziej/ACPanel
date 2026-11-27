import { modsApi, uploadChunk, type UploadSettings, type UploadView } from "./api";
import type { Job } from "./types";

const MAX_RETRIES = 3;
const POLL_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fromServer(u: UploadView): Job {
  return {
    localId: u.id,
    file: null,
    fileName: u.fileName,
    size: u.size,
    phase: u.status === "failed" ? "error" : "server",
    uploaded: u.size,
    upload: u,
    error: u.error,
    installed: null,
  };
}

function validate(file: File, settings: UploadSettings): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!settings.extensions.includes(ext)) return `Unsupported file type (${settings.extensions.join(", ")})`;
  if (file.size > settings.maxUploadMb * 1024 * 1024) return `File is larger than ${settings.maxUploadMb} MB`;
  return null;
}

export function newJob(file: File, settings: UploadSettings): Job {
  const error = validate(file, settings);
  return {
    localId: crypto.randomUUID(),
    file,
    fileName: file.name,
    size: file.size,
    phase: error ? "error" : "queued",
    uploaded: 0,
    upload: null,
    error,
    installed: null,
  };
}

async function withRetries<T>(action: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await action();
    } catch (e) {
      if ((e as Error).name === "AbortError" || attempt >= MAX_RETRIES) throw e;
      await sleep(1000 * attempt);
    }
  }
}

export async function uploadFile(
  file: File,
  signal: AbortSignal,
  onCreated: (u: UploadView) => void,
  onProgress: (bytes: number) => void,
): Promise<UploadView> {
  const created = await modsApi.create(file.name, file.size);
  onCreated(created);
  for (let index = 0; index < created.chunks; index++) {
    const start = index * created.chunkSize;
    const blob = file.slice(start, Math.min(start + created.chunkSize, file.size));
    await withRetries(() => uploadChunk(created.id, index, blob, (loaded) => onProgress(start + loaded), signal));
  }
  return modsApi.complete(created.id);
}

export async function waitUntilProcessed(id: string, onUpdate: (u: UploadView) => void): Promise<UploadView> {
  for (;;) {
    const u = await modsApi.get(id);
    onUpdate(u);
    if (u.status !== "extracting") return u;
    await sleep(POLL_MS);
  }
}
