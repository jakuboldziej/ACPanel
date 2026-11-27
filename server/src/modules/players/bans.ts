import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { HttpError, writeAtomic } from "../../core/fsutil.js";
import { serverRoot } from "../server/service.js";

const STEAM_ID = /^\d{17}$/;

export interface Ban {
  steamId: string;
  name: string | null;
  reason: string | null;
  bannedAt: string | null;
}

type BanMeta = Record<string, { name: string | null; reason: string | null; bannedAt: string }>;

async function blacklistPath(): Promise<string> {
  return path.join(await serverRoot(), "blacklist.txt");
}

async function readMeta(): Promise<BanMeta> {
  try {
    return JSON.parse(await fs.readFile(config.bansMeta, "utf8")) as BanMeta;
  } catch {
    return {};
  }
}

async function writeMeta(meta: BanMeta): Promise<void> {
  await fs.mkdir(path.dirname(config.bansMeta), { recursive: true });
  await writeAtomic(config.bansMeta, JSON.stringify(meta, null, 2) + "\n");
}

async function readLines(): Promise<string[]> {
  return (await fs.readFile(await blacklistPath(), "utf8").catch(() => "")).split(/\r?\n/);
}

async function writeLinesInPlace(lines: string[]): Promise<void> {
  const text = lines.filter((l, i) => l.trim() || i < lines.length - 1).join("\n").replace(/\n*$/, "\n");
  await fs.writeFile(await blacklistPath(), text === "\n" ? "" : text);
}

export async function listBans(): Promise<Ban[]> {
  const meta = await readMeta();
  const ids = [...new Set((await readLines()).map((l) => l.trim()).filter((l) => STEAM_ID.test(l)))];
  return ids.map((steamId) => ({
    steamId,
    name: meta[steamId]?.name ?? null,
    reason: meta[steamId]?.reason ?? null,
    bannedAt: meta[steamId]?.bannedAt ?? null,
  }));
}

export async function recordBan(steamId: string, name: string | null, reason: string | null): Promise<void> {
  const meta = await readMeta();
  meta[steamId] = { name, reason, bannedAt: new Date().toISOString() };
  await writeMeta(meta);
}

export async function addBan(steamId: string, reason: string | null): Promise<Ban[]> {
  if (!STEAM_ID.test(steamId)) throw new HttpError(400, "Steam ID must have 17 digits");
  const lines = await readLines();
  if (!lines.some((l) => l.trim() === steamId)) await writeLinesInPlace([...lines.filter((l) => l.trim()), steamId]);
  await recordBan(steamId, null, reason);
  return listBans();
}

export async function unban(steamId: string): Promise<Ban[]> {
  if (!STEAM_ID.test(steamId)) throw new HttpError(400, "Invalid Steam ID");
  const lines = await readLines();
  if (!lines.some((l) => l.trim() === steamId)) throw new HttpError(404, "This Steam ID is not banned");
  await writeLinesInPlace(lines.filter((l) => l.trim() !== steamId));
  const meta = await readMeta();
  delete meta[steamId];
  await writeMeta(meta);
  return listBans();
}
