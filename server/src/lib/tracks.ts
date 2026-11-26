import path from "node:path";
import { config } from "../config.js";
import { getServerKey } from "./serverCfg.js";
import { looseJsonField, readLoose } from "./fsutil.js";

export interface CurrentTrack {
  track: string;
  layout: string;
  pitboxes: number | null;
}

export function trackFolder(trackValue: string): string {
  return trackValue.split("/").filter(Boolean).pop() ?? trackValue;
}

export async function getPitboxes(track: string, layout: string): Promise<number | null> {
  const ui = path.join(config.tracksDir, track, "ui", ...(layout ? [layout] : []), "ui_track.json");
  const text = await readLoose(ui);
  if (!text) return null;
  const v = looseJsonField(text, "pitboxes");
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getCurrentTrack(ini: string): Promise<CurrentTrack> {
  const track = trackFolder(getServerKey(ini, "TRACK") ?? "");
  const layout = getServerKey(ini, "CONFIG_TRACK") ?? "";
  return { track, layout, pitboxes: track ? await getPitboxes(track, layout) : null };
}
