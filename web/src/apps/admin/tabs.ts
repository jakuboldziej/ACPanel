import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { TabId } from "./tabIds";

interface TabDefinition {
  label: string;
  load: () => Promise<{ default: ComponentType }>;
}

const definitions: Record<TabId, TabDefinition> = {
  cars: { label: "Cars", load: () => import("@/features/cars/CarsPage").then((m) => ({ default: m.CarsPage })) },
  tracks: { label: "Tracks", load: () => import("@/features/tracks/TracksPage").then((m) => ({ default: m.TracksPage })) },
  sessions: { label: "Sessions", load: () => import("@/features/sessions/SessionsPage").then((m) => ({ default: m.SessionsPage })) },
  rules: { label: "Rules", load: () => import("@/features/rules/RulesPage").then((m) => ({ default: m.RulesPage })) },
  presets: { label: "Presets", load: () => import("@/features/presets/PresetsPage").then((m) => ({ default: m.PresetsPage })) },
  plugins: { label: "Plugins", load: () => import("@/features/plugins/PluginsPage").then((m) => ({ default: m.PluginsPage })) },
  settings: { label: "Settings", load: () => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })) },
  mods: { label: "Mods", load: () => import("@/features/mods/ModsPage").then((m) => ({ default: m.ModsPage })) },
  logs: { label: "Logs", load: () => import("@/features/logs/LogsPage").then((m) => ({ default: m.LogsPage })) },
};

export interface Tab {
  id: TabId;
  label: string;
  Page: LazyExoticComponent<ComponentType>;
  preload: () => void;
}

export const TABS: Tab[] = (Object.entries(definitions) as [TabId, TabDefinition][]).map(([id, def]) => ({
  id,
  label: def.label,
  Page: lazy(def.load),
  preload: () => void def.load(),
}));
