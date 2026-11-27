import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { HttpError, exists, isEmptyDir, moveDir } from "../../core/fsutil.js";
import { findCarImage } from "../../core/preview.js";
import { dirSize } from "./archive.js";
import { existingState } from "./detect.js";
import { extractDir, loadMeta, saveMeta, uploadDir } from "./store.js";
import type { InstallRequest, InstallResult } from "./types.js";

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
