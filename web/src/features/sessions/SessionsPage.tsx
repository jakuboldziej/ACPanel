import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sessionsApi, type SessionsConfig, type TimedSession, type Weather } from "./api";
import { useServer } from "@/features/server/ServerContext";
import { GRIP_PRESETS, NEW_WEATHER, WEATHER_TYPES } from "./constants";
import { angleToTime, timeToAngle } from "./time";
import { NumberField } from "./components/NumberField";
import { SectionCard } from "./components/SectionCard";
import "./sessions.css";

type Message = { kind: "ok" | "err"; text: string } | null;

export function SessionsPage() {
  const server = useServer();
  const [saved, setSaved] = useState<SessionsConfig | null>(null);
  const [s, setS] = useState<SessionsConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    try {
      const r = await sessionsApi.get();
      setSaved(r);
      setS(r);
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!s || !saved) return <p className="muted">{message?.text ?? "Loading…"}</p>;

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const patch = (p: Partial<SessionsConfig>) => setS({ ...s, ...p });
  const patchTimed = (key: "practice" | "qualify", p: Partial<TimedSession>) => patch({ [key]: { ...s[key], ...p } });
  const patchRace = (p: Partial<SessionsConfig["race"]>) => patch({ race: { ...s.race, ...p } });
  const patchGrip = (p: Partial<SessionsConfig["dynamicTrack"]>) => patch({ dynamicTrack: { ...s.dynamicTrack, ...p } });
  const patchWeather = (i: number, p: Partial<Weather>) =>
    patch({ weathers: s.weathers.map((w, k) => (k === i ? { ...w, ...p } : w)) });

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await sessionsApi.save(s!);
      setSaved(res.sessions);
      setS(res.sessions);
      toast.success(`Saved. Backup: ${res.backup}. Restart the server to apply (button at the top).`);
      void server.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const timedRow = (key: "practice" | "qualify", label: string) => {
    const t = s[key];
    return (
      <div className={`sess-row ${t.enabled ? "" : "off"}`}>
        <label className="rule-toggle">
          <input type="checkbox" checked={t.enabled} onChange={(e) => patchTimed(key, { enabled: e.target.checked })} />
          {label}
        </label>
        <label className="num-field">
          <span>Name</span>
          <input type="text" value={t.name} disabled={!t.enabled} onChange={(e) => patchTimed(key, { name: e.target.value })} />
        </label>
        <NumberField label="Length" suffix="min" min={1} max={1440} value={t.minutes} disabled={!t.enabled} onChange={(v) => patchTimed(key, { minutes: v })} />
        <label className="check-field">
          <input type="checkbox" checked={t.isOpen} disabled={!t.enabled} onChange={(e) => patchTimed(key, { isOpen: e.target.checked })} />
          Players can join during the session
        </label>
      </div>
    );
  };

  return (
    <div className="sessions">
      <div className="toolbar">
        <span className="muted">Sessions, time and weather from server_cfg.ini</span>
        <span className="spacer" />
        <Button variant="outline" disabled={!dirty || busy} onClick={() => setS(saved)}>
          Revert
        </Button>
        <Button disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>

      {message && <div className={`msg ${message.kind}`}>{message.text}</div>}

      <SectionCard title="Sessions">
        {timedRow("practice", "Practice")}
        {timedRow("qualify", "Qualifying")}
        <div className={`sess-row ${s.race.enabled ? "" : "off"}`}>
          <label className="rule-toggle">
            <input type="checkbox" checked={s.race.enabled} onChange={(e) => patchRace({ enabled: e.target.checked })} />
            Race
          </label>
          <label className="num-field">
            <span>Name</span>
            <input type="text" value={s.race.name} disabled={!s.race.enabled} onChange={(e) => patchRace({ name: e.target.value })} />
          </label>
          <label className="num-field">
            <span>Length by</span>
            <select value={s.race.mode} disabled={!s.race.enabled} onChange={(e) => patchRace({ mode: e.target.value as "laps" | "time" })}>
              <option value="laps">Laps</option>
              <option value="time">Time</option>
            </select>
          </label>
          {s.race.mode === "laps" ? (
            <NumberField label="Laps" min={1} max={999} value={s.race.laps} disabled={!s.race.enabled} onChange={(v) => patchRace({ laps: v })} />
          ) : (
            <>
              <NumberField label="Length" suffix="min" min={1} max={1440} value={s.race.minutes} disabled={!s.race.enabled} onChange={(v) => patchRace({ minutes: v })} />
              <label className="check-field">
                <input type="checkbox" checked={s.race.extraLap} disabled={!s.race.enabled} onChange={(e) => patchRace({ extraLap: e.target.checked })} />
                One extra lap after time runs out
              </label>
            </>
          )}
          <NumberField label="Grid wait" suffix="s" min={0} max={3600} value={s.race.waitSeconds} disabled={!s.race.enabled} onChange={(v) => patchRace({ waitSeconds: v })} />
          <label className="num-field">
            <span>Joining</span>
            <select
              value={s.race.joinRule}
              disabled={!s.race.enabled}
              onChange={(e) => patchRace({ joinRule: Number(e.target.value) as 0 | 1 | 2 })}
            >
              <option value={0}>Closed</option>
              <option value={1}>Open</option>
              <option value={2}>Open until 20 s before the start</option>
            </select>
          </label>
        </div>
        <div className="sess-row">
          <label className="check-field">
            <input type="checkbox" checked={s.loopMode} onChange={(e) => patch({ loopMode: e.target.checked })} />
            Loop sessions (start over after the last one)
          </label>
          <NumberField label="Race over after first finisher" suffix="s" min={0} max={3600} value={s.raceOverSeconds} onChange={(v) => patch({ raceOverSeconds: v })} />
        </div>
      </SectionCard>

      <SectionCard title="Time of day">
        <div className="sess-row">
          <label className="num-field">
            <span>Start time</span>
            <input type="time" min="08:00" max="18:00" value={angleToTime(s.sunAngle)} onChange={(e) => patch({ sunAngle: timeToAngle(e.target.value) })} />
          </label>
          <input
            className="time-slider"
            type="range"
            min={-80}
            max={80}
            value={s.sunAngle}
            onChange={(e) => patch({ sunAngle: Number(e.target.value) })}
          />
          <NumberField label="Time speed" suffix="×" min={0} max={60} step={0.5} value={s.timeMultiplier} onChange={(v) => patch({ timeMultiplier: v })} />
        </div>
        <p className="field-desc muted">AC supports 08:00–18:00 (SUN_ANGLE −80…80). Time speed 1 = real time.</p>
      </SectionCard>

      <SectionCard
        title="Track grip"
        aside={
          <label className="check-field">
            <input type="checkbox" checked={s.dynamicTrack.enabled} onChange={(e) => patchGrip({ enabled: e.target.checked })} />
            Dynamic track
          </label>
        }
      >
        <div className={`sess-row ${s.dynamicTrack.enabled ? "" : "off"}`}>
          <NumberField label="Start grip" suffix="%" min={0} max={100} value={s.dynamicTrack.sessionStart} disabled={!s.dynamicTrack.enabled} onChange={(v) => patchGrip({ sessionStart: v })} />
          <NumberField label="Randomness" suffix="%" min={0} max={100} value={s.dynamicTrack.randomness} disabled={!s.dynamicTrack.enabled} onChange={(v) => patchGrip({ randomness: v })} />
          <NumberField label="Kept between sessions" suffix="%" min={0} max={100} value={s.dynamicTrack.sessionTransfer} disabled={!s.dynamicTrack.enabled} onChange={(v) => patchGrip({ sessionTransfer: v })} />
          <NumberField label="Laps to gain 1%" min={0} max={10000} value={s.dynamicTrack.lapGain} disabled={!s.dynamicTrack.enabled} onChange={(v) => patchGrip({ lapGain: v })} />
        </div>
        <div className="grip-presets">
          {GRIP_PRESETS.map((p) => (
            <Button variant="outline" key={p.name} onClick={() => patch({ dynamicTrack: p.v })}>
              {p.name}
            </Button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Weather"
        aside={<Button variant="outline" onClick={() => patch({ weathers: [...s.weathers, { ...NEW_WEATHER }] })}>Add weather</Button>}
      >
        <datalist id="weather-types">
          {WEATHER_TYPES.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
        {s.weathers.map((w, i) => (
          <div key={i} className="sess-row weather-row">
            <span className="weather-index">#{i + 1}</span>
            <label className="num-field">
              <span>Type</span>
              <input type="text" list="weather-types" value={w.graphics} onChange={(e) => patchWeather(i, { graphics: e.target.value })} />
            </label>
            <NumberField label="Air" suffix="°C" min={-30} max={60} value={w.ambient} onChange={(v) => patchWeather(i, { ambient: v })} />
            <NumberField label={`Road (+, = ${w.ambient + w.road}°C)`} suffix="°C" min={-20} max={40} value={w.road} onChange={(v) => patchWeather(i, { road: v })} />
            <NumberField label="Air ±" min={0} max={30} value={w.variationAmbient} onChange={(v) => patchWeather(i, { variationAmbient: v })} />
            <NumberField label="Road ±" min={0} max={30} value={w.variationRoad} onChange={(v) => patchWeather(i, { variationRoad: v })} />
            <NumberField label="Wind min" suffix="km/h" min={0} max={200} value={w.windMin} onChange={(v) => patchWeather(i, { windMin: v })} />
            <NumberField label="Wind max" suffix="km/h" min={0} max={200} value={w.windMax} onChange={(v) => patchWeather(i, { windMax: v })} />
            <NumberField label="Wind dir" suffix="°" min={0} max={359} value={w.windDirection} onChange={(v) => patchWeather(i, { windDirection: v })} />
            <NumberField label="Dir ±" suffix="°" min={0} max={180} value={w.windDirectionVariation} onChange={(v) => patchWeather(i, { windDirectionVariation: v })} />
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
              disabled={s.weathers.length <= 1}
              title={s.weathers.length <= 1 ? "At least one weather is required" : "Remove"}
              onClick={() => patch({ weathers: s.weathers.filter((_, k) => k !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <p className="field-desc muted">
          With several weathers the server picks one of them. Road temperature is set relative to the air.
        </p>
      </SectionCard>
    </div>
  );
}
