

export function angleToTime(angle: number): string {
  const m = Math.round(13 * 60 + (angle * 60) / 16);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function timeToAngle(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const angle = Math.round((((h ?? 13) * 60 + (m ?? 0) - 13 * 60) * 16) / 60);
  return Math.max(-80, Math.min(80, angle));
}
