import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm";
import { Thumb } from "@/components/Thumb";
import { modsApi, type InstallResult, type UploadView } from "../api";
import { formatBytes } from "@/lib/format";

export function InstallForm(props: { upload: UploadView; onInstalled: (r: InstallResult[]) => void }) {
  const { upload } = props;
  const confirm = useConfirm();
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(upload.items.filter((i) => i.validId && !i.existing).map((i) => i.key)),
  );
  const [slim, setSlim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCars = upload.items.some((i) => i.kind === "car");

  async function install() {
    const items = upload.items.filter((i) => picked.has(i.key));
    const replacing = items.filter((i) => i.existing);
    if (
      replacing.length &&
      !(await confirm({
        title: "Replace existing content?",
        description: `${replacing.map((i) => i.id).join(", ")}\n\nThe current versions will be moved to panel-backups.`,
        confirmText: "Replace",
        destructive: true,
      }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await modsApi.install(
        upload.id,
        items.map((i) => ({ key: i.key, overwrite: Boolean(i.existing) })),
        slim,
      );
      props.onInstalled(res.installed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="install">
      <ul className="item-list">
        {upload.items.map((item, index) => (
          <li key={item.key} className={item.existing ? "exists" : ""}>
            <label>
              <Thumb
                src={item.image ? `/admin/api/mods/uploads/${upload.id}/items/${index}/image` : null}
                kind={item.image}
              />
              <input
                type="checkbox"
                disabled={!item.validId}
                checked={picked.has(item.key)}
                onChange={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.key)) next.delete(item.key);
                    else next.add(item.key);
                    return next;
                  })
                }
              />
              <span className="tag">{item.kind}</span>
              <span className="name">{item.name}</span>
              {item.name !== item.id && <span className="id mono">{item.id}</span>}
              <span className="muted">{formatBytes(item.sizeBytes)}</span>
              {item.existing && <span className="tag warn">replaces existing ({item.existing})</span>}
              {!item.validId && <span className="tag warn">invalid folder name</span>}
            </label>
            {item.warnings.map((w) => (
              <div key={w} className="item-warning">
                {w}
              </div>
            ))}
          </li>
        ))}
      </ul>
      <div className="install-actions">
        {hasCars && (
          <label className="slim" title="Keeps data.acd, collider.kn5, data/ and ui/, which is all the server needs">
            <input type="checkbox" checked={slim} onChange={(e) => setSlim(e.target.checked)} />
            Strip 3D models, skins and sounds from cars (server-only copy)
          </label>
        )}
        <Button disabled={busy || picked.size === 0} onClick={() => void install()}>
          {busy ? "Installing…" : `Install ${picked.size}`}
        </Button>
      </div>
      {error && <div className="msg err">{error}</div>}
    </div>
  );
}
