import { describe, expect, it } from "vitest";
import { parseYaml, stringifyYaml, validateAgainst } from "../src/lib/yamlFile.js";

const EXTRA = [
  "# Force headlights on for all cars",
  "ForceLights: false",
  "# List of plugins to enable",
  "EnablePlugins: ",
  "# Ignore some common configuration errors",
  "IgnoreConfigurationErrors:",
  "  MissingCarChecksums: false",
  "",
].join("\n");

describe("comment-preserving YAML", () => {
  it("round-trips without changes (ignoring trailing spaces)", () => {
    expect(stringifyYaml(parseYaml(EXTRA))).toBe(EXTRA.replace("EnablePlugins: ", "EnablePlugins:"));
  });

  it("keeps the comment of the next key when setting a null value", () => {
    const doc = parseYaml(EXTRA);
    doc.set("EnablePlugins", ["VotingWeatherPlugin"]);
    const out = stringifyYaml(doc);
    expect(out).toContain("EnablePlugins:\n  - VotingWeatherPlugin\n# Ignore some common configuration errors\n");
  });

  it("reports YAML syntax errors with a line number", () => {
    expect(() => parseYaml("a: [1\n")).toThrow(/line/);
  });
});

describe("validateAgainst", () => {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: { a: { type: "integer" } },
  };

  it("accepts valid documents and skips without a schema", () => {
    expect(() => validateAgainst(schema, parseYaml("a: 1\n"))).not.toThrow();
    expect(() => validateAgainst(null, parseYaml("anything: x\n"))).not.toThrow();
  });

  it("lists unknown keys and type errors", () => {
    expect(() => validateAgainst(schema, parseYaml("a: x\nb: 1\n"))).toThrow(/unknown key "b"[\s\S]*a: must be integer/);
  });
});
