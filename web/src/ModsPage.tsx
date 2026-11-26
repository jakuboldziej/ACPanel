import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Thumb } from "./Thumb";
import { modsApi, uploadChunk, type InstallResult, type UploadSettings, type UploadView } from "./api";
import { formatBytes } from "./format";

type Phase = "queued" | "uploading" | "server" | "done" | "error";

interface Job {
  localId: string;
  file: File | null;
  fileName: string;
  size: number;
  phase: Phase;
  uploaded: number;
  upload: UploadView | null;
  error: string | null;
  installed: InstallResult[] | null;
}

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fromServer(u: UploadView): Job {
  return {
    localId: u.id,
    file: null,
    fileName: u.fileName,
    size: u.size,
    phase: u.status === "failed" ? "error" : "server",
    uploaded: u.size,
    upload: u,
    error: u.error,
    installed: null,
  };
}

export function ModsPage() {
  const [settings, setSettings] = useState<UploadSettings | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());
  const running = useRef(false);

  const patch = useCallback((localId: string, p: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.localId === localId ? { ...j, ...p } : j)));
  }, []);

  useEffect(() => {
    Promise.all([modsApi.settings(), modsApi.list()])
      .then(([s, l]) => {
        setSettings(s);
        setJobs((prev) => [...prev, ...l.uploads.map(fromServer)]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const pollUntilProcessed = useCallback(
    async (localId: string, id: string) => {
      for (;;) {
        const u = await modsApi.get(id);
        if (u.status !== "extracting") {
          patch(localId, { upload: u, phase: u.status === "failed" ? "error" : "server", error: u.error });
          return;
        }
        patch(localId, { upload: u });
        await sleep(1000);
      }
    },
    [patch],
  );

  useEffect(() => {
    for (const j of jobs) {
      if (j.phase === "server" && j.upload?.status === "extracting" && !aborts.current.has(j.localId)) {
        aborts.current.set(j.localId, new AbortController());
        void pollUntilProcessed(j.localId, j.upload.id).finally(() => aborts.current.delete(j.localId));
      }
    }
  }, [jobs, pollUntilProcessed]);

  const runJob = useCallback(
    async (job: Job) => {
      const file = job.file!;
      const controller = new AbortController();
      aborts.current.set(job.localId, controller);
      try {
        patch(job.localId, { phase: "uploading", error: null });
        const created = await modsApi.create(file.name, file.size);
        patch(job.localId, { upload: created });

        for (let index = 0; index < created.chunks; index++) {
          const start = index * created.chunkSize;
          const blob = file.slice(start, Math.min(start + created.chunkSize, file.size));
          for (let attempt = 1; ; attempt++) {
            try {
              await uploadChunk(created.id, index, blob, (loaded) => patch(job.localId, { uploaded: start + loaded }), controller.signal);
              break;
            } catch (e) {
              if ((e as Error).name === "AbortError" || attempt >= MAX_RETRIES) throw e;
              await sleep(1000 * attempt);
            }
          }
        }

        const completed = await modsApi.complete(created.id);
        patch(job.localId, { phase: "server", upload: completed, uploaded: file.size });
        await pollUntilProcessed(job.localId, created.id);
      } catch (e) {
        const aborted = (e as Error).name === "AbortError";
        patch(job.localId, { phase: "error", error: aborted ? "Cancelled" : (e as Error).message });
      } finally {
        aborts.current.delete(job.localId);
      }
    },
    [patch, pollUntilProcessed],
  );

  useEffect(() => {
    if (running.current) return;
    const next = jobs.find((j) => j.phase === "queued");
    if (!next) return;
    running.current = true;
    void runJob(next).finally(() => {
      running.current = false;
      setJobs((prev) => [...prev]);
    });
  }, [jobs, runJob]);

  function addFiles(files: FileList | null) {
    if (!files || !settings) return;
    const added: Job[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const tooBig = file.size > settings.maxUploadMb * 1024 * 1024;
      const badExt = !settings.extensions.includes(ext);
      added.push({
        localId: crypto.randomUUID(),
        file,
        fileName: file.name,
        size: file.size,
        phase: badExt || tooBig ? "error" : "queued",
        uploaded: 0,
        upload: null,
        error: badExt
          ? `Unsupported file type (${settings.extensions.join(", ")})`
          : tooBig
            ? `File is larger than ${settings.maxUploadMb} MB`
            : null,
        installed: null,
      });
    }
    setJobs((prev) => [...added, ...prev]);
  }

  async function dismiss(job: Job) {
    aborts.current.get(job.localId)?.abort();
    if (job.upload && job.phase !== "done" && job.upload.status !== "extracting") {
      await modsApi.remove(job.upload.id).catch(() => {});
    }
    setJobs((prev) => prev.filter((j) => j.localId !== job.localId));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  const lanOrigin = settings?.lanUrl ? new URL(settings.lanUrl).origin : null;
  const showLanHint = lanOrigin !== null && lanOrigin !== window.location.origin;

  return (
    <div className="mods">
      {showLanHint && (
        <div className="msg warn lan-hint">
          On the local network large files upload much faster through the direct address.{" "}
          <a href={`${settings!.lanUrl}/#mods`}>Open {settings!.lanUrl}</a>
        </div>
      )}
      {error && <div className="msg err">{error}</div>}

      <div
        className={`dropzone card ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={settings?.extensions.join(",")}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="dropzone-title">
          <span className="desktop-only">Drop mod archives here or click to choose</span>
          <span className="mobile-only">Tap to choose mod archives</span>
        </div>
        <div className="muted">
          {settings ? `${settings.extensions.join(", ")} · up to ${formatBytes(settings.maxUploadMb * 1024 * 1024)}` : "…"}
        </div>
      </div>

      <ul className="job-list">
        {jobs.map((job) => (
          <JobCard key={job.localId} job={job} onDismiss={() => void dismiss(job)} onUpdate={(p) => patch(job.localId, p)} />
        ))}
      </ul>
    </div>
  );
}

function JobCard(props: { job: Job; onDismiss: () => void; onUpdate: (p: Partial<Job>) => void }) {
  const { job } = props;
  const pct = job.size ? Math.min(100, Math.round((job.uploaded / job.size) * 100)) : 0;
  const status = job.upload?.status;

  let phaseLabel: string;
  if (job.phase === "queued") phaseLabel = "Waiting";
  else if (job.phase === "uploading") phaseLabel = `Uploading ${pct}% · ${formatBytes(job.uploaded)} / ${formatBytes(job.size)}`;
  else if (job.phase === "done") phaseLabel = "Installed";
  else if (job.phase === "error") phaseLabel = "Failed";
  else if (status === "extracting") phaseLabel = "Extracting and scanning…";
  else if (status === "installing") phaseLabel = "Installing…";
  else phaseLabel = "Ready to install";

  return (
    <li className={`card job phase-${job.phase}`}>
      <div className="job-head">
        <span className="name">{job.fileName}</span>
        <span className="muted">{formatBytes(job.size)}</span>
        <span className="job-phase">{phaseLabel}</span>
        <button onClick={props.onDismiss}>{job.phase === "uploading" ? "Cancel" : job.phase === "done" ? "Close" : "Discard"}</button>
      </div>
      {(job.phase === "uploading" || status === "extracting") && (
        <div className={`progress ${status === "extracting" ? "indeterminate" : ""}`}>
          <div style={{ width: status === "extracting" ? "100%" : `${pct}%` }} />
        </div>
      )}
      {job.error && <div className="msg err">{job.error}</div>}
      {job.phase === "server" && status === "ready" && job.upload && (
        <InstallForm upload={job.upload} onInstalled={(installed) => props.onUpdate({ phase: "done", installed })} />
      )}
      {job.installed && <InstallSummary installed={job.installed} />}
    </li>
  );
}

function InstallForm(props: { upload: UploadView; onInstalled: (r: InstallResult[]) => void }) {
  const { upload } = props;
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(upload.items.filter((i) => i.validId && !i.existing).map((i) => i.key)),
  );
  const [slim, setSlim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCars = upload.items.some((i) => i.kind === "car");

  async function install() {
    const items = upload.items.filter((i) => picked.has(i.key));
    const replacing = items.filter((i) => i.existing);
    if (replacing.length && !confirm(`Replace ${replacing.map((i) => i.id).join(", ")}?\n\nThe current versions will be moved to panel-backups.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await modsApi.install(
        upload.id,
        items.map((i) => ({ key: i.key, overwrite: Boolean(i.existing) })),
        slim,
      );
      props.onInstalled(res.installed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="install">
      <ul className="item-list">
        {upload.items.map((item, index) => (
          <li key={item.key} className={item.existing ? "exists" : ""}>
            <label>
              <Thumb
                src={item.image ? `/api/mods/uploads/${upload.id}/items/${index}/image` : null}
                kind={item.image}
              />
              <input
                type="checkbox"
                disabled={!item.validId}
                checked={picked.has(item.key)}
                onChange={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.key)) next.delete(item.key);
                    else next.add(item.key);
                    return next;
                  })
                }
              />
              <span className="tag">{item.kind}</span>
              <span className="name">{item.name}</span>
              {item.name !== item.id && <span className="id mono">{item.id}</span>}
              <span className="muted">{formatBytes(item.sizeBytes)}</span>
              {item.existing && <span className="tag warn">replaces existing ({item.existing})</span>}
              {!item.validId && <span className="tag warn">invalid folder name</span>}
            </label>
            {item.warnings.map((w) => (
              <div key={w} className="item-warning">
                {w}
              </div>
            ))}
          </li>
        ))}
      </ul>
      <div className="install-actions">
        {hasCars && (
          <label className="slim" title="Keeps data.acd, collider.kn5, data/ and ui/, which is all the server needs">
            <input type="checkbox" checked={slim} onChange={(e) => setSlim(e.target.checked)} />
            Strip 3D models, skins and sounds from cars (server-only copy)
          </label>
        )}
        <button className="primary" disabled={busy || picked.size === 0} onClick={() => void install()}>
          {busy ? "Installing…" : `Install ${picked.size}`}
        </button>
      </div>
      {error && <div className="msg err">{error}</div>}
    </div>
  );
}

function InstallSummary({ installed }: { installed: InstallResult[] }) {
  const saved = installed.reduce((a, i) => a + i.slimmedBytes, 0);
  const cars = installed.filter((i) => i.kind === "car");
  const tracks = installed.filter((i) => i.kind === "track");
  return (
    <div className="msg ok">
      Installed {installed.map((i) => i.id).join(", ")}.
      {saved > 0 && ` Saved ${formatBytes(saved)} by stripping.`}
      {installed.some((i) => i.replacedBackup) && " Previous versions were moved to panel-backups."}
      {cars.length > 0 && (
        <>
          {" "}
          New cars are disabled, <a href="#cars">enable them on the Cars page</a>.
        </>
      )}
      {tracks.length > 0 && (
        <>
          {" "}
          <a href="#tracks">Pick the track on the Tracks page</a>.
        </>
      )}
    </div>
  );
}
