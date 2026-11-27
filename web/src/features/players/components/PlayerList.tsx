import { useState } from "react";
import { Button } from "@/components/ui/button";
import { playersApi, type Player } from "../api";
import { onlineFor, runAction } from "../lib";
import { ReasonDialog } from "./ReasonDialog";

type Pending = { kind: "kick" | "ban"; player: Player } | null;

interface Props {
  players: Player[];
  online: boolean | null;
  canAct: boolean;
  onChanged: () => void;
}

export function PlayerList({ players, online, canAct, onChanged }: Props) {
  const [pending, setPending] = useState<Pending>(null);

  async function act(kind: "kick" | "ban", player: Player, reason: string) {
    const ok = await runAction(
      () => (kind === "kick" ? playersApi.kick(player.sessionId, reason) : playersApi.ban(player.sessionId, reason)),
      kind === "kick" ? `${player.name} was kicked` : `${player.name} was banned`,
    );
    if (ok) onChanged();
  }

  return (
    <section className="card players-card">
      <div className="section-head">
        <h3>Online players</h3>
        <span className="muted">{online === false ? "Server offline" : `${players.length} connected`}</span>
      </div>
      {players.length === 0 ? (
        <p className="muted">{online === false ? "The server is not running." : "Nobody is connected right now."}</p>
      ) : (
        <ul className="player-list">
          {players.map((p) => (
            <li key={`${p.sessionId}-${p.name}`}>
              <div className="player-main">
                <span className="name">{p.name}</span>
                <span className="muted">
                  {[p.carName, p.nation, p.team, onlineFor(p.connectedSince)].filter(Boolean).join(" · ")}
                </span>
                <span className="player-ids muted mono">
                  slot {p.sessionId}
                  {p.steamId ? ` · ${p.steamId}` : ""}
                </span>
              </div>
              <div className="player-actions">
                <Button variant="outline" size="sm" disabled={!canAct} onClick={() => setPending({ kind: "kick", player: p })}>
                  Kick
                </Button>
                <Button variant="destructive" size="sm" disabled={!canAct} onClick={() => setPending({ kind: "ban", player: p })}>
                  Ban
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.kind === "ban" ? `Ban ${pending.player.name}?` : `Kick ${pending?.player.name ?? ""}?`}
        description={
          pending?.kind === "ban"
            ? "The player is disconnected and added to blacklist.txt, so they cannot join again until unbanned."
            : "The player is disconnected but can join again."
        }
        confirmText={pending?.kind === "ban" ? "Ban" : "Kick"}
        onConfirm={(reason) => pending && void act(pending.kind, pending.player, reason)}
      />
    </section>
  );
}
