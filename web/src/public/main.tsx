import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PublicApp } from "./PublicApp";
import { initTheme } from "../theme";
import "../index.css";
import "../styles.css";
import "./public.css";

const ADMIN_TABS = ["cars", "tracks", "sessions", "rules", "presets", "plugins", "settings", "mods", "logs"];

function redirectLegacyAdminLink(): boolean {
  const hash = window.location.hash.slice(1);
  if (!ADMIN_TABS.includes(hash)) return false;
  window.location.replace(`/admin/#${hash}`);
  return true;
}

window.addEventListener("hashchange", redirectLegacyAdminLink);

initTheme();

if (!redirectLegacyAdminLink()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PublicApp />
    </StrictMode>,
  );
}
