import type { InstallResult } from "../api";
import { formatBytes } from "@/lib/format";

export function InstallSummary({ installed }: { installed: InstallResult[] }) {
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
