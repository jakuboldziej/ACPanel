import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ConfirmProvider } from "@/components/confirm";
import { Toaster } from "@/components/ui/sonner";
import { initTheme } from "./theme";
import "./index.css";
import "./styles.css";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfirmProvider>
      <App />
      <Toaster position="bottom-right" richColors closeButton />
    </ConfirmProvider>
  </StrictMode>,
);
