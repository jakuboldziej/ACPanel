import { describe, expect, it } from "vitest";
import { getServerKey, setServerKeys } from "../src/core/serverCfg.js";

describe("server_cfg [SERVER] helpers", () => {
  const ini = "[SERVER]\r\nNAME=x\r\nMAX_CLIENTS=9\r\n\r\n[PRACTICE]\r\nTIME=60\r\n";

  it("reads only from the SERVER section", () => {
    expect(getServerKey(ini, "NAME")).toBe("x");
    expect(getServerKey(ini, "TIME")).toBeNull();
  });

  it("updates keys and appends new ones before the blank line", () => {
    expect(setServerKeys(ini, { NAME: "y", START_RULE: "2" })).toBe(
      "[SERVER]\r\nNAME=y\r\nMAX_CLIENTS=9\r\nSTART_RULE=2\r\n\r\n[PRACTICE]\r\nTIME=60\r\n",
    );
  });

  it("appends when SERVER is the last section", () => {
    expect(setServerKeys("[PRACTICE]\nTIME=1\n[SERVER]\nNAME=x\n", { A: "1" })).toBe(
      "[PRACTICE]\nTIME=1\n[SERVER]\nNAME=x\nA=1\n",
    );
  });

  it("fails without a SERVER section", () => {
    expect(() => setServerKeys("[RACE]\n", { A: "1" })).toThrow(/SERVER/);
  });
});
