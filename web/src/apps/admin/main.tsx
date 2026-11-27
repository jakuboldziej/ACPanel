import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/apps/admin/App";
import { ConfirmProvider } from "@/components/confirm";
import { Toaster } from "@/components/ui/sonner";
import { initTheme } from "@/lib/theme";
import "@/styles/index.css";
import "@/styles/base.css";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfirmProvider>
      <App />
      <Toaster position="bottom-right" richColors closeButton />
    </ConfirmProvider>
  </StrictMode>,
);
