import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pluginsApi, type PluginInfo } from "./api";
import { useServer } from "@/features/server/ServerContext";
import { DESCRIPTIONS } from "./descriptions";
import type { Message } from "./types";
import { PluginConfigEditor } from "./components/PluginConfigEditor";
import "./plugins.css";

export function PluginsPage() {
  const server = useServer();
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await pluginsApi.list();
      setPlugins(r.plugins);
      setSelected(new Set(r.plugins.filter((p) => p.enabled).map((p) => p.name)));
      if (!r.extraCfgExists) setMessage({ kind: "err", text: "cfg/extra_cfg.yml does not exist" });
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!plugins) return false;
    const now = plugins.filter((p) => p.enabled).map((p) => p.name);
    return now.length !== selected.size || now.some((n) => !selected.has(n));
  }, [plugins, selected]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function save() {
    if (!plugins) return;
    setBusy(true);
    setMessage(null);
    try {
      const enabled = plugins.filter((p) => selected.has(p.name) && p.installed).map((p) => p.name);
      const res = await pluginsApi.setEnabled(enabled);
      toast.success(`Saved. Backup: ${res.backup}. Restart the server to apply (button at the top).`);
      await load();
      void server.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!plugins) return <p className="muted">{message?.text ?? "Loading…"}</p>;

  return (
    <div className="plugins">
      <section className="summary card">
        <div>
          <div className="label">Installed</div>
          <div className="value">{plugins.filter((p) => p.installed).length}</div>
        </div>
        <div>
          <div className="label">Enabled</div>
          <div className="value">{selected.size}</div>
        </div>
        {dirty && (
          <Button variant="outline" onClick={() => setSelected(new Set(plugins.filter((p) => p.enabled).map((p) => p.name)))}>
            Undo changes
          </Button>
        )}
        <Button disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </section>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}

      <ul className="plugin-list">
        {plugins.map((p) => {
          const on = selected.has(p.name);
          return (
            <li key={p.name} className={`card plugin ${on ? "on" : ""} ${on !== p.enabled ? "changed" : ""}`}>
              <label className="plugin-head">
                <input type="checkbox" checked={on} disabled={!p.installed} onChange={() => toggle(p.name)} />
                <span className="name">{p.name.replace(/Plugin$/, "")}</span>
                {!p.installed && <span className="tag warn">not installed</span>}
                {p.configExists ? (
                  <span className="tag">config</span>
                ) : p.referenceExists ? (
                  <span className="tag warn">no config</span>
                ) : null}
              </label>
              <p className="plugin-desc muted">{DESCRIPTIONS[p.name] ?? ""}</p>
              {p.installed && (
                <Button variant="outline" onClick={() => setEditing(editing === p.name ? null : p.name)}>
                  {editing === p.name ? "Close" : "Configure"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {editing && (
        <PluginConfigEditor
          key={editing}
          name={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void load();
            void server.refresh();
          }}
        />
      )}
    </div>
  );
}
