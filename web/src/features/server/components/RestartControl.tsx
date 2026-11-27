import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServer } from "../ServerContext";
import { RestartDialog } from "./RestartDialog";

function useSecondsLeft(at: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [at]);
  return at ? Math.max(0, Math.ceil((new Date(at).getTime() - now) / 1000)) : null;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RestartControl() {
  const { status, restarting, restart, cancelRestart } = useServer();
  const [open, setOpen] = useState(false);
  const secondsLeft = useSecondsLeft(status?.pendingRestart?.at ?? null);

  if (secondsLeft !== null) {
    return (
      <>
        <span className="tag warn">Restart in {clock(secondsLeft)}</span>
        <Button variant="outline" onClick={() => void cancelRestart()}>
          Cancel restart
        </Button>
      </>
    );
  }

  return (
    <>
      {status?.restartRequired && !restarting && <span className="tag warn">Restart required</span>}
      <Button variant={status?.restartRequired ? "default" : "outline"} disabled={restarting} onClick={() => setOpen(true)}>
        {restarting ? "Restarting…" : "Restart"}
      </Button>
      <RestartDialog
        open={open}
        players={status?.live?.clients ?? 0}
        onOpenChange={setOpen}
        onRestart={(s) => void restart(s)}
      />
    </>
  );
}
