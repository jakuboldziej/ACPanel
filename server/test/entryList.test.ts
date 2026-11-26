import { describe, expect, it } from "vitest";
import { allocateSlots, renderEntryList } from "../src/lib/entryList.js";

describe("allocateSlots", () => {
  it("spreads pitboxes evenly, earlier cars get the remainder", () => {
    expect([...allocateSlots(["a", "b", "c"], 10, 10)]).toEqual([
      ["a", 4],
      ["b", 3],
      ["c", 3],
    ]);
  });

  it("caps slots per car", () => {
    expect([...allocateSlots(["a", "b"], 24, 3).values()]).toEqual([3, 3]);
  });

  it("matches genEntries.sh for 14 cars on 24 pitboxes", () => {
    const cars = Array.from({ length: 14 }, (_, i) => `car${i}`);
    const total = [...allocateSlots(cars, 24, 3).values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(24);
  });

  it("rejects more cars than pitboxes and empty lists", () => {
    expect(() => allocateSlots(["a", "b", "c"], 2, 3)).toThrow(/Too many cars/);
    expect(() => allocateSlots([], 10, 3)).toThrow();
  });
});

describe("renderEntryList", () => {
  it("numbers CAR_n sequentially and counts slots", () => {
    const { text, total } = renderEntryList(new Map([["a", 2], ["b", 1]]));
    expect(total).toBe(3);
    expect(text.match(/\[CAR_\d+\]/g)).toEqual(["[CAR_0]", "[CAR_1]", "[CAR_2]"]);
    expect(text).toContain("MODEL=b");
  });
});
