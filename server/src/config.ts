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

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  sessionDays: int("SESSION_DAYS", 7),
  allowedOrigins: list("ALLOWED_ORIGINS"),
  port: int("PORT", 8090),
  host: process.env.HOST || "0.0.0.0",
  serviceUnit: process.env.ACSERVER_UNIT ?? "acserver",
  maxSlotsPerCar: int("MAX_SLOTS_PER_CAR", 3),
  acRoot,
  carsDir: path.join(acRoot, "content", "cars"),
  carsOffDir: path.join(acRoot, "content", "cars_off"),
  tracksDir: path.join(acRoot, "content", "tracks"),
  serverCfg: path.join(acRoot, "cfg", "server_cfg.ini"),
  entryList: path.join(acRoot, "cfg", "entry_list.ini"),
  backupsDir: path.join(acRoot, "panel-backups"),
  trackParams: path.join(acRoot, "cfg", "data_track_params.ini"),
  pitboxOverrides: path.join(acRoot, "panel-data", "pitboxes.json"),
  extraCfg: path.join(acRoot, "cfg", "extra_cfg.yml"),
  cfgDir: path.join(acRoot, "cfg"),
  pluginsDir: path.join(acRoot, "plugins"),
  extraCfgSchema: path.join(acRoot, "cfg", "schemas", "extra_cfg.schema.json"),
};
