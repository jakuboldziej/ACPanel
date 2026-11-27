import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import type { ApplyPlan, CarsState } from "../api";

interface Props {
  state: CarsState;
  selectedCount: number;
  plan: ApplyPlan | null;
  maxSlots: number;
  onMaxSlotsChange: (v: number) => void;
  canApply: boolean;
  busy: boolean;
  onApply: () => void;
}

export function CarsSummary({ state, selectedCount, plan, maxSlots, onMaxSlotsChange, canApply, busy, onApply }: Props) {
  const { track, cars } = state;
  const enabledBytes = cars.filter((c) => c.enabled).reduce((a, c) => a + c.sizeBytes, 0);
  const allBytes = cars.reduce((a, c) => a + c.sizeBytes, 0);

  return (
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
        <div className="value">{selectedCount}</div>
      </div>
      <div>
        <div className="label">Disk (enabled / all)</div>
        <div className="value">
          {formatBytes(enabledBytes)}
          <span className="muted"> / {formatBytes(allBytes)}</span>
        </div>
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
          onChange={(e) => onMaxSlotsChange(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>
      <Button disabled={!canApply || busy} onClick={onApply}>
        {busy ? "Saving…" : "Apply"}
      </Button>
    </section>
  );
}
