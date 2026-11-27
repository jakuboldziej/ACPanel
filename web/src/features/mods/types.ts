import type { InstallResult, UploadView } from "./api";

export type Phase = "queued" | "uploading" | "server" | "done" | "error";

export interface Job {
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
