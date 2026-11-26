import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { serverApi, type ServiceStatus } from "./api";

interface ServerContextValue {
  status: ServiceStatus | null;
  error: string | null;
  restarting: boolean;
  refresh: () => Promise<void>;
  restart: () => Promise<void>;
}

const ServerContext = createContext<ServerContextValue | null>(null);

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer must be used inside ServerProvider");
  return ctx;
}

export function ServerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await serverApi.status());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const restart = useCallback(async () => {
    const players = status?.live?.clients ?? 0;
    const question =
      players > 0
        ? `${players} player${players === 1 ? " is" : "s are"} online and will be disconnected.\n\nRestart the server?`
        : "Restart the server?";
    if (!confirm(question)) return;

    setRestarting(true);
    setError(null);
    try {
      const res = await serverApi.restart();
      setStatus(res);
      if (!res.ready) setError(`Server did not come back up (${res.state}). Check the logs.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRestarting(false);
    }
  }, [status]);

  return (
    <ServerContext.Provider value={{ status, error, restarting, refresh, restart }}>{children}</ServerContext.Provider>
  );
}
