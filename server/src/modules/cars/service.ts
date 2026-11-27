import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { allocateSlots, writeEntries } from "./entryList.js";
import { HttpError, assertSafeName, exists, isEmptyDir, listDirs, moveDir } from "../../core/fsutil.js";
import { backupCfg, getServerKey, readServerCfg } from "../../core/serverCfg.js";
import { dirSize } from "../mods/archive.js";
import { findCarImage, type ImageKind } from "../../core/preview.js";
import { carMeta, readUiJson, type CarSpecs } from "../../core/uiMeta.js";
import { getCurrentTrack, type CurrentTrack } from "../tracks/service.js";

export interface CarInfo {
  id: string;
  name: string;
  enabled: boolean;
  empty: boolean;
  inConfig: boolean;
  sizeBytes: number;
  image: ImageKind | null;
  brand: string | null;
  carClass: string | null;
  tags: string[];
  specs: CarSpecs | null;
  missingDataAcd: boolean;
}

export interface CarsState {
  cars: CarInfo[];
  track: CurrentTrack;
  maxSlotsPerCar: number;
}

export async function hasUnprotectedData(dir: string): Promise<boolean> {
  return !(await exists(path.join(dir, "data.acd"))) && (await exists(path.join(dir, "data")));
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
      const full = path.join(dir, d.name);
      const [ui, sizeBytes, image, missingDataAcd] = d.empty
        ? [null, 0, null, false]
        : await Promise.all([
            readUiJson(path.join(full, "ui", "ui_car.json")),
            dirSize(full),
            findCarImage(full),
            hasUnprotectedData(full),
          ]);
      const meta = carMeta(ui);
      byId.set(d.name, {
        id: d.name,
        name: meta.name ?? d.name,
        enabled: enabled && !d.empty,
        empty: d.empty,
        inConfig: inConfig.has(d.name),
        sizeBytes,
        image: image?.kind ?? null,
        brand: meta.brand,
        carClass: meta.carClass,
        tags: meta.tags,
        specs: ui ? meta.specs : null,
        missingDataAcd,
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
  await moveDir(path.join(fromDir, id), dst);
}

async function assertMovable(enable: string[], disable: string[]): Promise<void> {
  for (const id of enable) {
    const dst = path.join(config.carsDir, id);
    if ((await exists(dst)) && !(await isEmptyDir(dst))) throw new HttpError(409, `${dst} already exists`);
  }
  for (const id of disable) {
    const dst = path.join(config.carsOffDir, id);
    if ((await exists(dst)) && !(await isEmptyDir(dst))) throw new HttpError(409, `${dst} already exists`);
  }
}

async function moveCars(enable: string[], disable: string[]): Promise<void> {
  for (const id of disable) await moveCar(id, config.carsDir, config.carsOffDir);
  for (const id of enable) await moveCar(id, config.carsOffDir, config.carsDir);
}

export async function planEnabledCars(wanted: string[]): Promise<{ enable: string[]; disable: string[]; missing: string[] }> {
  const state = await getCarsState();
  const byId = new Map(state.cars.map((c) => [c.id, c]));
  const wantedSet = new Set(wanted);
  return {
    enable: [...wantedSet].filter((id) => byId.get(id) && !byId.get(id)!.empty && !byId.get(id)!.enabled),
    disable: state.cars.filter((c) => c.enabled && !wantedSet.has(c.id)).map((c) => c.id),
    missing: [...wantedSet].filter((id) => !byId.get(id) || byId.get(id)!.empty),
  };
}

export async function syncEnabledCars(wanted: string[]): Promise<{ enable: string[]; disable: string[] }> {
  wanted.forEach(assertSafeName);
  const plan = await planEnabledCars(wanted);
  if (plan.missing.length) throw new HttpError(409, `Missing cars: ${plan.missing.join(", ")}`);
  await assertMovable(plan.enable, plan.disable);
  await moveCars(plan.enable, plan.disable);
  return { enable: plan.enable, disable: plan.disable };
}

export async function applyCars(wanted: string[], maxSlots = config.maxSlotsPerCar) {
  const plan = await planCars(wanted, maxSlots);
  await assertMovable(plan.enable, plan.disable);
  const backup = await backupCfg();
  await moveCars(plan.enable, plan.disable);
  await writeEntries(new Map(plan.slots.map((s) => [s.car, s.slots])));
  return { ...plan, backup, restartNeeded: true };
}

export async function carDir(id: string): Promise<string> {
  assertSafeName(id);
  for (const dir of [config.carsDir, config.carsOffDir]) {
    const full = path.join(dir, id);
    if ((await exists(full)) && !(await isEmptyDir(full))) return full;
  }
  throw new HttpError(404, `No such car: ${id}`);
}

export async function deleteCar(id: string): Promise<{ id: string; freedBytes: number }> {
  assertSafeName(id);
  const enabled = path.join(config.carsDir, id);
  const disabled = path.join(config.carsOffDir, id);
  if ((await exists(enabled)) && !(await isEmptyDir(enabled))) {
    throw new HttpError(409, `${id} is enabled, disable it first`);
  }
  const found = [enabled, disabled];
  let freedBytes = 0;
  let any = false;
  for (const dir of found) {
    if (!(await exists(dir))) continue;
    any = true;
    freedBytes += await dirSize(dir);
    await fs.rm(dir, { recursive: true, force: true });
  }
  if (!any) throw new HttpError(404, `No such car: ${id}`);
  return { id, freedBytes };
}
