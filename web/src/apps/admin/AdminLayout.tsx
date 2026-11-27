import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/features/auth/api";
import { ServerProvider } from "@/features/server/ServerContext";
import { ServerError, StatusBar } from "@/features/server/StatusBar";
import { AdminNav } from "./AdminNav";
import { TABS } from "./tabs";
import { useHashTab } from "./useHashTab";

export function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const tab = useHashTab("cars");
  const Page = TABS.find((t) => t.id === tab)!.Page;

  async function logout() {
    await authApi.logout().catch(() => {});
    onLogout();
  }

  return (
    <ServerProvider>
      <div className="app">
        <header className="topbar">
          <h1>AC Panel</h1>
          <AdminNav active={tab} />
          <StatusBar />
          <Button variant="outline" size="sm" className="logout" onClick={() => void logout()}>
            Log out
          </Button>
        </header>
        <ServerError />
        <main>
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <Page />
          </Suspense>
        </main>
      </div>
    </ServerProvider>
  );
}
