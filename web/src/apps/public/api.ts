export type SessionType = "booking" | "practice" | "qualify" | "race";

export interface PublicStatus {
  online: boolean;
  name: string | null;
  description: string | null;
  location: string | null;
  track: { id: string; layout: string; name: string; lengthMeters: number | null } | null;
  session: { type: SessionType; timeLeftSeconds: number | null; raceLaps: number | null } | null;
  players: { count: number; max: number; list: { name: string; car: string; carName: string }[] };
  weather: { ambient: number; road: number } | null;
  joinUrl: string | null;
  passwordProtected: boolean;
}

export async function getStatus(): Promise<PublicStatus> {
  const res = await fetch("/api/public/status");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PublicStatus;
}
