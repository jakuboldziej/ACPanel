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

export const UNAUTHORIZED_EVENT = "acpanel:unauthorized";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
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

export interface LiveInfo {
  name: string;
  track: string;
  clients: number;
  maxClients: number;
  cars: string[];
}

export interface ServiceStatus {
  managed: boolean;
  unit: string;
  active: boolean;
  state: string;
  pid: number | null;
  since: string | null;
  live: LiveInfo | null;
  configChangedAt: string | null;
  restartRequired: boolean;
}

export const serverApi = {
  status: () => call<ServiceStatus>("/api/server/status"),
  restart: () => call<ServiceStatus & { ready: boolean }>("/api/server/restart", { method: "POST" }),
  logs: (lines: number) => call<{ lines: string[] }>(`/api/server/logs?lines=${lines}`),
};

export const authApi = {
  me: () => call<{ loggedIn: boolean }>("/api/auth/me"),
  login: (password: string) =>
    call<{ loggedIn: true }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => call<{ loggedIn: false }>("/api/auth/logout", { method: "POST" }),
};

export interface PluginInfo {
  name: string;
  installed: boolean;
  enabled: boolean;
  configFile: string | null;
  configExists: boolean;
  referenceExists: boolean;
  schemaExists: boolean;
}

export interface PluginConfig {
  name: string;
  file: string | null;
  exists: boolean;
  yaml: string;
  reference: string | null;
  hasSchema: boolean;
}

export const pluginsApi = {
  list: () => call<{ plugins: PluginInfo[]; extraCfgExists: boolean }>("/api/plugins"),
  setEnabled: (enabled: string[]) =>
    call<{ backup: string; enabled: string[] }>("/api/plugins", { method: "PUT", body: JSON.stringify({ enabled }) }),
  getConfig: (name: string) => call<PluginConfig>(`/api/plugins/${encodeURIComponent(name)}/config`),
  saveConfig: (name: string, yaml: string) =>
    call<{ backup: string | null }>(`/api/plugins/${encodeURIComponent(name)}/config`, {
      method: "PUT",
      body: JSON.stringify({ yaml }),
    }),
  fromReference: (name: string) =>
    call<PluginConfig>(`/api/plugins/${encodeURIComponent(name)}/config/from-reference`, { method: "POST" }),
};

export type FieldValue = boolean | number | string | null;

export interface FieldInfo {
  key: string;
  type: "boolean" | "integer" | "number" | "string";
  nullable: boolean;
  description: string;
  default: FieldValue | undefined;
  enum: string[] | null;
}

export interface ExtraConfig {
  yaml: string;
  fields: FieldInfo[];
  values: Record<string, FieldValue>;
  hasSchema: boolean;
}

export const extraConfigApi = {
  get: () => call<ExtraConfig>("/api/extra-config"),
  saveValues: (values: Record<string, FieldValue>) =>
    call<{ backup: string }>("/api/extra-config/values", { method: "PUT", body: JSON.stringify({ values }) }),
  saveRaw: (yaml: string) =>
    call<{ backup: string }>("/api/extra-config/raw", { method: "PUT", body: JSON.stringify({ yaml }) }),
};
