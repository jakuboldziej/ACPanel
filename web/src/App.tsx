import { useEffect, useState } from "react";
import { authApi, UNAUTHORIZED_EVENT } from "./api";
import { CarsPage } from "./CarsPage";
import { LoginPage } from "./LoginPage";
import { LogsPage } from "./LogsPage";
import { ModsPage } from "./ModsPage";
import { PluginsPage } from "./PluginsPage";
import { RulesPage } from "./RulesPage";
import { ServerProvider } from "./ServerContext";
import { ServerError, StatusBar } from "./StatusBar";
import { SettingsPage } from "./SettingsPage";
import { TracksPage } from "./TracksPage";

const tabs = { cars: "Cars", tracks: "Tracks", rules: "Rules", plugins: "Plugins", settings: "Settings", mods: "Mods", logs: "Logs" } as const;
type Tab = keyof typeof tabs;

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1);
  return h in tabs ? (h as Tab) : "cars";
}

export function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then((r) => setLoggedIn(r.loggedIn))
      .catch(() => setLoggedIn(false));
    const onUnauthorized = () => setLoggedIn(false);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  if (loggedIn === null) return null;
  if (!loggedIn) return <LoginPage onLoggedIn={() => setLoggedIn(true)} />;
  return <Panel onLogout={() => setLoggedIn(false)} />;
}

function Panel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function logout() {
    await authApi.logout().catch(() => {});
    onLogout();
  }

  return (
    <ServerProvider>
      <div className="app">
        <header className="topbar">
          <h1>AC Panel</h1>
          <nav>
            {(Object.keys(tabs) as Tab[]).map((t) => (
              <a key={t} href={`#${t}`} className={tab === t ? "active" : ""}>
                {tabs[t]}
              </a>
            ))}
          </nav>
          <StatusBar />
          <button className="logout" onClick={() => void logout()}>
            Log out
          </button>
        </header>
        <ServerError />
        <main>
          {tab === "cars" && <CarsPage />}
          {tab === "tracks" && <TracksPage />}
          {tab === "rules" && <RulesPage />}
          {tab === "plugins" && <PluginsPage />}
          {tab === "settings" && <SettingsPage />}
          {tab === "mods" && <ModsPage />}
          {tab === "logs" && <LogsPage />}
        </main>
      </div>
    </ServerProvider>
  );
}
