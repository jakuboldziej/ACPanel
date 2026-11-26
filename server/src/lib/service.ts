import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { HttpError } from "./fsutil.js";
import { getServerKey } from "./serverCfg.js";
import { run } from "./system.js";

export interface LiveInfo {
  name: string;
  track: string;
  clients: number;
  maxClients: number;
  cars: string[];
}

export interface ServiceStatus {
  managed: boolean;
  unit: string;
  active: boolean;
  state: string;
  pid: number | null;
  since: string | null;
  live: LiveInfo | null;
  configChangedAt: string | null;
  restartRequired: boolean;
}

function requireUnit(): string {
  if (!config.serviceUnit) throw new HttpError(409, "Server control is disabled (ACSERVER_UNIT is empty)");
  return config.serviceUnit;
}

async function systemdState(unit: string) {
  const r = await run("systemctl", [
    "show",
    unit,
    "--property=ActiveState,SubState,MainPID,ActiveEnterTimestamp,WorkingDirectory",
    "--timestamp=unix",
  ]);
  const props = Object.fromEntries(
    r.stdout
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
  const ts = Number.parseInt((props.ActiveEnterTimestamp ?? "").replace("@", ""), 10);
  const pid = Number.parseInt(props.MainPID ?? "", 10);
  return {
    active: props.ActiveState === "active",
    state: [props.ActiveState, props.SubState].filter(Boolean).join(" / ") || "unknown",
    pid: pid > 0 ? pid : null,
    since: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : null,
    workingDir: props.WorkingDirectory || null,
  };
}

async function httpPort(root: string): Promise<number | null> {
  try {
    const v = getServerKey(await fs.readFile(path.join(root, "cfg", "server_cfg.ini"), "utf8"), "HTTP_PORT");
    const n = v ? Number.parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function fetchLive(root: string): Promise<LiveInfo | null> {
  const port = await httpPort(root);
  if (!port) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/INFO`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, unknown>;
    return {
      name: String(d.name ?? ""),
      track: String(d.track ?? ""),
      clients: Number(d.clients ?? 0),
      maxClients: Number(d.maxclients ?? 0),
      cars: Array.isArray(d.cars) ? d.cars.map(String) : [],
    };
  } catch {
    return null;
  }
}

async function configChangedAt(root: string): Promise<Date | null> {
  const times = await Promise.all(
    (await fs.readdir(path.join(root, "cfg")).catch(() => [] as string[]))
      .filter((f) => f.endsWith(".ini") || f.endsWith(".yml"))
      .map((f) => fs.stat(path.join(root, "cfg", f)).then((s) => s.mtime, () => null)),
  );
  const valid = times.filter((t): t is Date => t !== null);
  return valid.length ? new Date(Math.max(...valid.map((t) => t.getTime()))) : null;
}

export async function getStatus(): Promise<ServiceStatus> {
  if (!config.serviceUnit) {
    const changed = await configChangedAt(config.acRoot);
    return {
      managed: false,
      unit: "",
      active: false,
      state: "unmanaged",
      pid: null,
      since: null,
      live: null,
      configChangedAt: changed?.toISOString() ?? null,
      restartRequired: false,
    };
  }
  const sd = await systemdState(config.serviceUnit);
  const root = sd.workingDir ?? config.acRoot;
  const [live, changed] = await Promise.all([sd.active ? fetchLive(root) : null, configChangedAt(root)]);
  return {
    managed: true,
    unit: config.serviceUnit,
    active: sd.active,
    state: sd.state,
    pid: sd.pid,
    since: sd.since?.toISOString() ?? null,
    live: sd.active ? live : null,
    configChangedAt: changed?.toISOString() ?? null,
    restartRequired: Boolean(sd.active && sd.since && changed && changed > sd.since),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function restartService(): Promise<ServiceStatus & { ready: boolean }> {
  const unit = requireUnit();
  const r = await run("sudo", ["-n", "systemctl", "restart", unit], 60000);
  if (!r.ok) {
    const needsSudoers = /password is required|a terminal is required|interactive authentication/i.test(r.stderr);
    throw new HttpError(
      500,
      needsSudoers
        ? `sudo needs a password. Add a sudoers rule: <user> ALL=(root) NOPASSWD: /usr/bin/systemctl restart ${unit}`
        : `Restart failed: ${r.stderr.trim() || `exit code ${r.code}`}`,
    );
  }
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const s = await getStatus();
    if (s.active && s.live) return { ...s, ready: true };
    if (s.state.startsWith("failed")) return { ...s, ready: false };
    await sleep(1000);
  }
  return { ...(await getStatus()), ready: false };
}

export async function readLogs(lines: number): Promise<string[]> {
  const unit = requireUnit();
  const r = await run("journalctl", ["-u", unit, "-n", String(lines), "-o", "cat", "--no-pager"]);
  if (!r.ok) throw new HttpError(500, `journalctl failed: ${r.stderr.trim()}`);
  return r.stdout.split("\n").filter((l) => l.length > 0);
}

export function logUnit(): string {
  return requireUnit();
}
