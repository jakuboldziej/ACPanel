import { useEffect, useMemo, useRef, useState } from "react";
import { serverApi } from "./api";
import { useServer } from "./ServerContext";

const MAX_LINES = 3000;
const LEVEL = /^\[\d{2}:\d{2}:\d{2} (\w{3})\]/;

export function LogsPage() {
  const { status } = useServer();
  const managed = status?.managed ?? false;
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState("");
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!managed) return;
    let source: EventSource | null = null;
    let cancelled = false;

    serverApi
      .logs(500)
      .then(({ lines }) => {
        if (cancelled) return;
        setLines(lines);
        source = new EventSource("/api/server/logs/stream");
        source.onopen = () => setConnected(true);
        source.onerror = () => setConnected(false);
        source.onmessage = (e) => {
          const line = JSON.parse(e.data as string) as string;
          setLines((prev) => {
            const next = prev.length >= MAX_LINES ? prev.slice(prev.length - MAX_LINES + 1) : prev.slice();
            next.push(line);
            return next;
          });
        };
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [managed]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? lines.filter((l) => l.toLowerCase().includes(q)) : lines;
  }, [lines, filter]);

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [visible, follow]);

  if (status && !managed) return <p className="muted">Server control is disabled (ACSERVER_UNIT is empty).</p>;

  return (
    <div className="logs">
      <div className="toolbar">
        <input type="search" placeholder="Filter logs…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className={`live ${connected ? "on" : ""}`}>{connected ? "● live" : "○ disconnected"}</span>
        <button className={follow ? "active" : ""} onClick={() => setFollow((f) => !f)}>
          {follow ? "Following" : "Paused"}
        </button>
        <button onClick={() => setLines([])}>Clear</button>
      </div>
      {error && <div className="msg err">{error}</div>}
      <pre
        ref={boxRef}
        className="log-box card"
        onWheel={(e) => {
          if (e.deltaY < 0) setFollow(false);
        }}
      >
        {visible.map((l, i) => {
          const lvl = LEVEL.exec(l)?.[1] ?? "";
          return (
            <div key={i} className={`log-line lvl-${lvl}`}>
              {l}
            </div>
          );
        })}
        {visible.length === 0 && <span className="muted">No log lines</span>}
      </pre>
    </div>
  );
}
