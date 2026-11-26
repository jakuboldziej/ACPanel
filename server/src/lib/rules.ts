import { config } from "../config.js";
import { HttpError } from "./fsutil.js";
import { backupFiles, getServerKey, readServerCfg, setServerKeys, writeServerCfg } from "./serverCfg.js";

export type StartRule = 0 | 1 | 2;

export interface Rules {
  cutPenalties: boolean;
  allowedTyresOut: number;
  gasPenalty: boolean;
  startRule: StartRule;
  contactLimit: boolean;
  maxContactsPerKm: number;
}

const DEFAULT_TYRES_OUT = 2;
const DEFAULT_CONTACTS = 5;

function int(v: string | null, def: number): number {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export async function getRules(): Promise<Rules> {
  const ini = await readServerCfg();
  const tyres = int(getServerKey(ini, "ALLOWED_TYRES_OUT"), DEFAULT_TYRES_OUT);
  const contacts = int(getServerKey(ini, "MAX_CONTACTS_PER_KM"), -1);
  const start = int(getServerKey(ini, "START_RULE"), 0);
  return {
    cutPenalties: tyres >= 0,
    allowedTyresOut: tyres >= 0 ? tyres : DEFAULT_TYRES_OUT,
    gasPenalty: getServerKey(ini, "RACE_GAS_PENALTY_DISABLED") !== "1",
    startRule: start === 1 || start === 2 ? start : 0,
    contactLimit: contacts >= 0,
    maxContactsPerKm: contacts >= 0 ? contacts : DEFAULT_CONTACTS,
  };
}

export async function saveRules(rules: Rules): Promise<{ backup: string; rules: Rules }> {
  if (rules.cutPenalties && (rules.allowedTyresOut < 0 || rules.allowedTyresOut > 4)) {
    throw new HttpError(400, "Allowed tyres out must be between 0 and 4");
  }
  if (rules.contactLimit && (rules.maxContactsPerKm < 0 || rules.maxContactsPerKm > 100)) {
    throw new HttpError(400, "Max contacts per km must be between 0 and 100");
  }
  const ini = await readServerCfg();
  const backup = await backupFiles([config.serverCfg]);
  await writeServerCfg(
    setServerKeys(ini, {
      ALLOWED_TYRES_OUT: String(rules.cutPenalties ? rules.allowedTyresOut : -1),
      RACE_GAS_PENALTY_DISABLED: rules.gasPenalty ? "0" : "1",
      START_RULE: String(rules.startRule),
      MAX_CONTACTS_PER_KM: String(rules.contactLimit ? rules.maxContactsPerKm : -1),
    }),
  );
  return { backup, rules: await getRules() };
}
