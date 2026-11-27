import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { useServer } from "@/features/server/ServerContext";
import { playersApi, type RconStatus } from "../api";

export function RconSetup({ rcon, onChanged }: { rcon: RconStatus | null; onChanged: () => void }) {
  const confirm = useConfirm();
  const server = useServer();
  if (!rcon || (rcon.enabled && rcon.reachable)) return null;

  if (rcon.enabled) {
    return (
      <div className="msg warn">
        RCON is set to port {rcon.port} but the server does not answer ({rcon.error}). Restart the server to apply the
        setting.
      </div>
    );
  }

  async function enable() {
    const ok = await confirm({
      title: "Enable RCON?",
      description:
        "Kick, ban, chat and live controls use AssettoServer's RCON. It listens on a local port and uses ADMIN_PASSWORD from server_cfg.ini. Do not forward this port on your router.\n\nA server restart is needed afterwards.",
      confirmText: "Enable",
    });
    if (!ok) return;
    try {
      const res = await playersApi.enableRcon();
      toast.success(`RCON enabled on port ${res.port}. Restart the server to apply.`);
      onChanged();
      void server.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="msg warn rcon-setup">
      <span>RCON is disabled, so kick, ban, chat and live controls are not available.</span>
      <Button size="sm" onClick={() => void enable()}>
        Enable RCON
      </Button>
    </div>
  );
}
