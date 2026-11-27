import { useEffect, useState } from "react";
import { isTabId, type TabId } from "./tabIds";

function tabFromHash(fallback: TabId): TabId {
  const hash = window.location.hash.slice(1);
  return isTabId(hash) ? hash : fallback;
}

export function useHashTab(fallback: TabId): TabId {
  const [tab, setTab] = useState<TabId>(() => tabFromHash(fallback));

  useEffect(() => {
    const onHash = () => setTab(tabFromHash(fallback));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [fallback]);

  return tab;
}
