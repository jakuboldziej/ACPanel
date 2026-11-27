import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm";
import { Thumb } from "@/components/Thumb";
import { modsApi, type InstallResult, type UploadView } from "../api";
import { formatBytes } from "@/lib/format";

export function InstallForm(props: { upload: UploadView; onInstalled: (r: InstallResult[]) => void }) {
  const { upload } = props;
  const confirm = useConfirm();
  const selectable = upload.items.filter((i) => i.validId);
  const defaults = () => new Set(selectable.filter((i) => !i.existing && !i.duplicate).map((i) => i.key));
  const [picked, setPicked] = useState<Set<string>>(defaults);

  function toggle(key: string) {
    const item = upload.items.find((i) => i.key === key)!;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      for (const other of upload.items) {
        if (other.key !== key && other.kind === item.kind && other.id === item.id) next.delete(other.key);
      }
      next.add(key);
      return next;
    });
  }
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
      {upload.items.length > 1 && (
        <div className="item-list-head">
          <span className="muted">
            Found {upload.items.filter((i) => i.kind === "car").length} cars,{" "}
            {upload.items.filter((i) => i.kind === "track").length} tracks
          </span>
          <Button variant="outline" size="sm" onClick={() => setPicked(defaults())}>
            Select new
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPicked(new Set())}>
            Select none
          </Button>
        </div>
      )}
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
                onChange={() => toggle(item.key)}
              />
              <span className="tag">{item.kind}</span>
              <span className="name">{item.name}</span>
              {item.name !== item.id && <span className="id mono">{item.id}</span>}
              <span className="muted">{formatBytes(item.sizeBytes)}</span>
              {item.existing && <span className="tag warn">replaces existing ({item.existing})</span>}
              {!item.validId && <span className="tag warn">invalid folder name</span>}
              {item.duplicate && <span className="tag warn">duplicate</span>}
            </label>
            {item.source && <div className="item-source muted">from {item.source}</div>}
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
