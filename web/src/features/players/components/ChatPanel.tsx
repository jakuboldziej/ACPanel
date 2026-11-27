import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { playersApi } from "../api";
import { runAction } from "../lib";

export function ChatPanel({ canAct }: { canAct: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="card">
      <div className="section-head">
        <h3>Chat announcement</h3>
      </div>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await runAction(() => playersApi.chat(message), "Message sent")) setMessage("");
          setBusy(false);
        }}
      >
        <Input
          placeholder="Message to everyone on the server"
          maxLength={300}
          value={message}
          disabled={!canAct}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button type="submit" disabled={!canAct || busy || !message.trim()}>
          Send
        </Button>
      </form>
    </section>
  );
}
