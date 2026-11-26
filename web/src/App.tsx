import { useEffect, useState } from "react";
import { CarsPage } from "./CarsPage";
import { TracksPage } from "./TracksPage";

const tabs = { cars: "Cars", tracks: "Tracks" } as const;
type Tab = keyof typeof tabs;

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1);
  return h in tabs ? (h as Tab) : "cars";
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
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
      </header>
      <main>{tab === "cars" ? <CarsPage /> : <TracksPage />}</main>
    </div>
  );
}
