import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { HttpError, SAFE_NAME, exists, isEmptyDir } from "../../core/fsutil.js";
import { findCarImage, trackImagePath, type ImageKind } from "../../core/preview.js";
import { readUiJson } from "../../core/uiMeta.js";
import { dirSize } from "./archive.js";
import { extractDir, loadMeta } from "./store.js";
import type { ExistingState, ItemKind, ModItem } from "./types.js";

export async function isCarDir(dir: string): Promise<boolean> {
  return (await exists(path.join(dir, "data.acd"))) || (await exists(path.join(dir, "data", "car.ini")));
}

export async function isTrackDir(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && /^models.*\.ini$/i.test(e.name))) return true;
  if (await exists(path.join(dir, "data", "surfaces.ini"))) return true;
  for (const e of entries) {
    if (e.isDirectory() && (await exists(path.join(dir, e.name, "data", "surfaces.ini")))) return true;
  }
  return false;
}

export async function existingState(kind: ItemKind, id: string): Promise<ExistingState> {
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

export async function detectItems(root: string, archiveName: string): Promise<ModItem[]> {
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
        duplicate: false,
        source: relPath.includes(path.sep) ? relPath.split(path.sep).slice(0, -1).join("/") : null,
      });
      return;
    }
    if (depth >= 6) return;
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith("__MACOSX")) await visit(path.join(dir, e.name), depth + 1);
    }
  }

  await visit(root, 0);
  items.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || a.relPath.localeCompare(b.relPath));
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) {
      item.duplicate = true;
      item.warnings.push("The same folder name appears more than once in this upload, only one copy can be installed");
    }
    seen.add(key);
  }
  return items;
}
