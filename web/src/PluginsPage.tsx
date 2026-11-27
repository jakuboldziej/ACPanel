import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pluginsApi, type PluginConfig, type PluginInfo } from "./api";
import { useServer } from "./ServerContext";
import { YamlEditor } from "./YamlEditor";

const DESCRIPTIONS: Record<string, string> = {
  AutoModerationPlugin: "Kicks AFK players, wrong-way drivers, high ping and cars without lights at night",
  CustomCommandPlugin: "Custom chat commands with fixed responses",
  DiscordAuditPlugin: "Sends kicks, bans and chat to Discord webhooks",
  FastTravelPlugin: "Teleporting around the map (needs AI splines)",
  GeoIPPlugin: "Player country from IP (needs a MaxMind GeoLite2 database)",
  LiveWeatherPlugin: "Real weather at the track location (needs an OpenWeatherMap API key)",
  RaceChallengePlugin: "1v1 races started by flashing headlights",
  RandomWeatherPlugin: "Randomly changes the weather over time",
  ReportPlugin: "/report command that saves a replay of an incident",
  SamplePlugin: "Example plugin for developers",
  TagModePlugin: "Tag game mode",
  TimeDilationPlugin: "Faster or slower in-game time depending on sun angle",
  VotingPresetPlugin: "Players vote for the next preset (track/config)",
  VotingWeatherPlugin: "Players vote for the next weather",
  WordFilterPlugin: "Chat and player name word filter",
};

type Message = { kind: "ok" | "err" | "warn"; text: string } | null;

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

function PluginConfigEditor(props: { name: string; onClose: () => void; onSaved: () => void }) {
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
