export const TAB_IDS = ["players", "cars", "tracks", "sessions", "rules", "presets", "plugins", "settings", "mods", "logs"] as const;

export type TabId = (typeof TAB_IDS)[number];

export function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}
