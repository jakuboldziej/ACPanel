import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { writeAtomic } from "./fsutil.js";

export function getServerKey(ini: string, key: string): string | null {
  let inServer = false;
  for (const raw of ini.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inServer = line.toUpperCase() === "[SERVER]";
      continue;
    }
    if (!inServer) continue;
    const eq = line.indexOf("=");
    if (eq > 0 && line.slice(0, eq).trim().toUpperCase() === key) return line.slice(eq + 1).trim();
  }
  return null;
}

export function setServerKeys(ini: string, values: Record<string, string>): string {
  const eol = ini.includes("\r\n") ? "\r\n" : "\n";
  const lines = ini.split(/\r?\n/);
  const pending = new Map(Object.entries(values));
  let inServer = false;
  let serverEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith("[")) {
      if (inServer) serverEnd = i;
      inServer = line.toUpperCase() === "[SERVER]";
      continue;
    }
    if (!inServer) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().toUpperCase();
    if (pending.has(key)) {
      lines[i] = `${key}=${pending.get(key)}`;
      pending.delete(key);
    }
  }
  if (inServer) serverEnd = lines.length;
  if (pending.size) {
    if (serverEnd === -1) throw new Error("Missing [SERVER] section in server_cfg.ini");
    const add = [...pending].map(([k, v]) => `${k}=${v}`);
    let at = serverEnd;
    while (at > 0 && lines[at - 1]!.trim() === "") at--;
    lines.splice(at, 0, ...add);
  }
  return lines.join(eol);
}

export async function readServerCfg(): Promise<string> {
  return fs.readFile(config.serverCfg, "utf8");
}

export async function writeServerCfg(content: string): Promise<void> {
  await writeAtomic(config.serverCfg, content);
}

export async function backupFiles(files: string[]): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(config.backupsDir, stamp);
  await fs.mkdir(dir, { recursive: true });
  for (const f of files) {
    await fs.copyFile(f, path.join(dir, path.basename(f))).catch(() => {});
  }
  return dir;
}

export async function backupCfg(): Promise<string> {
  return backupFiles([config.serverCfg, config.entryList]);
}
