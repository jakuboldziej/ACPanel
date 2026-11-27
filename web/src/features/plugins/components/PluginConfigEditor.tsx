import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pluginsApi, type PluginConfig } from "../api";
import { YamlEditor } from "@/components/YamlEditor";
import type { Message } from "../types";

export function PluginConfigEditor(props: { name: string; onClose: () => void; onSaved: () => void }) {
  const [cfg, setCfg] = useState<PluginConfig | null>(null);
  const [text, setText] = useState("");
  const [showReference, setShowReference] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    try {
      const c = await pluginsApi.getConfig(props.name);
      setCfg(c);
      setText(c.yaml);
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, [props.name]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      toast.success(ok);
      await load();
      props.onSaved();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return <section className="card editor">{message?.text ?? "Loading…"}</section>;

  const dirty = text !== cfg.yaml;

  return (
    <section className="card editor">
      <div className="editor-head">
        <div>
          <div className="label">Config file</div>
          <div className="value mono">cfg/{cfg.file}</div>
        </div>
        {cfg.reference && (
          <Button variant="outline" onClick={() => setShowReference((s) => !s)}>{showReference ? "Hide reference" : "Show reference"}</Button>
        )}
        <Button variant="outline" onClick={props.onClose}>Close</Button>
      </div>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}

      {!cfg.exists && (
        <div className="msg warn">
          {cfg.reference ? (
            <>
              The config file does not exist yet.{" "}
              <Button variant="outline"
                disabled={busy}
                onClick={() => void run(() => pluginsApi.fromReference(props.name), "Created from reference")}
              >
                Create from reference
              </Button>
            </>
          ) : (
            "No config and no reference yet. Enable the plugin, save and restart the server: AssettoServer will generate a reference file (if the plugin has a config)."
          )}
        </div>
      )}

      <div className={`editor-panes ${cfg.reference && showReference ? "split" : ""}`}>
        <div>
          <YamlEditor value={text} onChange={setText} />
          <div className="editor-actions">
            <span className="muted">{cfg.hasSchema ? "Validated against the plugin schema on save" : "No schema, only YAML syntax is checked"}</span>
            <Button variant="outline" disabled={!dirty || busy} onClick={() => setText(cfg.yaml)}>
              Revert
            </Button>
            <Button
              disabled={!dirty || busy}
              onClick={() => void run(() => pluginsApi.saveConfig(props.name, text), "Saved. Restart the server to apply.")}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        {cfg.reference && showReference && (
          <div>
            <div className="label">Reference (read-only)</div>
            <YamlEditor value={cfg.reference} readOnly />
          </div>
        )}
      </div>
    </section>
  );
}
