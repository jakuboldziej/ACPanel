import { call, ApiError, UNAUTHORIZED_EVENT } from "@/lib/http";

export type UploadStatus = "uploading" | "extracting" | "ready" | "installing" | "installed" | "failed";

export interface ModItem {
  key: string;
  kind: "car" | "track";
  id: string;
  name: string;
  relPath: string;
  sizeBytes: number;
  existing: "enabled" | "disabled" | "installed" | null;
  validId: boolean;
  image: "preview" | "badge" | null;
  warnings: string[];
  duplicate?: boolean;
  source?: string | null;
}

export interface UploadView {
  id: string;
  fileName: string;
  size: number;
  chunks: number;
  receivedChunks: number;
  status: UploadStatus;
  error: string | null;
  progress?: string | null;
  items: ModItem[];
  createdAt: number;
}

export interface UploadSettings {
  chunkSize: number;
  maxUploadMb: number;
  lanUrl: string | null;
  extensions: string[];
}

export interface InstallResult {
  key: string;
  kind: "car" | "track";
  id: string;
  target: string;
  replacedBackup: string | null;
  slimmedBytes: number;
}

export const modsApi = {
  settings: () => call<UploadSettings>("/admin/api/mods/settings"),
  list: () => call<{ uploads: UploadView[] }>("/admin/api/mods/uploads"),
  create: (fileName: string, size: number) =>
    call<UploadView & { chunkSize: number }>("/admin/api/mods/uploads", {
      method: "POST",
      body: JSON.stringify({ fileName, size }),
    }),
  complete: (id: string) => call<UploadView>(`/admin/api/mods/uploads/${id}/complete`, { method: "POST" }),
  get: (id: string) => call<UploadView>(`/admin/api/mods/uploads/${id}`),
  install: (id: string, items: { key: string; overwrite: boolean }[], slim: boolean) =>
    call<{ installed: InstallResult[] }>(`/admin/api/mods/uploads/${id}/install`, {
      method: "POST",
      body: JSON.stringify({ items, slim }),
    }),
  remove: (id: string) => call<{ ok: true }>(`/admin/api/mods/uploads/${id}`, { method: "DELETE" }),
};

export function uploadChunk(
  id: string,
  index: number,
  blob: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/admin/api/mods/uploads/${id}/chunks/${index}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      let message = `HTTP ${xhr.status}`;
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        message = `HTTP ${xhr.status}`;
      }
      reject(new ApiError(message));
    };
    xhr.onerror = () => reject(new ApiError("Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}
