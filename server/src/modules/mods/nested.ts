import fs from "node:fs/promises";
import path from "node:path";
import { HttpError, exists } from "../../core/fsutil.js";
import { assertSafeTree, extractArchive, listArchive } from "./archive.js";
import { isCarDir, isTrackDir } from "./detect.js";

const ARCHIVE = /\.(zip|rar|7z)$/i;
const MAX_DEPTH = 2;
const MAX_ARCHIVES = 200;

export interface NestedOptions {
  budgetBytes: number;
  freeBytes: () => Promise<number>;
  onProgress: (done: number, total: number) => Promise<void> | void;
}

async function isContentDir(dir: string): Promise<boolean> {
  return (await isCarDir(dir)) || (await isTrackDir(dir));
}

async function findArchives(root: string): Promise<string[]> {
  const found: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    if (dir !== root && (await isContentDir(dir))) continue;
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith("__MACOSX")) stack.push(full);
      else if (e.isFile() && ARCHIVE.test(e.name)) found.push(full);
    }
  }
  return found.sort();
}

async function freeTarget(file: string): Promise<string> {
  const base = file.replace(ARCHIVE, "");
  let target = base;
  for (let i = 2; await exists(target); i++) target = `${base}_${i}`;
  return target;
}

export async function expandNestedArchives(root: string, options: NestedOptions): Promise<{ expanded: number; bytes: number }> {
  let budget = options.budgetBytes;
  let expanded = 0;
  let bytes = 0;
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const archives = await findArchives(root);
    if (archives.length === 0) break;
    if (expanded + archives.length > MAX_ARCHIVES) throw new HttpError(400, `Too many nested archives (limit ${MAX_ARCHIVES})`);
    for (const [i, file] of archives.entries()) {
      await options.onProgress(expanded + i, expanded + archives.length);
      const name = path.relative(root, file);
      const listing = await listArchive(file, budget).catch((e: Error) => {
        throw new HttpError(400, `${name}: ${e.message}`);
      });
      if ((await options.freeBytes()) < listing.unpackedBytes * 1.2) {
        throw new HttpError(507, `Not enough disk space to extract ${name}`);
      }
      const target = await freeTarget(file);
      await extractArchive(file, target).catch((e: Error) => {
        throw new HttpError(400, `${name}: ${e.message}`);
      });
      await fs.rm(file, { force: true });
      budget -= listing.unpackedBytes;
      bytes += listing.unpackedBytes;
    }
    expanded += archives.length;
  }
  await assertSafeTree(root);
  const leftovers = await findArchives(root);
  if (leftovers.length) throw new HttpError(400, `Archives nested deeper than ${MAX_DEPTH} levels are not supported`);
  return { expanded, bytes };
}
