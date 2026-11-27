import { formatBytes } from "./format";
import { Button } from "@/components/ui/button";
import { useServer } from "./ServerContext";

function trackLabel(track: string): string {
  return track.split("/").pop() ?? track;
}

function since(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

export function StatusBar() {
  const { status, restarting, restart } = useServer();
  if (!status) return <div className="status muted">…</div>;

  if (!status.managed) {
    return (
      <div className="status">
        <span className="dot off" />
        <span className="muted">Server control disabled</span>
        <DiskBadge />
      </div>
    );
  }

  const online = status.active && status.live;
  const dotClass = restarting ? "busy" : online ? "on" : status.active ? "busy" : "off";

  return (
    <div className="status">
      <span className={`dot ${dotClass}`} />
      <span>
        {restarting
          ? "Restarting…"
          : online
            ? `${status.live!.clients}/${status.live!.maxClients} players · ${trackLabel(status.live!.track)}`
            : status.active
              ? status.since && Date.now() - new Date(status.since).getTime() > 60000
                ? "Running · no response from /INFO"
                : "Starting…"
              : `Offline (${status.state})`}
      </span>
      {status.active && !restarting && <span className="muted">up {since(status.since)}</span>}
      <DiskBadge />
      {status.restartRequired && !restarting && <span className="tag warn">Restart required</span>}
      <Button variant={status.restartRequired ? "default" : "outline"} disabled={restarting} onClick={() => void restart()}>
        {restarting ? "Restarting…" : "Restart"}
      </Button>
    </div>
  );
}

function DiskBadge() {
  const { status } = useServer();
  const disk = status?.disk;
  if (!disk) return null;
  const low = disk.freeBytes / disk.totalBytes < 0.1;
  return (
    <span className={low ? "tag warn" : "muted"} title={`Content disk: ${disk.path}`}>
      {formatBytes(disk.freeBytes)} free
    </span>
  );
}

export function ServerError() {
  const { error } = useServer();
  return error ? <div className="msg err">{error}</div> : null;
}
