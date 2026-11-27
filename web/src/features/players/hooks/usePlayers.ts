import { useCallback, useEffect, useState } from "react";
import { playersApi, type Player, type RconStatus } from "../api";

const POLL_MS = 5000;

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [rcon, setRcon] = useState<RconStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await playersApi.list();
      setPlayers(r.players);
      setOnline(r.online);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshRcon = useCallback(async () => {
    try {
      setRcon(await playersApi.rcon());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshRcon();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh, refreshRcon]);

  return { players, online, rcon, error, refresh, refreshRcon };
}
