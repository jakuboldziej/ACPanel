export function LanHint({ lanUrl }: { lanUrl: string | null }) {
  if (!lanUrl || new URL(lanUrl).origin === window.location.origin) return null;
  return (
    <div className="msg warn lan-hint">
      On the local network large files upload much faster through the direct address.{" "}
      <a href={`${lanUrl}/admin/#mods`}>Open {lanUrl}</a>
    </div>
  );
}
