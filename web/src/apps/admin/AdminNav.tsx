import { useCallback, useEffect, useRef, useState } from "react";
import type { TabId } from "./tabIds";
import { TABS } from "./tabs";

export function AdminNav({ active }: { active: TabId }) {
  const navRef = useRef<HTMLElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  const updateAtEnd = useCallback(() => {
    const nav = navRef.current;
    if (nav) setAtEnd(nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4);
  }, []);

  useEffect(() => {
    navRef.current?.querySelector("a.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    updateAtEnd();
  }, [active, updateAtEnd]);

  useEffect(() => {
    window.addEventListener("resize", updateAtEnd);
    return () => window.removeEventListener("resize", updateAtEnd);
  }, [updateAtEnd]);

  return (
    <nav ref={navRef} className={atEnd ? "at-end" : ""} onScroll={updateAtEnd}>
      {TABS.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          className={active === t.id ? "active" : ""}
          onMouseEnter={t.preload}
          onFocus={t.preload}
          onTouchStart={t.preload}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
