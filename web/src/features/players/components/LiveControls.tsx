import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { playersApi } from "../api";
import { runAction } from "../lib";

export function LiveControls({ canAct }: { canAct: boolean }) {
  const confirm = useConfirm();
  const [time, setTime] = useState("14:00");

  return (
    <section className="card">
      <div className="section-head">
        <h3>Live controls</h3>
        <span className="muted">Applied immediately, no restart</span>
      </div>
      <div className="live-controls">
        <Button
          variant="outline"
          disabled={!canAct}
          onClick={async () => {
            if (await confirm({ title: "Skip to the next session?", confirmText: "Next session" }))
              void runAction(() => playersApi.nextSession());
          }}
        >
          Next session
        </Button>
        <Button
          variant="outline"
          disabled={!canAct}
          onClick={async () => {
            if (await confirm({ title: "Restart the current session?", confirmText: "Restart session" }))
              void runAction(() => playersApi.restartSession());
          }}
        >
          Restart session
        </Button>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void runAction(() => playersApi.setTime(time));
          }}
        >
          <input type="time" value={time} disabled={!canAct} onChange={(e) => setTime(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!canAct}>
            Set time
          </Button>
        </form>
      </div>
    </section>
  );
}
