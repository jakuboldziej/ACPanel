import { Button } from "@/components/ui/button";
import { Thumb } from "@/components/Thumb";
import { formatBytes } from "@/lib/format";
import type { CarInfo } from "../api";
import type { ReactNode } from "react";

interface Props {
  car: CarInfo;
  selected: boolean;
  slots: number | undefined;
  deleteDisabledReason: string | null;
  onToggle: () => void;
  onDelete: () => void;
  actions?: ReactNode;
}

function details(car: CarInfo): string {
  if (car.empty) return `${car.id} · empty folder`;
  return [car.brand, car.carClass, car.specs?.bhp, car.specs?.weight, formatBytes(car.sizeBytes)].filter(Boolean).join(" · ");
}

export function CarRow({ car, selected, slots, deleteDisabledReason, onToggle, onDelete, actions }: Props) {
  const changed = selected !== car.enabled;
  const cls = [selected && "on", changed && "changed", car.empty && "empty"].filter(Boolean).join(" ");

  return (
    <li className={cls}>
      <label>
        <input type="checkbox" checked={selected} disabled={car.empty} onChange={onToggle} />
        <Thumb src={car.image ? `/admin/api/cars/${encodeURIComponent(car.id)}/image` : null} kind={car.image} />
        <span className="car-text">
          <span className="name" title={car.id}>
            {car.name}
          </span>
          <span className="id">{details(car)}</span>
        </span>
        {car.missingDataAcd && (
          <span
            className="tag warn"
            title="Only an unpacked data/ folder, no data.acd: the server cannot verify the car physics, so players could use modified physics"
          >
            no data.acd
          </span>
        )}
        {selected && slots !== undefined && <span className="tag slots">{slots} slots</span>}
      </label>
      {!car.empty && actions}
      {!car.enabled && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          title={deleteDisabledReason ?? (car.empty ? "Remove empty folder" : "Delete from disk")}
          disabled={deleteDisabledReason !== null}
          onClick={onDelete}
        >
          Delete
        </Button>
      )}
    </li>
  );
}
