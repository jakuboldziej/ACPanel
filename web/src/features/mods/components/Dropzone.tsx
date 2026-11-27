import { useRef, useState } from "react";
import { formatBytes } from "@/lib/format";
import type { UploadSettings } from "../api";

export function Dropzone({ settings, onFiles }: { settings: UploadSettings | null; onFiles: (files: FileList | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`dropzone card ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={settings?.extensions.join(",")}
        onChange={(e) => {
          onFiles(e.target.files);
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
  );
}
