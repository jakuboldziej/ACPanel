export function allocateSlots(cars: string[], pitboxes: number, maxSlots: number): Map<string, number> {
  if (cars.length === 0) throw new Error("No cars");
  if (cars.length > pitboxes) throw new Error(`Too many cars (${cars.length}) for ${pitboxes} pitboxes`);
  const base = Math.floor(pitboxes / cars.length);
  const extra = pitboxes % cars.length;
  const out = new Map<string, number>();
  cars.forEach((car, k) => out.set(car, Math.min(base + (k < extra ? 1 : 0), maxSlots)));
  return out;
}

export function renderEntryList(slots: Map<string, number>, eol = "\n"): { text: string; total: number } {
  const parts: string[] = [];
  let i = 0;
  for (const [model, n] of slots) {
    for (let s = 0; s < n; s++) {
      parts.push(
        [
          `[CAR_${i}]`,
          `MODEL=${model}`,
          "SKIN=",
          "SPECTATOR_MODE=0",
          "DRIVERNAME=",
          "TEAM=",
          "GUID=",
          "BALLAST=0",
          "RESTRICTOR=0",
          "",
        ].join(eol),
      );
      i++;
    }
  }
  return { text: parts.join(eol), total: i };
}
