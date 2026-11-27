import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rulesApi, type Rules } from "./api";
import { useServer } from "@/features/server/ServerContext";
import "./rules.css";

type Message = { kind: "ok" | "err"; text: string } | null;

const START_RULES: { value: Rules["startRule"]; label: string }[] = [
  { value: 0, label: "Car locked until the green light" },
  { value: 1, label: "Teleport to the pits" },
  { value: 2, label: "Drive-through penalty" },
];

export function RulesPage() {
  const server = useServer();
  const [saved, setSaved] = useState<Rules | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    try {
      const r = await rulesApi.get();
      setSaved(r);
      setRules(r);
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!rules || !saved) return <p className="muted">{message?.text ?? "Loading…"}</p>;

  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);
  const set = (patch: Partial<Rules>) => setRules({ ...rules, ...patch });

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await rulesApi.save(rules!);
      setSaved(res.rules);
      setRules(res.rules);
      toast.success(`Saved. Backup: ${res.backup}. Restart the server to apply (button at the top).`);
      void server.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rules">
      <div className="toolbar">
        <span className="muted">Penalties and race rules from server_cfg.ini</span>
        <span className="spacer" />
        <Button variant="outline" disabled={!dirty || busy} onClick={() => setRules(saved)}>
          Revert
        </Button>
        <Button disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}

      <ul className="field-list">
        <li className={`card field ${rules.cutPenalties !== saved.cutPenalties || rules.allowedTyresOut !== saved.allowedTyresOut ? "changed" : ""}`}>
          <div className="field-main">
            <label className="rule-toggle">
              <input type="checkbox" checked={rules.cutPenalties} onChange={(e) => set({ cutPenalties: e.target.checked })} />
              Cut penalties
            </label>
            <label className="rule-inline">
              Tyres allowed outside the track
              <input
                type="number"
                min={0}
                max={4}
                disabled={!rules.cutPenalties}
                value={rules.allowedTyresOut}
                onChange={(e) => set({ allowedTyresOut: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="field-desc muted">
            Penalise players for cutting corners. With 2, a car is cutting when more than two wheels leave the track.
            Off writes ALLOWED_TYRES_OUT=-1.
          </p>
        </li>

        <li className={`card field ${rules.gasPenalty !== saved.gasPenalty ? "changed" : ""}`}>
          <div className="field-main">
            <label className="rule-toggle">
              <input type="checkbox" checked={rules.gasPenalty} onChange={(e) => set({ gasPenalty: e.target.checked })} />
              Throttle cut after cutting (race)
            </label>
          </div>
          <p className="field-desc muted">Cuts the throttle for a moment after a cut in a race. Off writes RACE_GAS_PENALTY_DISABLED=1.</p>
        </li>

        <li className={`card field ${rules.startRule !== saved.startRule ? "changed" : ""}`}>
          <div className="field-main">
            <label className="rule-inline">
              Jump start
              <select value={rules.startRule} onChange={(e) => set({ startRule: Number(e.target.value) as Rules["startRule"] })}>
                {START_RULES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-desc muted">What happens when a player moves before the start of a race (START_RULE).</p>
        </li>

        <li className={`card field ${rules.contactLimit !== saved.contactLimit || rules.maxContactsPerKm !== saved.maxContactsPerKm ? "changed" : ""}`}>
          <div className="field-main">
            <label className="rule-toggle">
              <input type="checkbox" checked={rules.contactLimit} onChange={(e) => set({ contactLimit: e.target.checked })} />
              Kick for too many contacts
            </label>
            <label className="rule-inline">
              Max contacts per km
              <input
                type="number"
                min={0}
                max={100}
                disabled={!rules.contactLimit}
                value={rules.maxContactsPerKm}
                onChange={(e) => set({ maxContactsPerKm: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="field-desc muted">Kicks players who crash into others too often. Off writes MAX_CONTACTS_PER_KM=-1.</p>
        </li>
      </ul>
    </div>
  );
}
