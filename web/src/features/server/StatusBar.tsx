import { useServer } from "./ServerContext";
import { DiskBadge } from "./components/DiskBadge";
import { RestartControl } from "./components/RestartControl";
import "./status.css";

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
  const { status, restarting } = useServer();
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
  let label: string;
  if (restarting) label = "Restarting…";
  else if (online) label = `${status.live!.clients}/${status.live!.maxClients} players · ${trackLabel(status.live!.track)}`;
  else if (status.active) {
    const longRunning = status.since && Date.now() - new Date(status.since).getTime() > 60000;
    label = longRunning ? "Running · no response from /INFO" : "Starting…";
  } else label = `Offline (${status.state})`;

  return (
    <div className="status">
      <span className={`dot ${dotClass}`} />
      <span>{label}</span>
      {status.active && !restarting && <span className="muted">up {since(status.since)}</span>}
      <DiskBadge />
      <RestartControl />
    </div>
  );
}

export function ServerError() {
  const { error } = useServer();
  return error ? <div className="msg err">{error}</div> : null;
}
