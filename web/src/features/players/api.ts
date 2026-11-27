import { call } from "@/lib/http";

export interface Player {
  sessionId: number;
  name: string;
  team: string | null;
  nation: string | null;
  steamId: string | null;
  car: string;
  carName: string;
  skin: string | null;
  connectedSince: string | null;
}

export interface RconStatus {
  port: number;
  enabled: boolean;
  reachable: boolean;
  error: string | null;
}

export interface Ban {
  steamId: string;
  name: string | null;
  reason: string | null;
  bannedAt: string | null;
}

const BASE = "/admin/api/players";
const post = <T,>(url: string, body: unknown = {}) => call<T>(url, { method: "POST", body: JSON.stringify(body) });

export const playersApi = {
  list: () => call<{ online: boolean; players: Player[] }>(BASE),
  rcon: () => call<RconStatus>(`${BASE}/rcon`),
  enableRcon: () => post<{ backup: string; port: number }>(`${BASE}/rcon/enable`),
  kick: (sessionId: number, reason: string) => post<{ reply: string }>(`${BASE}/${sessionId}/kick`, { reason }),
  ban: (sessionId: number, reason: string) => post<{ reply: string }>(`${BASE}/${sessionId}/ban`, { reason }),
  chat: (message: string) => post<{ reply: string }>(`${BASE}/chat`, { message }),
  nextSession: () => post<{ reply: string }>(`${BASE}/session/next`),
  restartSession: () => post<{ reply: string }>(`${BASE}/session/restart`),
  setTime: (time: string) => post<{ reply: string }>(`${BASE}/time`, { time }),
  bans: () => call<{ bans: Ban[] }>(`${BASE}/bans`),
  addBan: (steamId: string, reason: string | null) => post<{ bans: Ban[] }>(`${BASE}/bans`, { steamId, reason }),
  unban: (steamId: string) => call<{ bans: Ban[] }>(`${BASE}/bans/${steamId}`, { method: "DELETE" }),
};
