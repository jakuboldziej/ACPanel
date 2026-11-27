export interface CarInfo {
  id: string;
  name: string;
  enabled: boolean;
  empty: boolean;
  inConfig: boolean;
  sizeBytes: number;
  image: "preview" | "badge" | null;
  brand: string | null;
  carClass: string | null;
  tags: string[];
  specs: { bhp: string | null; weight: string | null; topspeed: string | null; pwratio: string | null } | null;
  missingDataAcd: boolean;
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
  if (res.status === 401 && !url.startsWith("/admin/api/auth/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  if (!res.ok) throw new ApiError(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  getCars: () => call<CarsState>("/admin/api/cars"),
  deleteCar: (id: string) =>
    call<{ id: string; freedBytes: number }>(`/admin/api/cars/${encodeURIComponent(id)}`, { method: "DELETE" }),
  preview: (enabled: string[], maxSlotsPerCar: number) =>
    call<ApplyPlan>("/admin/api/cars/preview", { method: "POST", body: JSON.stringify({ enabled, maxSlotsPerCar }) }),
  apply: (enabled: string[], maxSlotsPerCar: number) =>
    call<ApplyPlan & { backup: string; restartNeeded: boolean }>("/admin/api/cars/apply", {
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
  disk: { path: string; freeBytes: number; totalBytes: number } | null;
}

export const serverApi = {
  status: () => call<ServiceStatus>("/admin/api/server/status"),
  restart: () => call<ServiceStatus & { ready: boolean }>("/admin/api/server/restart", { method: "POST" }),
  logs: (lines: number) => call<{ lines: string[] }>(`/admin/api/server/logs?lines=${lines}`),
};

export const authApi = {
  me: () => call<{ loggedIn: boolean }>("/admin/api/auth/me"),
  login: (password: string) =>
    call<{ loggedIn: true }>("/admin/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => call<{ loggedIn: false }>("/admin/api/auth/logout", { method: "POST" }),
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
  list: () => call<{ plugins: PluginInfo[]; extraCfgExists: boolean }>("/admin/api/plugins"),
  setEnabled: (enabled: string[]) =>
    call<{ backup: string; enabled: string[] }>("/admin/api/plugins", { method: "PUT", body: JSON.stringify({ enabled }) }),
  getConfig: (name: string) => call<PluginConfig>(`/admin/api/plugins/${encodeURIComponent(name)}/config`),
  saveConfig: (name: string, yaml: string) =>
    call<{ backup: string | null }>(`/admin/api/plugins/${encodeURIComponent(name)}/config`, {
      method: "PUT",
      body: JSON.stringify({ yaml }),
    }),
  fromReference: (name: string) =>
    call<PluginConfig>(`/admin/api/plugins/${encodeURIComponent(name)}/config/from-reference`, { method: "POST" }),
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
  get: () => call<ExtraConfig>("/admin/api/extra-config"),
  saveValues: (values: Record<string, FieldValue>) =>
    call<{ backup: string }>("/admin/api/extra-config/values", { method: "PUT", body: JSON.stringify({ values }) }),
  saveRaw: (yaml: string) =>
    call<{ backup: string }>("/admin/api/extra-config/raw", { method: "PUT", body: JSON.stringify({ yaml }) }),
};

export type UploadStatus = "uploading" | "extracting" | "ready" | "installing" | "installed" | "failed";

export interface ModItem {
  key: string;
  kind: "car" | "track";
  id: string;
  name: string;
  relPath: string;
  sizeBytes: number;
  existing: "enabled" | "disabled" | "installed" | null;
  validId: boolean;
  image: "preview" | "badge" | null;
  warnings: string[];
}

export interface UploadView {
  id: string;
  fileName: string;
  size: number;
  chunks: number;
  receivedChunks: number;
  status: UploadStatus;
  error: string | null;
  items: ModItem[];
  createdAt: number;
}

export interface UploadSettings {
  chunkSize: number;
  maxUploadMb: number;
  lanUrl: string | null;
  extensions: string[];
}

export interface InstallResult {
  key: string;
  kind: "car" | "track";
  id: string;
  target: string;
  replacedBackup: string | null;
  slimmedBytes: number;
}

export const modsApi = {
  settings: () => call<UploadSettings>("/admin/api/mods/settings"),
  list: () => call<{ uploads: UploadView[] }>("/admin/api/mods/uploads"),
  create: (fileName: string, size: number) =>
    call<UploadView & { chunkSize: number }>("/admin/api/mods/uploads", {
      method: "POST",
      body: JSON.stringify({ fileName, size }),
    }),
  complete: (id: string) => call<UploadView>(`/admin/api/mods/uploads/${id}/complete`, { method: "POST" }),
  get: (id: string) => call<UploadView>(`/admin/api/mods/uploads/${id}`),
  install: (id: string, items: { key: string; overwrite: boolean }[], slim: boolean) =>
    call<{ installed: InstallResult[] }>(`/admin/api/mods/uploads/${id}/install`, {
      method: "POST",
      body: JSON.stringify({ items, slim }),
    }),
  remove: (id: string) => call<{ ok: true }>(`/admin/api/mods/uploads/${id}`, { method: "DELETE" }),
};

export function uploadChunk(
  id: string,
  index: number,
  blob: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/admin/api/mods/uploads/${id}/chunks/${index}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      let message = `HTTP ${xhr.status}`;
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        message = `HTTP ${xhr.status}`;
      }
      reject(new ApiError(message));
    };
    xhr.onerror = () => reject(new ApiError("Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

export interface Rules {
  cutPenalties: boolean;
  allowedTyresOut: number;
  gasPenalty: boolean;
  startRule: 0 | 1 | 2;
  contactLimit: boolean;
  maxContactsPerKm: number;
}

export const rulesApi = {
  get: () => call<Rules>("/admin/api/rules"),
  save: (rules: Rules) => call<{ backup: string; rules: Rules }>("/admin/api/rules", { method: "PUT", body: JSON.stringify(rules) }),
};

export interface TimedSession {
  enabled: boolean;
  name: string;
  minutes: number;
  isOpen: boolean;
}

export interface Weather {
  graphics: string;
  ambient: number;
  road: number;
  variationAmbient: number;
  variationRoad: number;
  windMin: number;
  windMax: number;
  windDirection: number;
  windDirectionVariation: number;
}

export interface SessionsConfig {
  practice: TimedSession;
  qualify: TimedSession;
  race: {
    enabled: boolean;
    name: string;
    mode: "laps" | "time";
    laps: number;
    minutes: number;
    extraLap: boolean;
    waitSeconds: number;
    joinRule: 0 | 1 | 2;
  };
  sunAngle: number;
  timeMultiplier: number;
  loopMode: boolean;
  raceOverSeconds: number;
  dynamicTrack: { enabled: boolean; sessionStart: number; randomness: number; sessionTransfer: number; lapGain: number };
  weathers: Weather[];
}

export const sessionsApi = {
  get: () => call<SessionsConfig>("/admin/api/sessions"),
  save: (s: SessionsConfig) =>
    call<{ backup: string; sessions: SessionsConfig }>("/admin/api/sessions", { method: "PUT", body: JSON.stringify(s) }),
};

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
