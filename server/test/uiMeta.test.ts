import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { carMeta, normalizeTag, readUiJson, trackMeta } from "../src/lib/uiMeta.js";
import { tmpDir } from "./helpers.js";

describe("ui_*.json parsing", () => {
  it("tolerates trailing commas, raw newlines and a BOM", async () => {
    const file = path.join(tmpDir(), "ui_car.json");
    fs.writeFileSync(file, '﻿{ "name": "Škoda\nOctavia", "tags": ["#GT3", "gt3", "RWD",], }');
    const ui = await readUiJson(file);
    expect(ui?.name).toBe("Škoda Octavia");
    expect(carMeta(ui).tags).toEqual(["gt3", "rwd"]);
  });

  it("returns null for missing files", async () => {
    expect(await readUiJson("/nonexistent/ui_car.json")).toBeNull();
  });

  it("normalizes tags", () => {
    expect(normalizeTag("  ##GTE-GT3 ")).toBe("gte-gt3");
  });

  it("parses track lengths in m and km", () => {
    expect(trackMeta({ length: "7004" }).lengthMeters).toBe(7004);
    expect(trackMeta({ length: "4083m" }).lengthMeters).toBe(4083);
    expect(trackMeta({ length: "20,8km" }).lengthMeters).toBe(20800);
    expect(trackMeta({ length: 12 }).lengthMeters).toBe(12);
    expect(trackMeta({ length: "about 5 km" })).toMatchObject({ lengthMeters: null, lengthText: "about 5 km" });
  });
});
