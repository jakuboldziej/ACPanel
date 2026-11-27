import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { extraConfigApi, type ExtraConfig, type FieldValue } from "./api";
import { useServer } from "@/features/server/ServerContext";
import { YamlEditor } from "@/components/YamlEditor";
import { FieldRow } from "./components/FieldRow";
import "./settings.css";

type Mode = "form" | "raw";

type Message = { kind: "ok" | "err"; text: string } | null;

export function SettingsPage() {
  const server = useServer();
  const [data, setData] = useState<ExtraConfig | null>(null);
  const [mode, setMode] = useState<Mode>("form");
  const [edits, setEdits] = useState<Record<string, FieldValue>>({});
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    try {
      const d = await extraConfigApi.get();
      setData(d);
      setRaw(d.yaml);
      setEdits({});
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return q
      ? data.fields.filter((f) => f.key.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))
      : data.fields;
  }, [data, query]);

  async function save(action: () => Promise<{ backup: string }>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await action();
      toast.success(`Saved. Backup: ${res.backup}. Restart the server to apply (button at the top).`);
      await load();
      void server.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="muted">{message?.text ?? "Loading…"}</p>;

  const formDirty = Object.keys(edits).length > 0;
  const rawDirty = raw !== data.yaml;

  return (
    <div className="settings">
      <div className="toolbar">
        <div className="seg">
          <Button variant={mode === "form" ? "default" : "outline"}
            disabled={rawDirty}
            title={rawDirty ? "Save or revert the raw changes first" : ""}
            onClick={() => setMode("form")}
          >
            Form
          </Button>
          <Button variant={mode === "raw" ? "default" : "outline"}
            disabled={formDirty}
            title={formDirty ? "Save or revert the form changes first" : ""}
            onClick={() => setMode("raw")}
          >
            Raw YAML
          </Button>
        </div>
        {mode === "form" && (
          <input type="search" placeholder="Search settings…" value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        <span className="spacer" />
        <Button variant="outline"
          disabled={busy || (mode === "form" ? !formDirty : !rawDirty)}
          onClick={() => (mode === "form" ? setEdits({}) : setRaw(data.yaml))}
        >
          Revert
        </Button>
        <Button
          disabled={busy || (mode === "form" ? !formDirty : !rawDirty)}
          onClick={() => void save(() => (mode === "form" ? extraConfigApi.saveValues(edits) : extraConfigApi.saveRaw(raw)))}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}
      {!data.hasSchema && mode === "form" && (
        <div className="msg warn">No schema found (cfg/schemas/extra_cfg.schema.json), use Raw YAML.</div>
      )}

      {mode === "form" ? (
        <ul className="field-list">
          {visible.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={f.key in edits ? edits[f.key]! : data.values[f.key]!}
              changed={f.key in edits}
              onChange={(v) =>
                setEdits((prev) => {
                  const next = { ...prev };
                  if (v === data.values[f.key]) delete next[f.key];
                  else next[f.key] = v;
                  return next;
                })
              }
            />
          ))}
          {visible.length === 0 && <li className="muted">No settings</li>}
        </ul>
      ) : (
        <YamlEditor value={raw} onChange={setRaw} rows={32} />
      )}
    </div>
  );
}
