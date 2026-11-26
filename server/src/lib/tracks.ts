import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { allocateSlots, writeEntries } from "./entryList.js";
import { HttpError, assertSafeName, exists, listDirs, looseJsonField, readLoose, writeAtomic } from "./fsutil.js";
import { backupCfg, getServerKey, readServerCfg } from "./serverCfg.js";

export type PitboxSource = "manual" | "ui" | null;

export interface CurrentTrack {
  track: string;
  layout: string;
  pitboxes: number | null;
}

export interface LayoutInfo {
  id: string;
  name: string;
  pitboxes: number | null;
  pitboxesSource: PitboxSource;
}

export interface TrackInfo {
  id: string;
  name: string;
  empty: boolean;
  hasTrackParams: boolean;
  layouts: LayoutInfo[];
}

export interface TracksState {
  current: CurrentTrack;
  enabledCars: number;
  tracks: TrackInfo[];
}

const NON_LAYOUT_DIRS = new Set(["data", "ui", "skins", "extension", "ai", "texture"]);

export function trackFolder(trackValue: string): string {
  return trackValue.split("/").filter(Boolean).pop() ?? trackValue;
}

function overrideKey(track: string, layout: string): string {
  return `${track}/${layout}`;
}

async function readOverrides(): Promise<Record<string, number>> {
  const text = await readLoose(config.pitboxOverrides);
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, number>;
  } catch {
    return {};
  }
}

async function readUiTrack(track: string, layout: string): Promise<string | null> {
  return readLoose(path.join(config.tracksDir, track, "ui", ...(layout ? [layout] : []), "ui_track.json"));
}

function parsePitboxes(text: string | null): number | null {
  const v = text ? looseJsonField(text, "pitboxes") : null;
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function resolvePitboxes(
  track: string,
  layout: string,
  overrides: Record<string, number>,
  uiText?: string | null,
): Promise<{ pitboxes: number | null; pitboxesSource: PitboxSource }> {
  const manual = overrides[overrideKey(track, layout)];
  if (manual) return { pitboxes: manual, pitboxesSource: "manual" };
  const fromUi = parsePitboxes(uiText === undefined ? await readUiTrack(track, layout) : uiText);
  return fromUi ? { pitboxes: fromUi, pitboxesSource: "ui" } : { pitboxes: null, pitboxesSource: null };
}

export async function getPitboxes(track: string, layout: string): Promise<number | null> {
  return (await resolvePitboxes(track, layout, await readOverrides())).pitboxes;
}

export async function getCurrentTrack(ini: string): Promise<CurrentTrack> {
  const track = trackFolder(getServerKey(ini, "TRACK") ?? "");
  const layout = getServerKey(ini, "CONFIG_TRACK") ?? "";
  return { track, layout, pitboxes: track ? await getPitboxes(track, layout) : null };
}

async function readTrackParamIds(): Promise<Set<string>> {
  const text = (await readLoose(config.trackParams)) ?? "";
  return new Set([...text.matchAll(/^\s*\[([^\]]+)\]/gm)].map((m) => m[1]!.trim().toLowerCase()));
}

async function listLayoutIds(track: string): Promise<string[]> {
  const dir = path.join(config.tracksDir, track);
  const ids: string[] = [];
  if ((await exists(path.join(dir, "data"))) || (await exists(path.join(dir, "models.ini")))) ids.push("");
  for (const d of await listDirs(dir)) {
    if (d.empty || NON_LAYOUT_DIRS.has(d.name.toLowerCase())) continue;
    if (await exists(path.join(dir, d.name, "data"))) ids.push(d.name);
  }
  return ids;
}

async function getTrackInfo(id: string, overrides: Record<string, number>, params: Set<string>): Promise<TrackInfo> {
  const layoutIds = await listLayoutIds(id);
  const layouts = await Promise.all(
    layoutIds.map(async (layout): Promise<LayoutInfo> => {
      const ui = await readUiTrack(id, layout);
      return {
        id: layout,
        name: (ui && looseJsonField(ui, "name")) || layout || "default",
        ...(await resolvePitboxes(id, layout, overrides, ui)),
      };
    }),
  );
  const rootUi = await readUiTrack(id, "");
  return {
    id,
    name: (rootUi && looseJsonField(rootUi, "name")) || id,
    empty: layouts.length === 0,
    hasTrackParams: params.has(id.toLowerCase()),
    layouts,
  };
}

async function enabledCars(): Promise<string[]> {
  return (await listDirs(config.carsDir)).filter((d) => !d.empty).map((d) => d.name);
}

export async function getTracksState(): Promise<TracksState> {
  const [ini, overrides, params, dirs, cars] = await Promise.all([
    readServerCfg(),
    readOverrides(),
    readTrackParamIds(),
    listDirs(config.tracksDir),
    enabledCars(),
  ]);
  const tracks = await Promise.all(dirs.map((d) => getTrackInfo(d.name, overrides, params)));
  return {
    current: await getCurrentTrack(ini),
    enabledCars: cars.length,
    tracks: tracks.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export interface TrackPlan {
  track: string;
  layout: string;
  pitboxes: number;
  slots: { car: string; slots: number }[];
  totalSlots: number;
  warnings: string[];
}

export async function planTrack(track: string, layout: string, maxSlots = config.maxSlotsPerCar): Promise<TrackPlan> {
  assertSafeName(track);
  if (layout) assertSafeName(layout);
  const info = await getTrackInfo(track, await readOverrides(), await readTrackParamIds());
  if (info.empty) throw new HttpError(400, `Track ${track} has no layouts (empty or missing folder)`);
  const l = info.layouts.find((x) => x.id === layout);
  if (!l) throw new HttpError(400, `Track ${track} has no layout "${layout}"`);
  if (!l.pitboxes) throw new HttpError(409, `Unknown pitbox count for ${track}${layout ? "/" + layout : ""}, set it first`);

  const cars = (await enabledCars()).sort();
  let alloc: Map<string, number>;
  try {
    alloc = allocateSlots(cars, l.pitboxes, maxSlots);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const warnings: string[] = [];
  if (!info.hasTrackParams) warnings.push(`${track} is missing from data_track_params.ini, the server may refuse to start`);

  return {
    track,
    layout,
    pitboxes: l.pitboxes,
    slots: [...alloc].map(([car, slots]) => ({ car, slots })),
    totalSlots: [...alloc.values()].reduce((a, b) => a + b, 0),
    warnings,
  };
}

export async function applyTrack(track: string, layout: string, maxSlots = config.maxSlotsPerCar) {
  const plan = await planTrack(track, layout, maxSlots);
  const backup = await backupCfg();

  const current = getServerKey(await readServerCfg(), "TRACK") ?? "";
  const slash = current.lastIndexOf("/");
  const trackValue = slash >= 0 ? current.slice(0, slash + 1) + track : track;

  await writeEntries(new Map(plan.slots.map((s) => [s.car, s.slots])), {
    TRACK: trackValue,
    CONFIG_TRACK: layout,
  });
  return { ...plan, backup, restartNeeded: true };
}

export async function setPitboxOverride(track: string, layout: string, pitboxes: number | null): Promise<void> {
  assertSafeName(track);
  if (layout) assertSafeName(layout);
  if (!(await exists(path.join(config.tracksDir, track)))) throw new HttpError(400, `No such track: ${track}`);
  const overrides = await readOverrides();
  const key = overrideKey(track, layout);
  if (pitboxes) overrides[key] = pitboxes;
  else delete overrides[key];
  await fs.mkdir(path.dirname(config.pitboxOverrides), { recursive: true });
  await writeAtomic(config.pitboxOverrides, JSON.stringify(overrides, null, 2) + "\n");
}
