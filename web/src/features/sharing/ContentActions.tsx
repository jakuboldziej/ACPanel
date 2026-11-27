import { DownloadIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { downloadUrl, type ContentKind } from "./api";
import "./sharing.css";
import type { Sharing } from "./useSharing";

interface Props {
  kind: ContentKind;
  id: string;
  name: string;
  sharing: Sharing;
}

export function ContentActions({ kind, id, name, sharing }: Props) {
  const item = sharing.get(kind, id);
  const shareTitle = !sharing.enabled
    ? "Set PUBLIC_URL in .env to share downloads"
    : item?.status === "error"
      ? `Packing failed: ${item.error}`
      : item?.status === "ready"
        ? `Shared with Content Manager${item.sizeBytes ? ` (${formatBytes(item.sizeBytes)})` : ""}. Click to stop sharing`
        : item
          ? "Packing the zip…"
          : "Offer this to players in Content Manager";

  return (
    <span className="content-actions">
      <Button variant="ghost" size="sm" asChild title={`Download ${name} as a zip`}>
        <a href={downloadUrl(kind, id)} download>
          <DownloadIcon />
          <span className="label-text">Download</span>
        </a>
      </Button>
      <Button
        variant={item ? "secondary" : "ghost"}
        size="sm"
        className={item?.status === "error" ? "text-destructive" : item ? "shared" : ""}
        disabled={!sharing.enabled}
        title={shareTitle}
        onClick={() => void sharing.toggle(kind, id, name)}
      >
        {item?.status === "building" ? <Loader2Icon className="animate-spin" /> : <Share2Icon />}
        <span className="label-text">{item ? "Shared" : "Share"}</span>
      </Button>
    </span>
  );
}
