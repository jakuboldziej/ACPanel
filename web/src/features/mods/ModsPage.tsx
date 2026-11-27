import { Dropzone } from "./components/Dropzone";
import { JobCard } from "./components/JobCard";
import { LanHint } from "./components/LanHint";
import { useUploadQueue } from "./hooks/useUploadQueue";
import "./mods.css";

export function ModsPage() {
  const { settings, jobs, error, add, dismiss, patch } = useUploadQueue();

  return (
    <div className="mods">
      <LanHint lanUrl={settings?.lanUrl ?? null} />
      {error && <div className="msg err">{error}</div>}
      <Dropzone settings={settings} onFiles={add} />
      <ul className="job-list">
        {jobs.map((job) => (
          <JobCard key={job.localId} job={job} onDismiss={() => void dismiss(job)} onUpdate={(p) => patch(job.localId, p)} />
        ))}
      </ul>
    </div>
  );
}
