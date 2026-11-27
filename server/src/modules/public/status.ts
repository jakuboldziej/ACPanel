import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { getServerKey } from "../../core/serverCfg.js";
import { fetchServerDetails, serverRoot } from "../server/service.js";
import { trackFolder } from "../tracks/service.js";
import { carDisplayName } from "../../core/carNames.js";
import { readUiJson, trackMeta } from "../../core/uiMeta.js";

export type SessionType = "booking" | "practice" | "qualify" | "race";

export interface PublicPlayer {
  name: string;
  car: string;
  carName: string;
}

export interface PublicStatus {
  online: boolean;
  name: string | null;
  description: string | null;
  location: string | null;
  track: { id: string; layout: string; name: string; lengthMeters: number | null } | null;
  session: { type: SessionType; timeLeftSeconds: number | null; raceLaps: number | null } | null;
  players: { count: number; max: number; list: PublicPlayer[] };
  weather: { ambient: number; road: number } | null;
  joinUrl: string | null;
  passwordProtected: boolean;
}

const SESSION_TYPES: Record<number, SessionType> = { 0: "booking", 1: "practice", 2: "qualify", 3: "race" };
const CACHE_MS = 5000;
let cache: { at: number; value: Promise<PublicStatus> } | null = null;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}


async function currentTrack(root: string): Promise<PublicStatus["track"]> {
  const ini = await fs.readFile(path.join(root, "cfg", "server_cfg.ini"), "utf8").catch(() => null);
  if (!ini) return null;
  const id = trackFolder(getServerKey(ini, "TRACK") ?? "");
  if (!id) return null;
  const layout = getServerKey(ini, "CONFIG_TRACK") ?? "";
  const ui = await readUiJson(path.join(config.tracksDir, id, "ui", ...(layout ? [layout] : []), "ui_track.json"));
  const meta = trackMeta(ui);
  return { id, layout, name: meta.name ?? id, lengthMeters: meta.lengthMeters };
}

function offline(track: PublicStatus["track"]): PublicStatus {
  return {
    online: false,
    name: null,
    description: null,
    location: null,
    track,
    session: null,
    players: { count: 0, max: 0, list: [] },
    weather: null,
    joinUrl: null,
    passwordProtected: false,
  };
}

async function build(): Promise<PublicStatus> {
  const root = await serverRoot();
  const [details, track] = await Promise.all([fetchServerDetails(), currentTrack(root)]);
  if (!details) return offline(track);

  const cars = ((details.players as { Cars?: unknown[] } | undefined)?.Cars ?? []) as Record<string, unknown>[];
  const list: PublicPlayer[] = [];
  for (const c of cars) {
    if (c.IsConnected !== true) continue;
    const model = String(c.Model ?? "");
    list.push({ name: String(c.DriverName ?? "Driver"), car: model, carName: await carDisplayName(model) });
  }

  const sessionType = SESSION_TYPES[num(details.session) ?? -1];
  const types = Array.isArray(details.sessiontypes) ? details.sessiontypes.map(Number) : [];
  const durations = Array.isArray(details.durations) ? details.durations.map(Number) : [];
  const raceIndex = types.indexOf(3);
  const country = Array.isArray(details.country) ? String(details.country[0] ?? "") : "";
  const ip = typeof details.ip === "string" && /^[\d.]+$/.test(details.ip) ? details.ip : null;
  const httpPort = num(details.cport);
  const ambient = num(details.ambientTemperature);
  const road = num(details.roadTemperature);

  return {
    online: true,
    name: typeof details.name === "string" ? details.name.replace(/\s*ℹ\d+$/, "") : null,
    description: typeof details.description === "string" && details.description ? details.description : null,
    location: [details.city, country].filter((v) => typeof v === "string" && v).join(", ") || null,
    track,
    session: sessionType
      ? {
          type: sessionType,
          timeLeftSeconds: num(details.timeleft),
          raceLaps: details.timed === false && raceIndex >= 0 ? (durations[raceIndex] ?? null) : null,
        }
      : null,
    players: { count: list.length, max: num(details.maxclients) ?? 0, list },
    weather: ambient !== null && road !== null ? { ambient: Math.round(ambient), road: Math.round(road) } : null,
    joinUrl: ip && httpPort ? `https://acstuff.club/s/q:race/online/join?ip=${ip}&httpPort=${httpPort}` : null,
    passwordProtected: details.pass === true,
  };
}

export function getPublicStatus(): Promise<PublicStatus> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = build();
  cache = { at: Date.now(), value };
  value.catch(() => {
    cache = null;
  });
  return value;
}
