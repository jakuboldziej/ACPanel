import { carDisplayName } from "../../core/carNames.js";
import { HttpError } from "../../core/fsutil.js";
import { fetchServerDetails } from "../server/service.js";
import { recordBan } from "./bans.js";
import { rcon, sanitize } from "./rcon.js";

export interface Player {
  sessionId: number;
  name: string;
  team: string | null;
  nation: string | null;
  steamId: string | null;
  car: string;
  carName: string;
  skin: string | null;
  connectedSince: string | null;
}

const firstSeen = new Map<string, number>();

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function listPlayers(): Promise<{ online: boolean; players: Player[] }> {
  const details = await fetchServerDetails();
  if (!details) return { online: false, players: [] };
  const cars = ((details.players as { Cars?: unknown[] } | undefined)?.Cars ?? []) as Record<string, unknown>[];
  const players: Player[] = [];
  const seen = new Set<string>();
  for (const [sessionId, c] of cars.entries()) {
    if (c.IsConnected !== true) continue;
    const name = str(c.DriverName) ?? "Driver";
    const key = `${sessionId}:${name}`;
    seen.add(key);
    if (!firstSeen.has(key)) firstSeen.set(key, Date.now());
    const model = String(c.Model ?? "");
    const id = str(c.ID);
    players.push({
      sessionId,
      name,
      team: str(c.DriverTeam),
      nation: str(c.DriverNation),
      steamId: id && /^\d{17}$/.test(id) ? id : null,
      car: model,
      carName: await carDisplayName(model),
      skin: str(c.Skin),
      connectedSince: new Date(firstSeen.get(key)!).toISOString(),
    });
  }
  for (const key of firstSeen.keys()) if (!seen.has(key)) firstSeen.delete(key);
  return { online: true, players };
}

export function startPlayerTracking(intervalMs = 20_000): void {
  setInterval(() => void listPlayers().catch(() => {}), intervalMs).unref();
}

async function findPlayer(sessionId: number): Promise<Player> {
  const { players } = await listPlayers();
  const p = players.find((x) => x.sessionId === sessionId);
  if (!p) throw new HttpError(404, "This player is no longer connected");
  return p;
}

function checkReply(reply: string | undefined): string {
  const text = reply ?? "";
  if (/not connected|no command found|missing|invalid|usage/i.test(text)) throw new HttpError(409, text);
  return text;
}

export async function kickPlayer(sessionId: number, reason: string): Promise<string> {
  const p = await findPlayer(sessionId);
  const [reply] = await rcon(`kick_id ${p.sessionId} ${sanitize(reason) || "Kicked by admin"}`);
  return checkReply(reply);
}

export async function banPlayer(sessionId: number, reason: string): Promise<string> {
  const p = await findPlayer(sessionId);
  const why = sanitize(reason) || "Banned by admin";
  const [reply] = await rcon(`ban_id ${p.sessionId} ${why}`);
  const text = checkReply(reply);
  if (p.steamId) await recordBan(p.steamId, p.name, why);
  return text;
}

export async function say(message: string): Promise<string> {
  const text = sanitize(message, 300);
  if (!text) throw new HttpError(400, "Message is empty");
  const [reply] = await rcon(`say ${text}`);
  return checkReply(reply);
}

export async function nextSession(): Promise<string> {
  return checkReply((await rcon("next_session"))[0]);
}

export async function restartSession(): Promise<string> {
  return checkReply((await rcon("restart_session"))[0]);
}

export async function setTime(time: string): Promise<string> {
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) throw new HttpError(400, "Time must be HH:MM");
  return checkReply((await rcon(`settime ${time}`))[0]);
}
