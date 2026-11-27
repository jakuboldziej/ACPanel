import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { HttpError, exists } from "../../core/fsutil.js";
import { RconConnection, rconExec, type RconTarget } from "../../core/rcon.js";
import { backupFiles, getServerKey } from "../../core/serverCfg.js";
import { readYaml, writeYaml } from "../../core/yamlFile.js";
import { serverRoot } from "../server/service.js";

async function configuredPort(root: string): Promise<number> {
  const file = path.join(root, "cfg", "extra_cfg.yml");
  if (!(await exists(file))) return 0;
  const { doc } = await readYaml(file);
  const port = Number(doc.get("RconPort") ?? 0);
  return Number.isInteger(port) && port > 0 ? port : 0;
}

async function target(): Promise<RconTarget> {
  const root = await serverRoot();
  const port = await configuredPort(root);
  if (!port) throw new HttpError(409, "RCON is disabled. Enable it on the Players page (requires a server restart)");
  const ini = await fs.readFile(path.join(root, "cfg", "server_cfg.ini"), "utf8").catch(() => "");
  const password = getServerKey(ini, "ADMIN_PASSWORD") ?? "";
  if (!password) throw new HttpError(409, "ADMIN_PASSWORD is empty in server_cfg.ini, RCON needs it");
  return { host: "127.0.0.1", port, password };
}

export interface RconStatus {
  port: number;
  enabled: boolean;
  reachable: boolean;
  error: string | null;
}

export async function rconStatus(): Promise<RconStatus> {
  const port = await configuredPort(await serverRoot());
  if (!port) return { port: 0, enabled: false, reachable: false, error: null };
  try {
    (await RconConnection.open(await target(), 2000)).close();
    return { port, enabled: true, reachable: true, error: null };
  } catch (e) {
    return { port, enabled: true, reachable: false, error: (e as Error).message };
  }
}

export async function enableRcon(port = config.rconDefaultPort): Promise<{ backup: string; port: number }> {
  if (!(await exists(config.extraCfg))) throw new HttpError(409, "cfg/extra_cfg.yml does not exist");
  const { doc } = await readYaml(config.extraCfg);
  doc.set("RconPort", port);
  const backup = await backupFiles([config.extraCfg]);
  await writeYaml(config.extraCfg, doc);
  return { backup, port };
}

export function sanitize(text: string, max = 200): string {
  return text.replace(/[\r\n\0]+/g, " ").trim().slice(0, max);
}

export async function rcon(...commands: string[]): Promise<string[]> {
  return rconExec(await target(), commands);
}
