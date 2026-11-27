import { call } from "@/lib/http";

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
