export interface CarInfo {
  id: string;
  name: string;
  enabled: boolean;
  empty: boolean;
  inConfig: boolean;
}

export interface CarsState {
  cars: CarInfo[];
  track: { track: string; layout: string; pitboxes: number | null };
  maxSlotsPerCar: number;
}

export interface ApplyPlan {
  enable: string[];
  disable: string[];
  slots: { car: string; slots: number }[];
  totalSlots: number;
  pitboxes: number;
}

export class ApiError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  getCars: () => call<CarsState>("/api/cars"),
  preview: (enabled: string[], maxSlotsPerCar: number) =>
    call<ApplyPlan>("/api/cars/preview", { method: "POST", body: JSON.stringify({ enabled, maxSlotsPerCar }) }),
  apply: (enabled: string[], maxSlotsPerCar: number) =>
    call<ApplyPlan & { backup: string; restartNeeded: boolean }>("/api/cars/apply", {
      method: "POST",
      body: JSON.stringify({ enabled, maxSlotsPerCar }),
    }),
};

export type PitboxSource = "manual" | "ui" | null;

export interface LayoutInfo {
  id: string;
  name: string;
  pitboxes: number | null;
  pitboxesSource: PitboxSource;
}

export interface TrackInfo {
  id: string;
  name: string;
  empty: boolean;
  hasTrackParams: boolean;
  layouts: LayoutInfo[];
}

export interface TracksState {
  current: { track: string; layout: string; pitboxes: number | null };
  enabledCars: number;
  tracks: TrackInfo[];
}

export interface TrackPlan {
  track: string;
  layout: string;
  pitboxes: number;
  slots: { car: string; slots: number }[];
  totalSlots: number;
  warnings: string[];
}

export const tracksApi = {
  get: () => call<TracksState>("/api/tracks"),
  preview: (track: string, layout: string) =>
    call<TrackPlan>("/api/tracks/preview", { method: "POST", body: JSON.stringify({ track, layout }) }),
  apply: (track: string, layout: string) =>
    call<TrackPlan & { backup: string; restartNeeded: boolean }>("/api/tracks/apply", {
      method: "POST",
      body: JSON.stringify({ track, layout }),
    }),
  setPitboxes: (track: string, layout: string, pitboxes: number | null) =>
    call<{ ok: true }>("/api/tracks/pitboxes", { method: "PUT", body: JSON.stringify({ track, layout, pitboxes }) }),
};
