import { useState } from "react";
import { BanList } from "./components/BanList";
import { ChatPanel } from "./components/ChatPanel";
import { LiveControls } from "./components/LiveControls";
import { PlayerList } from "./components/PlayerList";
import { RconSetup } from "./components/RconSetup";
import { usePlayers } from "./hooks/usePlayers";
import "./players.css";

export function PlayersPage() {
  const { players, online, rcon, error, refresh, refreshRcon } = usePlayers();
  const [bansKey, setBansKey] = useState(0);
  const canAct = Boolean(rcon?.enabled && rcon.reachable && online);

  return (
    <div className="players">
      <RconSetup rcon={rcon} onChanged={() => void refreshRcon()} />
      {error && <div className="msg err">{error}</div>}
      <PlayerList
        players={players}
        online={online}
        canAct={canAct}
        onChanged={() => {
          void refresh();
          setBansKey((k) => k + 1);
        }}
      />
      <div className="players-grid">
        <ChatPanel canAct={canAct} />
        <LiveControls canAct={canAct} />
      </div>
      <BanList refreshKey={bansKey} />
    </div>
  );
}
