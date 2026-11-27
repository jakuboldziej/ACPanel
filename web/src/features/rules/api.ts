import { call } from "@/lib/http";

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
