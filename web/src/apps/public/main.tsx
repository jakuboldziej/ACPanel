import "@/styles/index.css";
import "@/styles/base.css";
import "@/apps/public/public.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PublicApp } from "@/apps/public/PublicApp";
import { isTabId } from "@/apps/admin/tabIds";
import { initTheme } from "@/lib/theme";


function redirectLegacyAdminLink(): boolean {
  const hash = window.location.hash.slice(1);
  if (!isTabId(hash)) return false;
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
