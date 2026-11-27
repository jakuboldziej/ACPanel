import { toast } from "sonner";

export async function runAction(action: () => Promise<{ reply: string }>, success?: string): Promise<boolean> {
  try {
    const { reply } = await action();
    toast.success(success ?? reply ?? "Done");
    return true;
  } catch (e) {
    toast.error((e as Error).message);
    return false;
  }
}

export function onlineFor(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just joined";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}
