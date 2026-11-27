import path from "node:path";
import { config } from "../config.js";
import { readUiJson } from "./uiMeta.js";

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { name: string; at: number }>();

export async function carDisplayName(model: string): Promise<string> {
  const hit = cache.get(model);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.name;
  let name = model;
  for (const dir of [config.carsDir, config.carsOffDir]) {
    const ui = await readUiJson(path.join(dir, model, "ui", "ui_car.json"));
    if (typeof ui?.name === "string" && ui.name.trim()) {
      name = ui.name.trim();
      break;
    }
  }
  cache.set(model, { name, at: Date.now() });
  return name;
}
