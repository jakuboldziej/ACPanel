import { describe, expect, it } from "vitest";
import { IniDoc } from "../src/core/ini.js";

const SAMPLE = ["[SERVER]", "NAME=Test", "; comment", "", "[RACE]", "LAPS=5", "", ";[OLD]", ";X=1", ""].join("\r\n");

describe("IniDoc", () => {
  it("round-trips unchanged text including CRLF and comments", () => {
    expect(IniDoc.parse(SAMPLE).toString()).toBe(SAMPLE);
  });

  it("reads keys case-insensitively and ignores commented sections", () => {
    const doc = IniDoc.parse(SAMPLE);
    expect(doc.get("server", "name")).toBe("Test");
    expect(doc.get("RACE", "LAPS")).toBe("5");
    expect(doc.sections()).toEqual(["SERVER", "RACE"]);
    expect(doc.has("OLD")).toBe(false);
  });

  it("updates existing keys in place and appends new ones after the last key", () => {
    const doc = IniDoc.parse(SAMPLE);
    doc.set("SERVER", "NAME", "New");
    doc.set("SERVER", "PORT", "9600");
    expect(doc.toString()).toBe(
      ["[SERVER]", "NAME=New", "PORT=9600", "; comment", "", "[RACE]", "LAPS=5", "", ";[OLD]", ";X=1", ""].join("\r\n"),
    );
  });

  it("removes a section but keeps trailing comments", () => {
    const doc = IniDoc.parse(SAMPLE);
    doc.removeSection("RACE");
    expect(doc.toString()).toBe(["[SERVER]", "NAME=Test", "; comment", "", ";[OLD]", ";X=1", ""].join("\r\n"));
  });

  it("adds a section before another one", () => {
    const doc = IniDoc.parse("[A]\nX=1\n\n[C]\nZ=3\n");
    doc.addSection("B", [["Y", "2"]], ["C"]);
    expect(doc.toString()).toBe("[A]\nX=1\n\n[B]\nY=2\n\n[C]\nZ=3\n");
  });

  it("adds a section at the end with one blank line before it", () => {
    const doc = IniDoc.parse("[A]\nX=1\n");
    doc.addSection("B", [["Y", "2"]]);
    expect(doc.toString()).toBe("[A]\nX=1\n\n[B]\nY=2\n");
  });

  it("refuses to add a duplicate section", () => {
    expect(() => IniDoc.parse("[A]\n").addSection("a", [])).toThrow();
  });
});
