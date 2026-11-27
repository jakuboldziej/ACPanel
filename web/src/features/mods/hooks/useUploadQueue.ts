import { useCallback, useEffect, useRef, useState } from "react";
import { modsApi, type UploadSettings, type UploadView } from "../api";
import type { Job } from "../types";
import { fromServer, newJob, uploadFile, waitUntilProcessed } from "../upload";

function phaseFor(u: UploadView): Job["phase"] {
  return u.status === "failed" ? "error" : "server";
}

export function useUploadQueue() {
  const [settings, setSettings] = useState<UploadSettings | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(new Map<string, AbortController>());
  const running = useRef(false);

  const patch = useCallback((localId: string, p: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.localId === localId ? { ...j, ...p } : j)));
  }, []);

  const track = useCallback(
    async (localId: string, id: string) => {
      const u = await waitUntilProcessed(id, (latest) => patch(localId, { upload: latest }));
      patch(localId, { upload: u, phase: phaseFor(u), error: u.error });
    },
    [patch],
  );

  useEffect(() => {
    Promise.all([modsApi.settings(), modsApi.list()])
      .then(([s, l]) => {
        setSettings(s);
        setJobs((prev) => [...prev, ...l.uploads.map(fromServer)]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    for (const j of jobs) {
      if (j.phase === "server" && j.upload?.status === "extracting" && !active.current.has(j.localId)) {
        active.current.set(j.localId, new AbortController());
        void track(j.localId, j.upload.id).finally(() => active.current.delete(j.localId));
      }
    }
  }, [jobs, track]);

  const run = useCallback(
    async (job: Job) => {
      const file = job.file!;
      const controller = new AbortController();
      active.current.set(job.localId, controller);
      try {
        patch(job.localId, { phase: "uploading", error: null });
        const completed = await uploadFile(
          file,
          controller.signal,
          (created) => patch(job.localId, { upload: created }),
          (bytes) => patch(job.localId, { uploaded: bytes }),
        );
        patch(job.localId, { phase: "server", upload: completed, uploaded: file.size });
        await track(job.localId, completed.id);
      } catch (e) {
        const aborted = (e as Error).name === "AbortError";
        patch(job.localId, { phase: "error", error: aborted ? "Cancelled" : (e as Error).message });
      } finally {
        active.current.delete(job.localId);
      }
    },
    [patch, track],
  );

  useEffect(() => {
    if (running.current) return;
    const next = jobs.find((j) => j.phase === "queued");
    if (!next) return;
    running.current = true;
    void run(next).finally(() => {
      running.current = false;
      setJobs((prev) => [...prev]);
    });
  }, [jobs, run]);

  const add = useCallback(
    (files: FileList | null) => {
      if (!files || !settings) return;
      const added = Array.from(files, (f) => newJob(f, settings));
      setJobs((prev) => [...added, ...prev]);
    },
    [settings],
  );

  const dismiss = useCallback(async (job: Job) => {
    active.current.get(job.localId)?.abort();
    if (job.upload && job.phase !== "done" && job.upload.status !== "extracting") {
      await modsApi.remove(job.upload.id).catch(() => {});
    }
    setJobs((prev) => prev.filter((j) => j.localId !== job.localId));
  }, []);

  return { settings, jobs, error, add, dismiss, patch };
}
