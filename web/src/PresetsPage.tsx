import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm";
import { presetsApi, type PresetInfo } from "./api";
import { useServer } from "./ServerContext";

type Message = { kind: "ok" | "err"; text: string } | null;

export function PresetsPage() {
  const server = useServer();
  const confirm = useConfirm();
  const [presets, setPresets] = useState<PresetInfo[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    try {
      setPresets((await presetsApi.list()).presets);
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

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
      void server.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrent(target: string) {
    const exists = presets?.some((p) => p.name === target);
    if (
      exists &&
      !(await confirm({
        title: `Overwrite preset "${target}"?`,
        description: "It will be replaced with the current configuration.",
        confirmText: "Overwrite",
        destructive: true,
      }))
    )
      return;
    void run(() => presetsApi.save(target, Boolean(exists)), `Saved preset "${target}".`).then(() => setName(""));
  }

  async function apply(p: PresetInfo) {
    const lines = [
      `Track: ${p.track}${p.layout ? ` / ${p.layout}` : ""}`,
      `Cars: ${p.cars.length} (other cars will be disabled)`,
      p.sessions ? `Sessions: ${p.sessions}` : null,
    ].filter(Boolean);
    const ok = await confirm({
      title: `Load preset "${p.name}"?`,
      description: `${lines.join("\n")}\n\nThe current configuration files are backed up first.`,
      confirmText: "Load",
    });
    if (!ok) return;
    void run(() => presetsApi.apply(p.name), `Loaded preset "${p.name}". Restart the server to apply (button at the top).`);
  }

  if (!presets) return <p className="muted">{message?.text ?? "Loading…"}</p>;

  const validName = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(name) && !name.includes("..");

  return (
    <div className="presets">
      <section className="card preset-save">
        <label className="num-field">
          <span>Save the current configuration as</span>
          <input
            type="text"
            placeholder="e.g. gt3_nordschleife"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && validName) saveCurrent(name);
            }}
          />
        </label>
        <Button disabled={!validName || busy} onClick={() => saveCurrent(name)}>
          Save preset
        </Button>
        <p className="field-desc muted">
          Saves server_cfg.ini, entry_list.ini, extra_cfg.yml and plugin configs to presets/&lt;name&gt;/, the same format
          AssettoServer uses for --preset and VotingPresetPlugin. Letters, digits, _ . - only.
        </p>
      </section>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}

      <ul className="preset-list">
        {presets.map((p) => (
          <li key={p.name} className={`card preset ${p.active ? "active" : ""}`}>
            <div className="preset-head">
              <span className="name">{p.name}</span>
              {p.active && <span className="tag">current</span>}
            </div>
            <div className="preset-meta">
              {p.serverName && <div>{p.serverName}</div>}
              <div>
                {p.track || "(no track)"}
                {p.layout ? ` / ${p.layout}` : ""}
              </div>
              <div className="muted">
                {p.cars.length} cars · {p.slots} slots{p.sessions ? ` · ${p.sessions}` : ""}
              </div>
              <div className="muted small">
                {new Date(p.modifiedAt).toLocaleString()} · {p.files.length} files
              </div>
            </div>
            {p.missingTrack && <div className="msg err">Track {p.track || "(none)"} is not installed</div>}
            {p.missingCars.length > 0 && <div className="msg err">Missing cars: {p.missingCars.join(", ")}</div>}
            <div className="preset-actions">
              <Button
                disabled={busy || p.active || p.missingTrack || p.missingCars.length > 0}
                onClick={() => apply(p)}
              >
                Load
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => saveCurrent(p.name)}>
                Overwrite with current
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                disabled={busy}
                onClick={async () => {
                  const ok = await confirm({ title: `Delete preset "${p.name}"?`, confirmText: "Delete", destructive: true });
                  if (ok) void run(() => presetsApi.remove(p.name), `Deleted "${p.name}".`);
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
        {presets.length === 0 && <li className="muted">No presets yet</li>}
      </ul>
    </div>
  );
}
