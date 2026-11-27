import { call } from "@/lib/http";

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
