import fs from "node:fs/promises";

export type UiJson = Record<string, unknown>;

export async function readUiJson(file: string): Promise<UiJson | null> {
  let text: string;
  try {
    text = (await fs.readFile(file, "utf8")).replace(/^﻿/, "");
  } catch {
    return null;
  }
  const attempts = [
    text,
    text.replace(/[\u0000-\u001f]/g, " "),
    text.replace(/[\u0000-\u001f]/g, " ").replace(/,\s*([}\]])/g, "$1"),
  ];
  for (const t of attempts) {
    try {
      const v = JSON.parse(t) as unknown;
      if (v && typeof v === "object" && !Array.isArray(v)) return v as UiJson;
    } catch {
      continue;
    }
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

export interface CarSpecs {
  bhp: string | null;
  weight: string | null;
  topspeed: string | null;
  pwratio: string | null;
}

export interface CarMeta {
  name: string | null;
  brand: string | null;
  carClass: string | null;
  tags: string[];
  specs: CarSpecs;
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").toLowerCase();
}

export function carMeta(ui: UiJson | null): CarMeta {
  const specs = (ui?.specs && typeof ui.specs === "object" ? ui.specs : {}) as Record<string, unknown>;
  const tags = Array.isArray(ui?.tags) ? ui.tags.map(String).map(normalizeTag).filter(Boolean) : [];
  return {
    name: str(ui?.name),
    brand: str(ui?.brand),
    carClass: str(ui?.class)?.toLowerCase() ?? null,
    tags: [...new Set(tags)],
    specs: {
      bhp: str(specs.bhp),
      weight: str(specs.weight),
      topspeed: str(specs.topspeed),
      pwratio: str(specs.pwratio),
    },
  };
}

export interface TrackMeta {
  name: string | null;
  lengthMeters: number | null;
  lengthText: string | null;
  country: string | null;
  city: string | null;
}

function parseLength(raw: string): number | null {
  const m = /^(\d+(?:[.,]\d+)?)\s*(km|m)?$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  const meters = m[2]?.toLowerCase() === "km" ? n * 1000 : n;
  return meters > 0 ? meters : null;
}

export function trackMeta(ui: UiJson | null): TrackMeta {
  const raw = str(ui?.length);
  const meters = raw ? parseLength(raw) : null;
  return {
    name: str(ui?.name),
    lengthMeters: meters,
    lengthText: meters ? null : raw,
    country: str(ui?.country),
    city: str(ui?.city),
  };
}
