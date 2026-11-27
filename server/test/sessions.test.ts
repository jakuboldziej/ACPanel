import { describe, expect, it } from "vitest";
import { minutesToSunAngle, readSessions, sunAngleToMinutes, writeSessions } from "../src/modules/sessions/service.js";

const CFG = [
  "[SERVER]",
  "NAME=Test",
  "SUN_ANGLE=48",
  "",
  "[PRACTICE]",
  "NAME=Practice",
  "TIME=120",
  "IS_OPEN=1",
  "",
  "[QUALIFY]",
  "NAME=Qualify",
  "TIME=10",
  "IS_OPEN=1",
  "",
  "[RACE]",
  "NAME=Race",
  "LAPS=5",
  "WAIT_TIME=30",
  "IS_OPEN=1",
  "",
  "[DYNAMIC_TRACK]",
  "SESSION_START=95",
  "RANDOMNESS=2",
  "SESSION_TRANSFER=90",
  "LAP_GAIN=10",
  "",
  "[WEATHER_0]",
  "GRAPHICS=3_clear",
  "BASE_TEMPERATURE_AMBIENT=26",
  "BASE_TEMPERATURE_ROAD=12",
  "VARIATION_AMBIENT=1",
  "VARIATION_ROAD=1",
  "",
  ";[WEATHER_1]",
  ";GRAPHICS=7_heavy_clouds",
  "",
].join("\r\n");

describe("sun angle", () => {
  it("maps 48 to 16:00 and back", () => {
    expect(sunAngleToMinutes(48)).toBe(16 * 60);
    expect(minutesToSunAngle(16 * 60)).toBe(48);
    expect(sunAngleToMinutes(-80)).toBe(8 * 60);
    expect(sunAngleToMinutes(80)).toBe(18 * 60);
  });
});

describe("sessions", () => {
  it("reads sessions, dynamic track and weather", () => {
    const s = readSessions(CFG);
    expect(s.practice).toMatchObject({ enabled: true, minutes: 120 });
    expect(s.race).toMatchObject({ enabled: true, mode: "laps", laps: 5, waitSeconds: 30 });
    expect(s.dynamicTrack.sessionStart).toBe(95);
    expect(s.weathers).toHaveLength(1);
    expect(s.weathers[0]).toMatchObject({ graphics: "3_clear", ambient: 26, road: 12 });
  });

  it("gives a default weather when the file has none", () => {
    expect(readSessions("[SERVER]\nNAME=x\n").weathers).toHaveLength(1);
  });

  it("round-trips through writeSessions", () => {
    const s = readSessions(CFG);
    expect(readSessions(writeSessions(CFG, s))).toEqual(s);
  });

  it("removes disabled sessions, switches to a timed race and renumbers weather", () => {
    const s = readSessions(CFG);
    s.qualify.enabled = false;
    s.dynamicTrack.enabled = false;
    s.race.mode = "time";
    s.race.minutes = 25;
    s.weathers.push({ ...s.weathers[0]!, graphics: "7_heavy_clouds" });
    const out = writeSessions(CFG, s);
    expect(out).not.toContain("[QUALIFY]");
    expect(out).not.toContain("[DYNAMIC_TRACK]");
    expect(out).toMatch(/LAPS=0\r\n/);
    expect(out).toMatch(/TIME=25\r\n/);
    expect(out).toContain("[WEATHER_1]\r\nGRAPHICS=7_heavy_clouds");
    expect(out).toContain(";[WEATHER_1]\r\n;GRAPHICS=7_heavy_clouds");
    expect(out).not.toMatch(/\n\n/);
  });

  it("re-adds a session in the right order", () => {
    const s = readSessions(CFG);
    s.qualify.enabled = false;
    const without = writeSessions(CFG, s);
    s.qualify.enabled = true;
    const back = writeSessions(without, s);
    expect(back.indexOf("[PRACTICE]")).toBeLessThan(back.indexOf("[QUALIFY]"));
    expect(back.indexOf("[QUALIFY]")).toBeLessThan(back.indexOf("[RACE]"));
  });
});
