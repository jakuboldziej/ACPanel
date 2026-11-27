import { HttpError } from "../../core/fsutil.js";
import { withLock } from "../../core/lock.js";
import { rcon } from "../players/rcon.js";
import { restartService } from "./service.js";

const CHECKPOINTS = [300, 120, 60, 30, 10];

interface Pending {
  at: number;
  warnSeconds: number;
  timers: NodeJS.Timeout[];
}

let pending: Pending | null = null;

export interface PendingRestart {
  at: string;
  warnSeconds: number;
}

export function pendingRestart(): PendingRestart | null {
  return pending ? { at: new Date(pending.at).toISOString(), warnSeconds: pending.warnSeconds } : null;
}

function label(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `${seconds} seconds`;
}

async function announce(text: string): Promise<void> {
  await rcon(`say ${text}`);
}

export async function scheduleRestart(warnSeconds: number): Promise<PendingRestart | null> {
  if (pending) throw new HttpError(409, "A restart is already scheduled");
  if (warnSeconds <= 0) throw new HttpError(400, "Use an immediate restart for 0 seconds");
  await announce(`Server restart in ${label(warnSeconds)}`).catch((e: Error) => {
    throw new HttpError(409, `Cannot warn players: ${e.message}`);
  });

  const at = Date.now() + warnSeconds * 1000;
  const timers = CHECKPOINTS.filter((s) => s < warnSeconds).map((s) =>
    setTimeout(() => void announce(`Server restart in ${label(s)}`).catch(() => {}), (warnSeconds - s) * 1000),
  );
  timers.push(
    setTimeout(() => {
      pending = null;
      void withLock(() => restartService()).catch((e: Error) => console.error("Scheduled restart failed:", e.message));
    }, warnSeconds * 1000),
  );
  pending = { at, warnSeconds, timers };
  return pendingRestart();
}

export async function cancelRestart(): Promise<void> {
  if (!pending) throw new HttpError(409, "No restart is scheduled");
  pending.timers.forEach(clearTimeout);
  pending = null;
  await announce("Server restart cancelled").catch(() => {});
}
