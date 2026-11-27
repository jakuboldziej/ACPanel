import { formatBytes } from "@/lib/format";
import { useServer } from "../ServerContext";

export function DiskBadge() {
  const { status } = useServer();
  const disk = status?.disk;
  if (!disk) return null;
  const low = disk.freeBytes / disk.totalBytes < 0.1;
  return (
    <span className={low ? "tag warn" : "muted"} title={`Content disk: ${disk.path}`}>
      {formatBytes(disk.freeBytes)} free
    </span>
  );
}
