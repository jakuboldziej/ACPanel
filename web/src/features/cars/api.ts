import { call } from "@/lib/http";

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

export const carsApi = {
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
