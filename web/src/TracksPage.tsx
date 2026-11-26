import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBytes } from "./format";
import { useServer } from "./ServerContext";
import { Thumb } from "./Thumb";
import { tracksApi, type LayoutInfo, type TrackInfo, type TrackPlan, type TracksState } from "./api";

interface Selection {
  track: string;
  layout: string;
}

function label(track: string, layout: string) {
  return layout ? `${track} / ${layout}` : track;
}

export function TracksPage() {
  const server = useServer();
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
    if (!confirm(`Change track?\n\n${lines.join("\n")}`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const res = await tracksApi.apply(selected.track, selected.layout);
      setMessage({
        kind: "ok",
        text: `Saved ${label(res.track, res.layout)} (${res.totalSlots} slots). Backup: ${res.backup}. Restart the server to apply (button at the top).`,
      });
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
    if (!confirm(`Permanently delete ${what} from disk?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await tracksApi.remove(t.id);
      setMessage({ kind: "ok", text: `Deleted ${t.id}, freed ${formatBytes(res.freedBytes)}.` });
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
            <button onClick={() => setSelected(null)}>Cancel</button>
            <button className="primary" disabled={!plan || busy} onClick={apply}>
              {busy ? "Saving…" : "Set track"}
            </button>
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
          />
        ))}
        {visible.length === 0 && <li className="muted">No tracks</li>}
      </ul>
    </div>
  );
}

function TrackCard(props: {
  track: TrackInfo;
  current: Selection;
  selected: Selection | null;
  onSelect: (layout: string) => void;
  onPitboxesSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const { track } = props;
  const isCurrentTrack = props.current.track === track.id;
  const focus = props.selected?.track === track.id ? props.selected.layout : isCurrentTrack ? props.current.layout : null;
  const previewLayout =
    track.layouts.find((l) => l.id === focus && l.hasPreview) ?? track.layouts.find((l) => l.hasPreview) ?? null;
  const src = previewLayout
    ? `/api/tracks/${encodeURIComponent(track.id)}/image?layout=${encodeURIComponent(previewLayout.id)}`
    : null;

  return (
    <li className={`card track ${track.empty ? "empty" : ""}`}>
      {src && <Thumb src={src} large />}
      <div className="track-head">
        <span className="name">{track.name}</span>
        {track.name !== track.id && <span className="id">{track.id}</span>}
        {track.empty && <span className="tag">empty folder</span>}
        {!track.empty && !track.hasTrackParams && (
          <span className="tag warn" title="Missing from cfg/data_track_params.ini">
            no track params
          </span>
        )}
      </div>
      <div className="track-meta">
        <span className="muted">{track.empty ? "empty folder" : formatBytes(track.sizeBytes)}</span>
        {!isCurrentTrack && (
          <button className="icon-btn danger" onClick={props.onDelete}>
            Delete
          </button>
        )}
      </div>
      {track.layouts.length > 0 && (
        <ul className="layouts">
          {track.layouts.map((l) => (
            <LayoutRow
              key={l.id}
              trackId={track.id}
              layout={l}
              isCurrent={props.current.track === track.id && props.current.layout === l.id}
              isSelected={props.selected?.track === track.id && props.selected.layout === l.id}
              onSelect={() => props.onSelect(l.id)}
              onPitboxesSaved={props.onPitboxesSaved}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LayoutRow(props: {
  trackId: string;
  layout: LayoutInfo;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onPitboxesSaved: () => Promise<void>;
}) {
  const { layout } = props;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(pitboxes: number | null) {
    try {
      await tracksApi.setPitboxes(props.trackId, layout.id, pitboxes);
      setEditing(false);
      setError(null);
      await props.onPitboxesSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <li className={`layout ${props.isCurrent ? "current" : ""} ${props.isSelected ? "selected" : ""}`}>
      <button className="layout-pick" disabled={props.isCurrent} onClick={props.onSelect}>
        <span className="name">{layout.name}</span>
        {layout.id && layout.id !== layout.name && <span className="id">{layout.id}</span>}
        {props.isCurrent && <span className="tag">current</span>}
      </button>

      {editing ? (
        <form
          className="pitbox-edit"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number.parseInt(value, 10);
            if (Number.isFinite(n) && n > 0) void save(n);
            else setError("Enter a positive number");
          }}
        >
          <input type="number" min={1} max={200} autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit">Save</button>
          {layout.pitboxesSource === "manual" && (
            <button type="button" onClick={() => void save(null)}>
              Reset
            </button>
          )}
          <button type="button" onClick={() => setEditing(false)}>
            ×
          </button>
        </form>
      ) : (
        <button
          className={`pitboxes ${layout.pitboxes ? "" : "unknown"}`}
          title={
            layout.pitboxesSource === "ui"
              ? "From ui_track.json"
              : layout.pitboxesSource === "manual"
                ? "Set manually"
                : "Unknown, click to set"
          }
          onClick={() => {
            setValue(layout.pitboxes ? String(layout.pitboxes) : "");
            setEditing(true);
          }}
        >
          {layout.pitboxes ?? "?"} pits{layout.pitboxesSource === "manual" ? " ✎" : ""}
        </button>
      )}
      {error && <div className="msg err">{error}</div>}
    </li>
  );
}
