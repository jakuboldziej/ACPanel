import { useState } from "react";
import { Button } from "@/components/ui/button";
import { tracksApi, type LayoutInfo } from "../api";
import { formatLength } from "../format";

export function LayoutRow(props: {
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
        {layout.hasOutline && (
          <img
            className="outline"
            src={`/admin/api/tracks/${encodeURIComponent(props.trackId)}/image?layout=${encodeURIComponent(layout.id)}&kind=outline`}
            alt=""
            loading="lazy"
          />
        )}
        <span className="layout-text">
          <span className="name">{layout.name}</span>
          <span className="id">
            {[layout.id && layout.id !== layout.name ? layout.id : null, formatLength(layout)].filter(Boolean).join(" · ")}
          </span>
        </span>
        {layout.hasAiLine && (
          <span className="tag" title="Has ai/fast_lane.ai, needed for AI (EnableAi). Road tracks usually ship a dedicated traffic spline.">
            AI line
          </span>
        )}
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
          <Button variant="outline" type="submit">Save</Button>
          {layout.pitboxesSource === "manual" && (
            <Button variant="outline" type="button" onClick={() => void save(null)}>
              Reset
            </Button>
          )}
          <Button variant="outline" type="button" onClick={() => setEditing(false)}>
            ×
          </Button>
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
