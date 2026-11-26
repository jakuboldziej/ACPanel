import fs from "node:fs/promises";
import path from "node:path";

export const SAFE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.\-]*$/;

export function assertSafeName(name: string): void {
  if (!SAFE_NAME.test(name) || name.includes("..")) {
    throw new HttpError(400, `Invalid name: ${name}`);
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function isEmptyDir(p: string): Promise<boolean> {
  return (await fs.readdir(p)).length === 0;
}

export async function listDirs(dir: string): Promise<{ name: string; empty: boolean }[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => ({ name: e.name, empty: await isEmptyDir(path.join(dir, e.name)) })),
  );
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readLoose(p: string): Promise<string | null> {
  try {
    return (await fs.readFile(p, "latin1")).replace(/^﻿|^ï»¿/, "");
  } catch {
    return null;
  }
}

export function looseJsonField(text: string, field: string): string | null {
  const m = text.match(new RegExp(`"${field}"\\s*:\\s*"?([^",\\n}]*)"?`, "i"));
  return m ? m[1]!.trim() : null;
}

export async function writeAtomic(p: string, content: string): Promise<void> {
  const tmp = `${p}.tmp-${process.pid}`;
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, p);
}

export async function moveDir(src: string, dst: string): Promise<void> {
  try {
    await fs.rename(src, dst);
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
  }
  const partial = `${dst}.partial-${process.pid}-${Date.now()}`;
  try {
    await fs.cp(src, partial, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    await fs.rename(partial, dst);
  } catch (e) {
    await fs.rm(partial, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
  await fs.rm(src, { recursive: true, force: true });
}
