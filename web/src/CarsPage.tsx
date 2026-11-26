import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ApplyPlan, type CarsState } from "./api";

type Filter = "all" | "on" | "off";

export function CarsPage() {
  const [state, setState] = useState<CarsState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxSlots, setMaxSlots] = useState(3);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [plan, setPlan] = useState<ApplyPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.getCars();
      setState(s);
      setSelected(new Set(s.cars.filter((c) => c.enabled).map((c) => c.id)));
      setMaxSlots(s.maxSlotsPerCar);
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!state) return false;
    const now = state.cars.filter((c) => c.enabled).map((c) => c.id);
    return now.length !== selected.size || now.some((id) => !selected.has(id));
  }, [state, selected]);

  useEffect(() => {
    if (!state) return;
    const t = setTimeout(async () => {
      try {
        setPlan(await api.preview([...selected], maxSlots));
        setPlanError(null);
      } catch (e) {
        setPlan(null);
        setPlanError((e as Error).message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [state, selected, maxSlots]);

  const visible = useMemo(() => {
    if (!state) return [];
    const q = query.trim().toLowerCase();
    return state.cars.filter((c) => {
      const on = selected.has(c.id);
      if (filter === "on" && !on) return false;
      if (filter === "off" && on) return false;
      return !q || c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [state, query, filter, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    if (!plan) return;
    const summary = [
      plan.enable.length ? `Enable: ${plan.enable.join(", ")}` : null,
      plan.disable.length ? `Disable: ${plan.disable.join(", ")}` : null,
      `Slots: ${plan.totalSlots} / ${plan.pitboxes} pitboxes`,
    ]
      .filter(Boolean)
      .join("\n");
    if (!confirm(`Apply changes?\n\n${summary}`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const res = await api.apply([...selected], maxSlots);
      setMessage({
        kind: "ok",
        text: `Saved (${res.totalSlots} slots). Backup: ${res.backup}. Restart the server for the changes to take effect.`,
      });
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p className="muted">{message?.text ?? "Loading…"}</p>;

  const { track } = state;
  const slotsByCar = new Map(plan?.slots.map((s) => [s.car, s.slots]));
  const mismatch = state.cars.filter((c) => c.enabled !== c.inConfig && !c.empty);

  return (
    <div className="cars">
      <section className="summary card">
        <div>
          <div className="label">Track</div>
          <div className="value">
            {track.track}
            {track.layout && <span className="muted"> / {track.layout}</span>}
          </div>
        </div>
        <div>
          <div className="label">Pitboxes</div>
          <div className="value">{track.pitboxes ?? "?"}</div>
        </div>
        <div>
          <div className="label">Selected cars</div>
          <div className="value">{selected.size}</div>
        </div>
        <div>
          <div className="label">Slots</div>
          <div className="value">{plan ? plan.totalSlots : "–"}</div>
        </div>
        <label className="slots-input">
          <span className="label">Max slots per car</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxSlots}
            onChange={(e) => setMaxSlots(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <button className="primary" disabled={!plan || busy || (!dirty && mismatch.length === 0)} onClick={apply}>
          {busy ? "Saving…" : "Apply"}
        </button>
      </section>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}
      {planError && <div className="msg err">{planError}</div>}
      {mismatch.length > 0 && (
        <div className="msg warn">
          Folder mismatch with <code>CARS=</code> in server_cfg.ini: {mismatch.map((c) => c.id).join(", ")}.
          "Apply" will fix it.
        </div>
      )}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search cars…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="seg">
          {(["all", "on", "off"] as const).map((f) => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "on" ? "Enabled" : "Disabled"}
            </button>
          ))}
        </div>
        {dirty && (
          <button onClick={() => setSelected(new Set(state.cars.filter((c) => c.enabled).map((c) => c.id)))}>
            Revert changes
          </button>
        )}
      </div>

      <ul className="car-list">
        {visible.map((c) => {
          const on = selected.has(c.id);
          const changed = on !== c.enabled;
          return (
            <li key={c.id} className={`${on ? "on" : ""} ${changed ? "changed" : ""} ${c.empty ? "empty" : ""}`}>
              <label>
                <input type="checkbox" checked={on} disabled={c.empty} onChange={() => toggle(c.id)} />
                <span className="name">{c.name}</span>
                {c.name !== c.id && <span className="id">{c.id}</span>}
                {c.empty && <span className="tag">empty folder</span>}
                {on && slotsByCar.has(c.id) && <span className="tag slots">{slotsByCar.get(c.id)} slots</span>}
              </label>
            </li>
          );
        })}
        {visible.length === 0 && <li className="muted">No cars</li>}
      </ul>
    </div>
  );
}
