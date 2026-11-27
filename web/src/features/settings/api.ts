import { call } from "@/lib/http";

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
