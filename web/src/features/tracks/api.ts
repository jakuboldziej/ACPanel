import { call } from "@/lib/http";

export type PitboxSource = "manual" | "ui" | null;

export interface LayoutInfo {
  id: string;
  name: string;
  pitboxes: number | null;
  pitboxesSource: PitboxSource;
  hasPreview: boolean;
  hasOutline: boolean;
  hasAiLine: boolean;
  lengthMeters: number | null;
  lengthText: string | null;
}

export interface TrackInfo {
  id: string;
  name: string;
  empty: boolean;
  hasTrackParams: boolean;
  sizeBytes: number;
  country: string | null;
  city: string | null;
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
  get: () => call<TracksState>("/admin/api/tracks"),
  remove: (id: string) =>
    call<{ id: string; freedBytes: number }>(`/admin/api/tracks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  preview: (track: string, layout: string) =>
    call<TrackPlan>("/admin/api/tracks/preview", { method: "POST", body: JSON.stringify({ track, layout }) }),
  apply: (track: string, layout: string) =>
    call<TrackPlan & { backup: string; restartNeeded: boolean }>("/admin/api/tracks/apply", {
      method: "POST",
      body: JSON.stringify({ track, layout }),
    }),
  setPitboxes: (track: string, layout: string, pitboxes: number | null) =>
    call<{ ok: true }>("/admin/api/tracks/pitboxes", { method: "PUT", body: JSON.stringify({ track, layout, pitboxes }) }),
};
