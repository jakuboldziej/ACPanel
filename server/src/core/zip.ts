import archiver from "archiver";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import type { Response } from "express";

function folderArchive(dir: string, rootName: string): archiver.Archiver {
  const archive = archiver("zip", { store: true });
  archive.directory(dir, rootName);
  return archive;
}

export function streamFolderZip(res: Response, dir: string, rootName: string): void {
  const archive = folderArchive(dir, rootName);
  res.set({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${rootName}.zip"`,
    "Cache-Control": "no-store",
  });
  archive.on("error", (e) => {
    console.error(`Zip of ${rootName} failed:`, e.message);
    res.destroy(e);
  });
  res.on("close", () => archive.abort());
  archive.pipe(res);
  void archive.finalize();
}

export async function writeFolderZip(dir: string, rootName: string, target: string): Promise<number> {
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(tmp);
      const archive = folderArchive(dir, rootName);
      out.on("close", () => resolve());
      out.on("error", reject);
      archive.on("error", reject);
      archive.pipe(out);
      void archive.finalize();
    });
    await fs.rename(tmp, target);
    return (await fs.stat(target)).size;
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}
