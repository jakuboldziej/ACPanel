import type { LayoutInfo } from "./api";

export function label(track: string, layout: string) {
  return layout ? `${track} / ${layout}` : track;
}

export function formatLength(layout: LayoutInfo): string | null {
  if (layout.lengthMeters) return `${(layout.lengthMeters / 1000).toFixed(layout.lengthMeters >= 10000 ? 1 : 2)} km`;
  return layout.lengthText;
}
