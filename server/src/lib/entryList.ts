import { config } from "../config.js";
import { writeAtomic } from "./fsutil.js";
import { readServerCfg, setServerKeys, writeServerCfg } from "./serverCfg.js";

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

export async function writeEntries(slots: Map<string, number>, extraKeys: Record<string, string> = {}): Promise<number> {
  const ini = await readServerCfg();
  const eol = ini.includes("\r\n") ? "\r\n" : "\n";
  const { text, total } = renderEntryList(slots, eol);
  await writeAtomic(config.entryList, text);
  await writeServerCfg(
    setServerKeys(ini, { ...extraKeys, CARS: [...slots.keys()].join(";"), MAX_CLIENTS: String(total) }),
  );
  return total;
}
