import { call } from "@/lib/http";

export type ContentKind = "cars" | "tracks";

export interface SharedItem {
  kind: ContentKind;
  id: string;
  status: "building" | "ready" | "error";
  version: string | null;
  sizeBytes: number | null;
  error: string | null;
}

export interface SharingState {
  publicUrl: string | null;
  items: SharedItem[];
}

export const sharingApi = {
  get: () => call<SharingState>("/admin/api/sharing"),
  set: (kind: ContentKind, id: string, shared: boolean) =>
    call<SharingState>(`/admin/api/sharing/${kind}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ shared }),
    }),
};

export function downloadUrl(kind: ContentKind, id: string): string {
  return `/admin/api/${kind}/${encodeURIComponent(id)}/download`;
}
