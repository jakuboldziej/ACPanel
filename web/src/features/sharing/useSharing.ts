import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { useServer } from "@/features/server/ServerContext";
import { sharingApi, type ContentKind, type SharedItem, type SharingState } from "./api";

export interface Sharing {
  enabled: boolean;
  get: (kind: ContentKind, id: string) => SharedItem | undefined;
  toggle: (kind: ContentKind, id: string, name: string) => Promise<void>;
}

export function useSharing(): Sharing {
  const confirm = useConfirm();
  const server = useServer();
  const [state, setState] = useState<SharingState | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await sharingApi.get());
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const building = state?.items.some((i) => i.status === "building") ?? false;
  useEffect(() => {
    if (!building) return;
    const id = setInterval(() => void load(), 2000);
    return () => clearInterval(id);
  }, [building, load]);

  const byKey = useMemo(() => new Map(state?.items.map((i) => [`${i.kind}:${i.id}`, i])), [state]);

  const toggle = useCallback(
    async (kind: ContentKind, id: string, name: string) => {
      const shared = byKey.has(`${kind}:${id}`);
      if (!shared) {
        const ok = await confirm({
          title: `Share ${name} for download?`,
          description:
            "Anyone who reads the server details can download it, and Content Manager offers it to players who are missing it.\n\nOnly share mods whose license allows redistribution. Never share paid mods (for example RSS).\n\nAssettoServer picks up the change after a restart.",
          confirmText: "Share",
        });
        if (!ok) return;
      }
      try {
        setState(await sharingApi.set(kind, id, !shared));
        toast.success(shared ? `${name} is no longer shared` : `${name} is being packed for download`);
        void server.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [byKey, confirm, server],
  );

  return {
    enabled: Boolean(state?.publicUrl),
    get: (kind, id) => byKey.get(`${kind}:${id}`),
    toggle,
  };
}
