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
