import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function int(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number`);
  return n;
}

const acRoot = path.resolve(repoRoot, process.env.AC_ROOT || "/acserver/acserver");

export const config = {
  port: int("PORT", 8090),
  maxSlotsPerCar: int("MAX_SLOTS_PER_CAR", 3),
  acRoot,
  carsDir: path.join(acRoot, "content", "cars"),
  carsOffDir: path.join(acRoot, "content", "cars_off"),
  tracksDir: path.join(acRoot, "content", "tracks"),
  serverCfg: path.join(acRoot, "cfg", "server_cfg.ini"),
  entryList: path.join(acRoot, "cfg", "entry_list.ini"),
  backupsDir: path.join(acRoot, "panel-backups"),
};
