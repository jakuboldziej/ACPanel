import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { Thumb } from "@/components/Thumb";
import type { TrackInfo } from "../api";
import type { Selection } from "../types";
import { LayoutRow } from "./LayoutRow";

export function TrackCard(props: {
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
    ? `/admin/api/tracks/${encodeURIComponent(track.id)}/image?layout=${encodeURIComponent(previewLayout.id)}`
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
        <span className="muted">
          {track.empty
            ? "empty folder"
            : [track.city, track.country, formatBytes(track.sizeBytes)].filter(Boolean).join(" · ")}
        </span>
        {!isCurrentTrack && (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={props.onDelete}>
            Delete
          </Button>
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
