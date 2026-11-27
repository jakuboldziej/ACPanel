import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { useServer } from "@/features/server/ServerContext";
import { formatBytes } from "@/lib/format";
import { carsApi, type ApplyPlan, type CarInfo, type CarsState } from "./api";
import { CarRow } from "./components/CarRow";
import { CarsSummary } from "./components/CarsSummary";
import { CarsToolbar } from "./components/CarsToolbar";
import { useCarFilters } from "./hooks/useCarFilters";
import "./cars.css";

const enabledIds = (cars: CarInfo[]) => new Set(cars.filter((c) => c.enabled).map((c) => c.id));

export function CarsPage() {
  const server = useServer();
  const confirm = useConfirm();
  const [state, setState] = useState<CarsState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxSlots, setMaxSlots] = useState(3);
  const [plan, setPlan] = useState<ApplyPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filters = useCarFilters(state?.cars ?? [], selected);

  const load = useCallback(async () => {
    try {
      const s = await carsApi.getCars();
      setState(s);
      setSelected(enabledIds(s.cars));
      setMaxSlots(s.maxSlotsPerCar);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!state) return false;
    const now = enabledIds(state.cars);
    return now.size !== selected.size || [...now].some((id) => !selected.has(id));
  }, [state, selected]);

  useEffect(() => {
    if (!state) return;
    const t = setTimeout(async () => {
      try {
        setPlan(await carsApi.preview([...selected], maxSlots));
        setPlanError(null);
      } catch (e) {
        setPlan(null);
        setPlanError((e as Error).message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [state, selected, maxSlots]);

  function updateSelected(change: (next: Set<string>) => void) {
    setSelected((prev) => {
      const next = new Set(prev);
      change(next);
      return next;
    });
  }

  function selectShown(on: boolean) {
    updateSelected((next) => {
      for (const c of filters.visible) {
        if (c.empty) continue;
        if (on) next.add(c.id);
        else next.delete(c.id);
      }
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
    if (!(await confirm({ title: "Apply changes?", description: summary, confirmText: "Apply" }))) return;

    setBusy(true);
    setError(null);
    try {
      const res = await carsApi.apply([...selected], maxSlots);
      toast.success(`Saved (${res.totalSlots} slots). Restart the server to apply.`, { description: `Backup: ${res.backup}` });
      await load();
      void server.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCar(car: CarInfo) {
    const what = car.empty ? `the empty folder "${car.id}"` : `${car.name} (${car.id}), ${formatBytes(car.sizeBytes)}`;
    const ok = await confirm({
      title: "Delete from disk?",
      description: `${what}\n\nThis cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await carsApi.deleteCar(car.id);
      toast.success(`Deleted ${car.id}, freed ${formatBytes(res.freedBytes)}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p className="muted">{error ?? "Loading…"}</p>;

  const slotsByCar = new Map(plan?.slots.map((s) => [s.car, s.slots]));
  const mismatch = state.cars.filter((c) => c.enabled !== c.inConfig && !c.empty);
  const deleteDisabledReason = dirty ? "Apply or undo your changes first" : busy ? "Busy" : null;

  return (
    <div className="cars">
      <CarsSummary
        state={state}
        selectedCount={selected.size}
        plan={plan}
        maxSlots={maxSlots}
        onMaxSlotsChange={setMaxSlots}
        canApply={plan !== null && (dirty || mismatch.length > 0)}
        busy={busy}
        onApply={() => void apply()}
      />

      {error && <div className="msg err">{error}</div>}
      {planError && <div className="msg err">{planError}</div>}
      {mismatch.length > 0 && (
        <div className="msg warn">
          Folder mismatch with <code>CARS=</code> in server_cfg.ini: {mismatch.map((c) => c.id).join(", ")}. "Apply" will
          fix it.
        </div>
      )}

      <CarsToolbar filters={filters} onSelectShown={selectShown} onRevert={dirty ? () => setSelected(enabledIds(state.cars)) : null} />

      <ul className="car-list">
        {filters.visible.map((car) => (
          <CarRow
            key={car.id}
            car={car}
            selected={selected.has(car.id)}
            slots={slotsByCar.get(car.id)}
            deleteDisabledReason={deleteDisabledReason}
            onToggle={() => updateSelected((next) => (next.has(car.id) ? next.delete(car.id) : next.add(car.id)))}
            onDelete={() => void removeCar(car)}
          />
        ))}
        {filters.visible.length === 0 && <li className="muted">No cars</li>}
      </ul>
    </div>
  );
}
