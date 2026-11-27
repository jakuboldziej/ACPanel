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
  pendingRestart: PendingRestart | null;
}

export interface PendingRestart {
  at: string;
  warnSeconds: number;
}

export const serverApi = {
  status: () => call<ServiceStatus>("/admin/api/server/status"),
  restart: (warnSeconds = 0) =>
    call<ServiceStatus & { ready: boolean }>("/admin/api/server/restart", {
      method: "POST",
      body: JSON.stringify({ warnSeconds }),
    }),
  cancelRestart: () => call<ServiceStatus>("/admin/api/server/restart/cancel", { method: "POST" }),
  logs: (lines: number) => call<{ lines: string[] }>(`/admin/api/server/logs?lines=${lines}`),
};
