import fs from "node:fs/promises";
import path from "node:path";
import type { Response } from "express";
import { HttpError, exists } from "./fsutil.js";

export type ImageKind = "preview" | "badge";

export interface FoundImage {
  file: string;
  kind: ImageKind;
}

export async function findCarImage(dir: string): Promise<FoundImage | null> {
  const skinsDir = path.join(dir, "skins");
  const skins = (await fs.readdir(skinsDir, { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
  for (const skin of skins) {
    for (const name of ["preview.jpg", "preview.png"]) {
      const file = path.join(skinsDir, skin, name);
      if (await exists(file)) return { file, kind: "preview" };
    }
  }
  for (const rel of [["ui", "badge.png"], ["logo.png"]]) {
    const file = path.join(dir, ...rel);
    if (await exists(file)) return { file, kind: "badge" };
  }
  return null;
}

export type TrackImageKind = "preview" | "outline";

export function trackImagePath(trackDir: string, layout: string, kind: TrackImageKind): string {
  return path.join(trackDir, "ui", ...(layout ? [layout] : []), `${kind}.png`);
}

export async function sendImageInside(res: Response, roots: string[], file: string): Promise<void> {
  let real: string;
  try {
    real = await fs.realpath(file);
  } catch {
    throw new HttpError(404, "No image");
  }
  const realRoots = await Promise.all(roots.map((r) => fs.realpath(r).catch(() => null)));
  if (!realRoots.some((r) => r && real.startsWith(r + path.sep))) throw new HttpError(404, "No image");
  res.set("Cache-Control", "private, max-age=300");
  res.sendFile(real);
}
