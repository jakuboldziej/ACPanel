import { Button } from "@/components/ui/button";
import type { CarFilters, StatusFilter } from "../hooks/useCarFilters";

const STATUS_LABELS: Record<StatusFilter, string> = { all: "All", on: "Enabled", off: "Disabled" };

interface Props {
  filters: CarFilters;
  onSelectShown: (on: boolean) => void;
  onRevert: (() => void) | null;
}

export function CarsToolbar({ filters: f, onSelectShown, onRevert }: Props) {
  const noneShown = f.visible.length === 0;
  return (
    <div className="toolbar">
      <input type="search" placeholder="Search cars…" value={f.query} onChange={(e) => f.setQuery(e.target.value)} />
      <div className="seg">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <Button key={s} variant={f.status === s ? "default" : "outline"} onClick={() => f.setStatus(s)}>
            {STATUS_LABELS[s]}
          </Button>
        ))}
      </div>
      {f.classes.length > 0 && (
        <select value={f.carClass} onChange={(e) => f.setCarClass(e.target.value)}>
          <option value="">All classes</option>
          {f.classes.map(([c, n]) => (
            <option key={c} value={c}>
              {c} ({n})
            </option>
          ))}
        </select>
      )}
      {f.tags.length > 0 && (
        <select value={f.tag} onChange={(e) => f.setTag(e.target.value)}>
          <option value="">All tags</option>
          {f.tags.map(([t, n]) => (
            <option key={t} value={t}>
              {t} ({n})
            </option>
          ))}
        </select>
      )}
      <Button variant="outline" onClick={() => onSelectShown(true)} disabled={noneShown}>
        Select shown
      </Button>
      <Button variant="outline" onClick={() => onSelectShown(false)} disabled={noneShown}>
        Unselect shown
      </Button>
      {onRevert && (
        <Button variant="outline" onClick={onRevert}>
          Revert changes
        </Button>
      )}
    </div>
  );
}
