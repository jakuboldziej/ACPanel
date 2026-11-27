import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import type { Job } from "../types";
import { InstallForm } from "./InstallForm";
import { InstallSummary } from "./InstallSummary";

export function JobCard(props: { job: Job; onDismiss: () => void; onUpdate: (p: Partial<Job>) => void }) {
  const { job } = props;
  const pct = job.size ? Math.min(100, Math.round((job.uploaded / job.size) * 100)) : 0;
  const status = job.upload?.status;

  let phaseLabel: string;
  if (job.phase === "queued") phaseLabel = "Waiting";
  else if (job.phase === "uploading") phaseLabel = `Uploading ${pct}% · ${formatBytes(job.uploaded)} / ${formatBytes(job.size)}`;
  else if (job.phase === "done") phaseLabel = "Installed";
  else if (job.phase === "error") phaseLabel = "Failed";
  else if (status === "extracting") phaseLabel = job.upload?.progress ?? "Extracting and scanning…";
  else if (status === "installing") phaseLabel = "Installing…";
  else phaseLabel = "Ready to install";

  return (
    <li className={`card job phase-${job.phase}`}>
      <div className="job-head">
        <span className="name">{job.fileName}</span>
        <span className="muted">{formatBytes(job.size)}</span>
        <span className="job-phase">{phaseLabel}</span>
        <Button variant="outline" onClick={props.onDismiss}>{job.phase === "uploading" ? "Cancel" : job.phase === "done" ? "Close" : "Discard"}</Button>
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
