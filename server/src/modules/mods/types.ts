import type { ImageKind } from "../../core/preview.js";

export const CHUNK_SIZE = 32 * 1024 * 1024;

export const ALLOWED_EXT = new Set([".zip", ".rar", ".7z"]);

export type UploadStatus = "uploading" | "extracting" | "ready" | "installing" | "installed" | "failed";

export type ItemKind = "car" | "track";

export type ExistingState = "enabled" | "disabled" | "installed" | null;

export interface ModItem {
  key: string;
  kind: ItemKind;
  id: string;
  name: string;
  relPath: string;
  sizeBytes: number;
  existing: ExistingState;
  validId: boolean;
  image: ImageKind | null;
  warnings: string[];
  duplicate: boolean;
  source: string | null;
}

export interface UploadMeta {
  id: string;
  fileName: string;
  size: number;
  chunks: number;
  received: number[];
  status: UploadStatus;
  error: string | null;
  items: ModItem[];
  progress: string | null;
  createdAt: number;
}

export type UploadView = Omit<UploadMeta, "received"> & { receivedChunks: number };

export interface InstallRequest {
  key: string;
  overwrite: boolean;
}

export interface InstallResult {
  key: string;
  kind: ItemKind;
  id: string;
  target: string;
  replacedBackup: string | null;
  slimmedBytes: number;
}
