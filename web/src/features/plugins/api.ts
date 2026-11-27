import { call } from "@/lib/http";

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
