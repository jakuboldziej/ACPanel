import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { allocateSlots, writeEntries } from "./entryList.js";
import { HttpError, assertSafeName, exists, isEmptyDir, listDirs, looseJsonField, readLoose } from "./fsutil.js";
import { backupCfg, getServerKey, readServerCfg } from "./serverCfg.js";
import { getCurrentTrack, type CurrentTrack } from "./tracks.js";

export interface CarInfo {
  id: string;
  name: string;
  enabled: boolean;
  empty: boolean;
  inConfig: boolean;
}

export interface CarsState {
  cars: CarInfo[];
  track: CurrentTrack;
  maxSlotsPerCar: number;
}

async function displayName(dir: string, id: string): Promise<string> {
  const text = await readLoose(path.join(dir, id, "ui", "ui_car.json"));
  return (text && looseJsonField(text, "name")) || id;
}

export async function getCarsState(): Promise<CarsState> {
  const ini = await readServerCfg();
  const inConfig = new Set((getServerKey(ini, "CARS") ?? "").split(";").filter(Boolean));
  const [on, off] = await Promise.all([listDirs(config.carsDir), listDirs(config.carsOffDir)]);

  const byId = new Map<string, CarInfo>();
  for (const [list, dir, enabled] of [
    [off, config.carsOffDir, false],
    [on, config.carsDir, true],
  ] as const) {
    for (const d of list) {
      const prev = byId.get(d.name);
      if (prev && !prev.empty && d.empty) continue;
      byId.set(d.name, {
        id: d.name,
        name: d.empty ? d.name : await displayName(dir, d.name),
        enabled: enabled && !d.empty,
        empty: d.empty,
        inConfig: inConfig.has(d.name),
      });
    }
  }
  const cars = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { cars, track: await getCurrentTrack(ini), maxSlotsPerCar: config.maxSlotsPerCar };
}

export interface ApplyPlan {
  enable: string[];
  disable: string[];
  slots: { car: string; slots: number }[];
  totalSlots: number;
  pitboxes: number;
}

export async function planCars(wanted: string[], maxSlots = config.maxSlotsPerCar): Promise<ApplyPlan> {
  const unique = [...new Set(wanted)];
  unique.forEach(assertSafeName);
  if (unique.length === 0) throw new HttpError(400, "At least one car must be enabled");

  const state = await getCarsState();
  const byId = new Map(state.cars.map((c) => [c.id, c]));
  for (const id of unique) {
    const c = byId.get(id);
    if (!c) throw new HttpError(400, `No such car: ${id}`);
    if (c.empty) throw new HttpError(400, `Car ${id} is an empty folder (no files)`);
  }

  const { pitboxes, track, layout } = state.track;
  if (!pitboxes) {
    throw new HttpError(409, `Unknown pitbox count for track ${track}${layout ? "/" + layout : ""}, set it on the Tracks page`);
  }

  const sorted = unique.sort();
  let alloc: Map<string, number>;
  try {
    alloc = allocateSlots(sorted, pitboxes, maxSlots);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const wantedSet = new Set(sorted);
  return {
    enable: sorted.filter((id) => !byId.get(id)!.enabled),
    disable: state.cars.filter((c) => c.enabled && !wantedSet.has(c.id)).map((c) => c.id),
    slots: [...alloc].map(([car, slots]) => ({ car, slots })),
    totalSlots: [...alloc.values()].reduce((a, b) => a + b, 0),
    pitboxes,
  };
}

async function moveCar(id: string, fromDir: string, toDir: string): Promise<void> {
  const dst = path.join(toDir, id);
  if (await exists(dst)) {
    if (!(await isEmptyDir(dst))) throw new HttpError(409, `${dst} already exists and is not empty`);
    await fs.rmdir(dst);
  }
  await fs.mkdir(toDir, { recursive: true });
  await fs.rename(path.join(fromDir, id), dst);
}

export async function applyCars(wanted: string[], maxSlots = config.maxSlotsPerCar) {
  const plan = await planCars(wanted, maxSlots);

  for (const id of plan.enable) {
    const dst = path.join(config.carsDir, id);
    if ((await exists(dst)) && !(await isEmptyDir(dst))) throw new HttpError(409, `${dst} already exists`);
  }
  for (const id of plan.disable) {
    const dst = path.join(config.carsOffDir, id);
    if ((await exists(dst)) && !(await isEmptyDir(dst))) throw new HttpError(409, `${dst} already exists`);
  }

  const backup = await backupCfg();
  for (const id of plan.disable) await moveCar(id, config.carsDir, config.carsOffDir);
  for (const id of plan.enable) await moveCar(id, config.carsOffDir, config.carsDir);

  await writeEntries(new Map(plan.slots.map((s) => [s.car, s.slots])));

  return { ...plan, backup, restartNeeded: true };
}
