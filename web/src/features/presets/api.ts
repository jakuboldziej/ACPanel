import { call } from "@/lib/http";

export interface PresetInfo {
  name: string;
  serverName: string | null;
  track: string;
  layout: string;
  cars: string[];
  slots: number;
  sessions: string;
  files: string[];
  modifiedAt: string;
  active: boolean;
  missingCars: string[];
  missingTrack: boolean;
}

export const presetsApi = {
  list: () => call<{ presets: PresetInfo[] }>("/admin/api/presets"),
  save: (name: string, overwrite: boolean) =>
    call<{ presets: PresetInfo[] }>("/admin/api/presets", { method: "POST", body: JSON.stringify({ name, overwrite }) }),
  apply: (name: string) =>
    call<{ backup: string; enabled: string[]; disabled: string[] }>(`/admin/api/presets/${encodeURIComponent(name)}/apply`, {
      method: "POST",
    }),
  remove: (name: string) => call<{ ok: true }>(`/admin/api/presets/${encodeURIComponent(name)}`, { method: "DELETE" }),
};
