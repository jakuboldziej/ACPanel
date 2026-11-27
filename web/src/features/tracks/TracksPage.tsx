import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm";
import { formatBytes } from "@/lib/format";
import { useServer } from "@/features/server/ServerContext";
import { tracksApi, type TrackInfo, type TrackPlan, type TracksState } from "./api";
import type { Selection } from "./types";
import { label } from "./format";
import { TrackCard } from "./components/TrackCard";
import "./tracks.css";
import { ContentActions } from "@/features/sharing/ContentActions";
import { useSharing } from "@/features/sharing/useSharing";

export function TracksPage() {
  const sharing = useSharing();
  const server = useServer();
  const confirm = useConfirm();
  const [state, setState] = useState<TracksState | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [plan, setPlan] = useState<TrackPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await tracksApi.get());
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setPlan(null);
      setPlanError(null);
      return;
    }
    let cancelled = false;
    tracksApi
      .preview(selected.track, selected.layout)
      .then((p) => {
        if (cancelled) return;
        setPlan(p);
        setPlanError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setPlan(null);
        setPlanError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, state]);

  const visible = useMemo(() => {
    if (!state) return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.tracks;
    return state.tracks.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.layouts.some((l) => l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)),
    );
  }, [state, query]);

  async function apply() {
    if (!plan || !selected) return;
    const lines = [
      `Track: ${label(plan.track, plan.layout)}`,
      `Slots: ${plan.totalSlots} / ${plan.pitboxes} pitboxes`,
      ...plan.warnings.map((w) => `Warning: ${w}`),
    ];
    if (!(await confirm({ title: "Change track?", description: lines.join("\n"), confirmText: "Set track" }))) return;

    setBusy(true);
    setMessage(null);
    try {
      const res = await tracksApi.apply(selected.track, selected.layout);
      toast.success(`Saved ${label(res.track, res.layout)} (${res.totalSlots} slots). Backup: ${res.backup}. Restart the server to apply (button at the top).`);
      setSelected(null);
      await load();
      void server.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function removeTrack(t: TrackInfo) {
    const what = t.empty ? `the empty folder "${t.id}"` : `${t.name} (${t.id}), ${formatBytes(t.sizeBytes)}`;
    if (
      !(await confirm({
        title: "Delete from disk?",
        description: `${what}\n\nThis cannot be undone.`,
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await tracksApi.remove(t.id);
      toast.success(`Deleted ${t.id}, freed ${formatBytes(res.freedBytes)}.`);
      if (selected?.track === t.id) setSelected(null);
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p className="muted">{message?.text ?? "Loading…"}</p>;

  const { current } = state;

  return (
    <div className="tracks">
      <section className="summary card">
        <div>
          <div className="label">Current track</div>
          <div className="value">{label(current.track, current.layout)}</div>
        </div>
        <div>
          <div className="label">Pitboxes</div>
          <div className="value">{current.pitboxes ?? "?"}</div>
        </div>
        <div>
          <div className="label">Enabled cars</div>
          <div className="value">{state.enabledCars}</div>
        </div>
        <div>
          <div className="label">Tracks on disk</div>
          <div className="value">{formatBytes(state.tracks.reduce((a, t) => a + t.sizeBytes, 0))}</div>
        </div>
      </section>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}

      {selected && (
        <section className="card selection">
          <div className="selection-head">
            <div>
              <div className="label">Selected</div>
              <div className="value">{label(selected.track, selected.layout)}</div>
            </div>
            {plan && (
              <div>
                <div className="label">Slots</div>
                <div className="value">
                  {plan.totalSlots} / {plan.pitboxes}
                </div>
              </div>
            )}
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button disabled={!plan || busy} onClick={apply}>
              {busy ? "Saving…" : "Set track"}
            </Button>
          </div>
          {planError && <div className="msg err">{planError}</div>}
          {plan?.warnings.map((w) => (
            <div key={w} className="msg warn">
              {w}
            </div>
          ))}
        </section>
      )}

      <div className="toolbar">
        <input type="search" placeholder="Search tracks…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <ul className="track-list">
        {visible.map((t) => (
          <TrackCard
            key={t.id}
            track={t}
            current={current}
            selected={selected}
            onSelect={(layout) => setSelected({ track: t.id, layout })}
            onPitboxesSaved={load}
            onDelete={() => void removeTrack(t)}
            actions={<ContentActions kind="tracks" id={t.id} name={t.name} sharing={sharing} />}
          />
        ))}
        {visible.length === 0 && <li className="muted">No tracks</li>}
      </ul>
    </div>
  );
}
