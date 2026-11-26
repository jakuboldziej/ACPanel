import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { syncEnabledCars } from "./cars.js";
import { HttpError, SAFE_NAME, assertSafeName, exists, isEmptyDir, listDirs, writeAtomic } from "./fsutil.js";
import { IniDoc } from "./ini.js";
import { backupFiles } from "./serverCfg.js";
import { readSessions } from "./sessions.js";
import { trackFolder } from "./tracks.js";

const CORE_FILES = ["server_cfg.ini", "entry_list.ini"];
const PRESET_FILE = /^(server_cfg\.ini|entry_list\.ini|extra_cfg\.yml|plugin_[A-Za-z0-9_]+_cfg\.yml)$/;

export interface PresetInfo {
  name: string;
  serverName: string | null;
  track: string;
  layout: string;
  cars: string[];
  slots: number;
  sessions: string;
  files: string[];
  modifiedAt: string;
  active: boolean;
  missingCars: string[];
  missingTrack: boolean;
}

function presetDir(name: string): string {
  assertSafeName(name);
  return path.join(config.presetsDir, name);
}

async function presetFiles(dir: string): Promise<string[]> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  return names.filter((n) => PRESET_FILE.test(n)).sort();
}

function entryModels(entryList: string): string[] {
  const doc = IniDoc.parse(entryList);
  return doc
    .sections()
    .filter((s) => /^CAR_\d+$/.test(s))
    .map((s) => doc.get(s, "MODEL") ?? "")
    .filter(Boolean);
}

function normalize(text: string | null): string {
  return (text ?? "").replace(/\r\n/g, "\n").trimEnd();
}

function sessionsSummary(serverCfg: string): string {
  const s = readSessions(serverCfg);
  const parts: string[] = [];
  if (s.practice.enabled) parts.push(`P ${s.practice.minutes} min`);
  if (s.qualify.enabled) parts.push(`Q ${s.qualify.minutes} min`);
  if (s.race.enabled) parts.push(s.race.mode === "laps" ? `R ${s.race.laps} laps` : `R ${s.race.minutes} min`);
  return parts.join(" · ");
}

async function carInstalled(id: string): Promise<boolean> {
  if (!SAFE_NAME.test(id) || id.includes("..")) return false;
  for (const dir of [config.carsDir, config.carsOffDir]) {
    const full = path.join(dir, id);
    if ((await exists(full)) && !(await isEmptyDir(full))) return true;
  }
  return false;
}

async function readOptional(file: string): Promise<string | null> {
  return fs.readFile(file, "utf8").catch(() => null);
}

async function describe(name: string, current: { serverCfg: string; entryList: string }): Promise<PresetInfo> {
  const dir = presetDir(name);
  const files = await presetFiles(dir);
  const [serverCfg, entryList] = await Promise.all(CORE_FILES.map((f) => readOptional(path.join(dir, f))));
  const doc = IniDoc.parse(serverCfg ?? "");
  const models = entryModels(entryList ?? "");
  const cars = [...new Set(models)];
  const track = trackFolder(doc.get("SERVER", "TRACK") ?? "");
  const stats = await Promise.all(files.map((f) => fs.stat(path.join(dir, f))));
  const installed = await Promise.all(cars.map(carInstalled));
  return {
    name,
    serverName: doc.get("SERVER", "NAME"),
    track,
    layout: doc.get("SERVER", "CONFIG_TRACK") ?? "",
    cars,
    slots: models.length,
    sessions: serverCfg ? sessionsSummary(serverCfg) : "",
    files,
    modifiedAt: new Date(Math.max(0, ...stats.map((s) => s.mtimeMs))).toISOString(),
    active:
      serverCfg !== null &&
      normalize(serverCfg) === normalize(current.serverCfg) &&
      normalize(entryList) === normalize(current.entryList),
    missingCars: cars.filter((_, i) => !installed[i]),
    missingTrack: !track || !(await exists(path.join(config.tracksDir, track))),
  };
}

export async function listPresets(): Promise<PresetInfo[]> {
  const current = {
    serverCfg: (await readOptional(config.serverCfg)) ?? "",
    entryList: (await readOptional(config.entryList)) ?? "",
  };
  const dirs = (await listDirs(config.presetsDir)).filter((d) => !d.empty);
  const presets = await Promise.all(
    dirs.map((d) => describe(d.name, current).catch(() => null)),
  );
  return presets.filter((p): p is PresetInfo => p !== null).sort((a, b) => a.name.localeCompare(b.name));
}

async function currentFiles(): Promise<string[]> {
  return presetFiles(config.cfgDir);
}

export async function savePreset(name: string, overwrite: boolean): Promise<PresetInfo[]> {
  const dir = presetDir(name);
  if ((await exists(dir)) && !overwrite) throw new HttpError(409, `Preset ${name} already exists`);
  const files = await currentFiles();
  for (const f of CORE_FILES) if (!files.includes(f)) throw new HttpError(409, `cfg/${f} is missing`);

  await fs.mkdir(config.presetsDir, { recursive: true });
  const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(tmp);
  try {
    for (const f of files) await fs.copyFile(path.join(config.cfgDir, f), path.join(tmp, f));
    if (await exists(dir)) await fs.rm(dir, { recursive: true, force: true });
    await fs.rename(tmp, dir);
  } catch (e) {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
  return listPresets();
}

export async function applyPreset(name: string): Promise<{ backup: string; enabled: string[]; disabled: string[] }> {
  const dir = presetDir(name);
  if (!(await exists(dir))) throw new HttpError(404, `No such preset: ${name}`);
  const files = await presetFiles(dir);
  for (const f of CORE_FILES) if (!files.includes(f)) throw new HttpError(409, `Preset ${name} has no ${f}`);

  const info = await describe(name, { serverCfg: "", entryList: "" });
  if (info.missingTrack) throw new HttpError(409, `Track ${info.track || "(none)"} is not installed`);
  if (info.missingCars.length) throw new HttpError(409, `Cars not installed: ${info.missingCars.join(", ")}`);
  if (info.cars.length === 0) throw new HttpError(409, `Preset ${name} has no cars in entry_list.ini`);

  const replaced = (await currentFiles()).filter((f) => files.includes(f));
  const backup = await backupFiles(replaced.map((f) => path.join(config.cfgDir, f)));
  const moved = await syncEnabledCars(info.cars);
  for (const f of files) {
    await writeAtomic(path.join(config.cfgDir, f), await fs.readFile(path.join(dir, f), "utf8"));
  }
  return { backup, enabled: moved.enable, disabled: moved.disable };
}

export async function deletePreset(name: string): Promise<void> {
  const dir = presetDir(name);
  if (!(await exists(dir))) throw new HttpError(404, `No such preset: ${name}`);
  await fs.rm(dir, { recursive: true, force: true });
}
