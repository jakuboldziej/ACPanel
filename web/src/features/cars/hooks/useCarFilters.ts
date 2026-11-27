import { useMemo, useState } from "react";
import type { CarInfo } from "../api";

export type StatusFilter = "all" | "on" | "off";

export interface CarFilters {
  query: string;
  setQuery: (v: string) => void;
  status: StatusFilter;
  setStatus: (v: StatusFilter) => void;
  carClass: string;
  setCarClass: (v: string) => void;
  tag: string;
  setTag: (v: string) => void;
  visible: CarInfo[];
  classes: [string, number][];
  tags: [string, number][];
}

function countSorted(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function useCarFilters(cars: CarInfo[], selected: Set<string>): CarFilters {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [carClass, setCarClass] = useState("");
  const [tag, setTag] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cars.filter((c) => {
      const on = selected.has(c.id);
      if (status === "on" && !on) return false;
      if (status === "off" && on) return false;
      if (carClass && c.carClass !== carClass) return false;
      if (tag && !c.tags.includes(tag)) return false;
      return !q || [c.id, c.name, c.brand ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [cars, selected, query, status, carClass, tag]);

  const classes = useMemo(() => countSorted(cars.flatMap((c) => (c.carClass ? [c.carClass] : []))), [cars]);
  const tags = useMemo(() => countSorted(cars.flatMap((c) => c.tags)), [cars]);

  return { query, setQuery, status, setStatus, carClass, setCarClass, tag, setTag, visible, classes, tags };
}
