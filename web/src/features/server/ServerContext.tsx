import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { serverApi, type ServiceStatus } from "./api";

interface ServerContextValue {
  status: ServiceStatus | null;
  error: string | null;
  restarting: boolean;
  refresh: () => Promise<void>;
  restart: (warnSeconds: number) => Promise<void>;
  cancelRestart: () => Promise<void>;
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

  const restart = useCallback(async (warnSeconds: number) => {
    setError(null);
    if (warnSeconds > 0) {
      try {
        const res = await serverApi.restart(warnSeconds);
        setStatus(res);
        toast.success("Restart scheduled, players are being warned in the chat");
      } catch (e) {
        toast.error((e as Error).message);
      }
      return;
    }
    setRestarting(true);
    try {
      const res = await serverApi.restart(0);
      setStatus(res);
      if (res.ready) toast.success("Server restarted");
      else setError(`Server did not come back up (${res.state}). Check the logs.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRestarting(false);
    }
  }, []);

  const cancelRestart = useCallback(async () => {
    try {
      setStatus(await serverApi.cancelRestart());
      toast.success("Restart cancelled");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  return (
    <ServerContext.Provider value={{ status, error, restarting, refresh, restart, cancelRestart }}>
      {children}
    </ServerContext.Provider>
  );
}
