import { config } from "../../config.js";
import { IniDoc, type IniEntries } from "../../core/ini.js";
import { backupFiles, readServerCfg, writeServerCfg } from "../../core/serverCfg.js";

export interface TimedSession {
  enabled: boolean;
  name: string;
  minutes: number;
  isOpen: boolean;
}

export interface RaceSession {
  enabled: boolean;
  name: string;
  mode: "laps" | "time";
  laps: number;
  minutes: number;
  extraLap: boolean;
  waitSeconds: number;
  joinRule: 0 | 1 | 2;
}

export interface DynamicTrack {
  enabled: boolean;
  sessionStart: number;
  randomness: number;
  sessionTransfer: number;
  lapGain: number;
}

export interface Weather {
  graphics: string;
  ambient: number;
  road: number;
  variationAmbient: number;
  variationRoad: number;
  windMin: number;
  windMax: number;
  windDirection: number;
  windDirectionVariation: number;
}

export interface SessionsConfig {
  practice: TimedSession;
  qualify: TimedSession;
  race: RaceSession;
  sunAngle: number;
  timeMultiplier: number;
  loopMode: boolean;
  raceOverSeconds: number;
  dynamicTrack: DynamicTrack;
  weathers: Weather[];
}

const SESSION_ORDER = ["PRACTICE", "QUALIFY", "RACE"];
const AFTER_SESSIONS = ["DYNAMIC_TRACK", "WEATHER_0"];

export const SUN_ANGLE_MIN = -80;
export const SUN_ANGLE_MAX = 80;

export function sunAngleToMinutes(angle: number): number {
  return Math.round(13 * 60 + (angle * 60) / 16);
}

export function minutesToSunAngle(minutes: number): number {
  return Math.round(((minutes - 13 * 60) * 16) / 60);
}

function num(v: string | null, def: number): number {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : def;
}

function readTimed(doc: IniDoc, section: string, defName: string, defMinutes: number): TimedSession {
  return {
    enabled: doc.has(section),
    name: doc.get(section, "NAME") ?? defName,
    minutes: num(doc.get(section, "TIME"), defMinutes),
    isOpen: doc.get(section, "IS_OPEN") !== "0",
  };
}

function weatherSections(doc: IniDoc): string[] {
  return doc
    .sections()
    .filter((s) => /^WEATHER_\d+$/.test(s))
    .sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)));
}

export function readSessions(text: string): SessionsConfig {
  const doc = IniDoc.parse(text);
  const laps = num(doc.get("RACE", "LAPS"), 5);
  const raceMinutes = num(doc.get("RACE", "TIME"), 0);
  const join = num(doc.get("RACE", "IS_OPEN"), 1);
  return {
    practice: readTimed(doc, "PRACTICE", "Practice", 30),
    qualify: readTimed(doc, "QUALIFY", "Qualify", 10),
    race: {
      enabled: doc.has("RACE"),
      name: doc.get("RACE", "NAME") ?? "Race",
      mode: laps <= 0 && raceMinutes > 0 ? "time" : "laps",
      laps: laps > 0 ? laps : 5,
      minutes: raceMinutes > 0 ? raceMinutes : 20,
      extraLap: doc.get("SERVER", "RACE_EXTRA_LAP") === "1",
      waitSeconds: num(doc.get("RACE", "WAIT_TIME"), 60),
      joinRule: join === 0 || join === 2 ? join : 1,
    },
    sunAngle: num(doc.get("SERVER", "SUN_ANGLE"), 16),
    timeMultiplier: num(doc.get("SERVER", "TIME_OF_DAY_MULT"), 1),
    loopMode: doc.get("SERVER", "LOOP_MODE") !== "0",
    raceOverSeconds: num(doc.get("SERVER", "RACE_OVER_TIME"), 180),
    dynamicTrack: {
      enabled: doc.has("DYNAMIC_TRACK"),
      sessionStart: num(doc.get("DYNAMIC_TRACK", "SESSION_START"), 95),
      randomness: num(doc.get("DYNAMIC_TRACK", "RANDOMNESS"), 2),
      sessionTransfer: num(doc.get("DYNAMIC_TRACK", "SESSION_TRANSFER"), 90),
      lapGain: num(doc.get("DYNAMIC_TRACK", "LAP_GAIN"), 10),
    },
    weathers: readWeathers(doc),
  };
}

const DEFAULT_WEATHER: Weather = {
  graphics: "3_clear",
  ambient: 20,
  road: 7,
  variationAmbient: 1,
  variationRoad: 1,
  windMin: 0,
  windMax: 0,
  windDirection: 0,
  windDirectionVariation: 0,
};

function readWeathers(doc: IniDoc): Weather[] {
  const list = weatherSections(doc).map((s) => ({
      graphics: doc.get(s, "GRAPHICS") ?? "3_clear",
      ambient: num(doc.get(s, "BASE_TEMPERATURE_AMBIENT"), 20),
      road: num(doc.get(s, "BASE_TEMPERATURE_ROAD"), 7),
      variationAmbient: num(doc.get(s, "VARIATION_AMBIENT"), 1),
      variationRoad: num(doc.get(s, "VARIATION_ROAD"), 1),
      windMin: num(doc.get(s, "WIND_BASE_SPEED_MIN"), 0),
      windMax: num(doc.get(s, "WIND_BASE_SPEED_MAX"), 0),
      windDirection: num(doc.get(s, "WIND_BASE_DIRECTION"), 0),
      windDirectionVariation: num(doc.get(s, "WIND_VARIATION_DIRECTION"), 0),
  }));
  return list.length ? list : [{ ...DEFAULT_WEATHER }];
}

function ensureSession(doc: IniDoc, section: string): void {
  if (doc.has(section)) return;
  const idx = SESSION_ORDER.indexOf(section);
  doc.addSection(section, [], [...SESSION_ORDER.slice(idx + 1), ...AFTER_SESSIONS]);
}

function writeTimed(doc: IniDoc, section: string, s: TimedSession): void {
  if (!s.enabled) {
    doc.removeSection(section);
    return;
  }
  ensureSession(doc, section);
  doc.set(section, "NAME", s.name);
  doc.set(section, "TIME", String(s.minutes));
  doc.set(section, "IS_OPEN", s.isOpen ? "1" : "0");
}

const WEATHER_KEYS: [keyof Weather, string][] = [
  ["graphics", "GRAPHICS"],
  ["ambient", "BASE_TEMPERATURE_AMBIENT"],
  ["road", "BASE_TEMPERATURE_ROAD"],
  ["variationAmbient", "VARIATION_AMBIENT"],
  ["variationRoad", "VARIATION_ROAD"],
  ["windMin", "WIND_BASE_SPEED_MIN"],
  ["windMax", "WIND_BASE_SPEED_MAX"],
  ["windDirection", "WIND_BASE_DIRECTION"],
  ["windDirectionVariation", "WIND_VARIATION_DIRECTION"],
];

function writeWeathers(doc: IniDoc, weathers: Weather[]): void {
  const existing = weatherSections(doc);
  const extras = existing.map((s) => doc.entries(s).filter(([k]) => !WEATHER_KEYS.some(([, key]) => key === k)));
  const insertAt = existing.length ? doc.firstHeaderIndex("WEATHER_") : -1;
  for (const s of [...existing].reverse()) doc.removeSection(s);

  const sections = weathers.map((w, i) => ({
    name: `WEATHER_${i}`,
    entries: [
      ...WEATHER_KEYS.map(([field, key]): [string, string] => [key, String(w[field])]),
      ...(extras[i] ?? []),
    ] as IniEntries,
  }));
  if (insertAt >= 0) doc.insertSectionsAt(insertAt, sections);
  else for (const s of sections) doc.addSection(s.name, s.entries);
}

export function writeSessions(text: string, s: SessionsConfig): string {
  const doc = IniDoc.parse(text);
  writeTimed(doc, "PRACTICE", s.practice);
  writeTimed(doc, "QUALIFY", s.qualify);

  if (!s.race.enabled) {
    doc.removeSection("RACE");
  } else {
    ensureSession(doc, "RACE");
    doc.set("RACE", "NAME", s.race.name);
    doc.set("RACE", "LAPS", String(s.race.mode === "laps" ? s.race.laps : 0));
    doc.set("RACE", "TIME", String(s.race.mode === "time" ? s.race.minutes : 0));
    doc.set("RACE", "WAIT_TIME", String(s.race.waitSeconds));
    doc.set("RACE", "IS_OPEN", String(s.race.joinRule));
  }

  doc.set("SERVER", "SUN_ANGLE", String(s.sunAngle));
  doc.set("SERVER", "TIME_OF_DAY_MULT", String(s.timeMultiplier));
  doc.set("SERVER", "LOOP_MODE", s.loopMode ? "1" : "0");
  doc.set("SERVER", "RACE_OVER_TIME", String(s.raceOverSeconds));
  doc.set("SERVER", "RACE_EXTRA_LAP", s.race.extraLap ? "1" : "0");

  if (!s.dynamicTrack.enabled) {
    doc.removeSection("DYNAMIC_TRACK");
  } else {
    if (!doc.has("DYNAMIC_TRACK")) doc.addSection("DYNAMIC_TRACK", [], ["WEATHER_0"]);
    doc.set("DYNAMIC_TRACK", "SESSION_START", String(s.dynamicTrack.sessionStart));
    doc.set("DYNAMIC_TRACK", "RANDOMNESS", String(s.dynamicTrack.randomness));
    doc.set("DYNAMIC_TRACK", "SESSION_TRANSFER", String(s.dynamicTrack.sessionTransfer));
    doc.set("DYNAMIC_TRACK", "LAP_GAIN", String(s.dynamicTrack.lapGain));
  }

  writeWeathers(doc, s.weathers);
  return doc.toString();
}

export async function getSessions(): Promise<SessionsConfig> {
  return readSessions(await readServerCfg());
}

export async function saveSessions(s: SessionsConfig): Promise<{ backup: string; sessions: SessionsConfig }> {
  const text = await readServerCfg();
  const next = writeSessions(text, s);
  const backup = await backupFiles([config.serverCfg]);
  await writeServerCfg(next);
  return { backup, sessions: readSessions(next) };
}
