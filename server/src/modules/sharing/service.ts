import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { HttpError, exists, writeAtomic } from "../../core/fsutil.js";
import { writeFolderZip } from "../../core/zip.js";
import { carDir } from "../cars/service.js";
import { getCurrentTrack, trackDir } from "../tracks/service.js";
import { readServerCfg } from "../../core/serverCfg.js";

export type ContentKind = "cars" | "tracks";
type Status = "building" | "ready" | "error";

interface SharedStore {
  cars: string[];
  tracks: string[];
}

export interface SharedItem {
  kind: ContentKind;
  id: string;
  status: Status;
  version: string | null;
  sizeBytes: number | null;
  error: string | null;
}

const builds = new Map<string, { status: Status; version: string | null; error: string | null }>();
const key = (kind: ContentKind, id: string) => `${kind}:${id}`;

async function readStore(): Promise<SharedStore> {
  try {
    const s = JSON.parse(await fs.readFile(config.sharedContent, "utf8")) as Partial<SharedStore>;
    return { cars: s.cars ?? [], tracks: s.tracks ?? [] };
  } catch {
    return { cars: [], tracks: [] };
  }
}

async function writeStore(store: SharedStore): Promise<void> {
  await fs.mkdir(path.dirname(config.sharedContent), { recursive: true });
  await writeAtomic(config.sharedContent, JSON.stringify(store, null, 2) + "\n");
}

function folderOf(kind: ContentKind, id: string): Promise<string> {
  return kind === "cars" ? carDir(id) : trackDir(id);
}

async function folderVersion(dir: string): Promise<string> {
  const hash = crypto.createHash("sha1");
  const stack = [dir];
  const entries: string[] = [];
  while (stack.length) {
    const d = stack.pop()!;
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) {
        const st = await fs.stat(full);
        entries.push(`${path.relative(dir, full)}|${st.size}|${Math.floor(st.mtimeMs)}`);
      }
    }
  }
  for (const e of entries.sort()) hash.update(e + "\n");
  return hash.digest("hex").slice(0, 10);
}

function cacheFile(kind: ContentKind, id: string, version: string): string {
  return path.join(config.contentCacheDir, kind, `${id}-${version}.zip`);
}

async function removeOldVersions(kind: ContentKind, id: string, keep: string | null): Promise<void> {
  const dir = path.join(config.contentCacheDir, kind);
  for (const f of await fs.readdir(dir).catch(() => [] as string[])) {
    if (f.startsWith(`${id}-`) && f.endsWith(".zip") && f !== (keep && path.basename(keep))) {
      await fs.rm(path.join(dir, f), { force: true });
    }
  }
}

async function build(kind: ContentKind, id: string): Promise<void> {
  const k = key(kind, id);
  if (builds.get(k)?.status === "building") return;
  builds.set(k, { status: "building", version: null, error: null });
  try {
    const dir = await folderOf(kind, id);
    const version = await folderVersion(dir);
    const file = cacheFile(kind, id, version);
    if (!(await exists(file))) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await writeFolderZip(dir, id, file);
    }
    await removeOldVersions(kind, id, file);
    builds.set(k, { status: "ready", version, error: null });
  } catch (e) {
    builds.set(k, { status: "error", version: null, error: (e as Error).message });
  }
  await syncCmContent().catch((e: Error) => console.error("cm_content sync failed:", e.message));
}

async function describe(kind: ContentKind, id: string): Promise<SharedItem> {
  const b = builds.get(key(kind, id));
  const file = b?.version ? cacheFile(kind, id, b.version) : null;
  const sizeBytes = file ? await fs.stat(file).then((s) => s.size, () => null) : null;
  return { kind, id, status: b?.status ?? "building", version: b?.version ?? null, sizeBytes, error: b?.error ?? null };
}

export async function sharingState(): Promise<{ publicUrl: string | null; items: SharedItem[] }> {
  const store = await readStore();
  const items = await Promise.all([
    ...store.cars.map((id) => describe("cars", id)),
    ...store.tracks.map((id) => describe("tracks", id)),
  ]);
  return { publicUrl: config.publicUrl || null, items };
}

export async function setShared(kind: ContentKind, id: string, shared: boolean): Promise<void> {
  if (shared && !config.publicUrl) throw new HttpError(409, "Set PUBLIC_URL in .env to share downloads");
  if (shared) await folderOf(kind, id);
  const store = await readStore();
  const list = new Set(store[kind]);
  if (shared) list.add(id);
  else list.delete(id);
  store[kind] = [...list].sort();
  await writeStore(store);
  if (shared) {
    void build(kind, id);
  } else {
    builds.delete(key(kind, id));
    await removeOldVersions(kind, id, null);
    await syncCmContent();
  }
}

export async function refreshIfShared(kind: ContentKind, id: string): Promise<void> {
  const store = await readStore();
  if (store[kind].includes(id)) void build(kind, id);
}

export async function forgetShared(kind: ContentKind, id: string): Promise<void> {
  const store = await readStore();
  if (!store[kind].includes(id)) return;
  await setShared(kind, id, false);
}

export async function publicDownload(kind: ContentKind, id: string): Promise<string> {
  const store = await readStore();
  const b = builds.get(key(kind, id));
  if (!store[kind].includes(id) || b?.status !== "ready" || !b.version) throw new HttpError(404, "Not available");
  return cacheFile(kind, id, b.version);
}

function downloadUrl(kind: ContentKind, id: string, version: string): string {
  return `${config.publicUrl}/api/public/content/${kind}/${encodeURIComponent(id)}.zip?v=${version}`;
}

export async function syncCmContent(): Promise<void> {
  const store = await readStore();
  const cars: Record<string, { url: string; version: string; direct: true }> = {};
  for (const id of store.cars) {
    const b = builds.get(key("cars", id));
    if (b?.status === "ready" && b.version) cars[id] = { url: downloadUrl("cars", id, b.version), version: b.version, direct: true };
  }
  const current = await getCurrentTrack(await readServerCfg()).catch(() => null);
  const tb = current ? builds.get(key("tracks", current.track)) : undefined;
  const track =
    current && store.tracks.includes(current.track) && tb?.status === "ready" && tb.version
      ? { url: downloadUrl("tracks", current.track, tb.version), version: tb.version, direct: true }
      : null;

  const file = path.join(config.cfgDir, "cm_content", "content.json");
  if (!config.publicUrl || (Object.keys(cars).length === 0 && !track)) {
    await fs.rm(file, { force: true });
    return;
  }
  const body = JSON.stringify(track ? { cars, track } : { cars }, null, 2) + "\n";
  const previous = await fs.readFile(file, "utf8").catch(() => null);
  if (previous === body) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await writeAtomic(file, body);
}

export async function resumeSharing(): Promise<void> {
  const store = await readStore();
  await Promise.all([...store.cars.map((id) => build("cars", id)), ...store.tracks.map((id) => build("tracks", id))]);
  await syncCmContent();
}

