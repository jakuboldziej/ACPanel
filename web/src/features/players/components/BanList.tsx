import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { playersApi, type Ban } from "../api";

export function BanList({ refreshKey }: { refreshKey: number }) {
  const confirm = useConfirm();
  const [bans, setBans] = useState<Ban[] | null>(null);
  const [steamId, setSteamId] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setBans((await playersApi.bans()).bans);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function unban(b: Ban) {
    const ok = await confirm({ title: `Unban ${b.name ?? b.steamId}?`, description: "They will be able to join again.", confirmText: "Unban" });
    if (!ok) return;
    try {
      setBans((await playersApi.unban(b.steamId)).bans);
      toast.success("Unbanned");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function add() {
    try {
      setBans((await playersApi.addBan(steamId.trim(), reason.trim() || null)).bans);
      setSteamId("");
      setReason("");
      toast.success("Banned");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <h3>Bans</h3>
        <span className="muted">blacklist.txt, reloaded by the server automatically</span>
      </div>
      {bans && bans.length === 0 && <p className="muted">Nobody is banned.</p>}
      {bans && bans.length > 0 && (
        <ul className="ban-list">
          {bans.map((b) => (
            <li key={b.steamId}>
              <div className="player-main">
                <span className="name">{b.name ?? "Unknown player"}</span>
                <span className="muted mono">{b.steamId}</span>
                {(b.reason || b.bannedAt) && (
                  <span className="muted">
                    {[b.reason, b.bannedAt && new Date(b.bannedAt).toLocaleDateString()].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => void unban(b)}>
                Unban
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-form ban-form"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input placeholder="Steam ID (17 digits)" inputMode="numeric" value={steamId} onChange={(e) => setSteamId(e.target.value)} />
        <Input placeholder="Reason (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" variant="outline" disabled={!/^\d{17}$/.test(steamId.trim())}>
          Ban Steam ID
        </Button>
      </form>
    </section>
  );
}
