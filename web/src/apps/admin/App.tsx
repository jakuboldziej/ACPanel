import { useEffect, useState } from "react";
import { authApi } from "@/features/auth/api";
import { LoginPage } from "@/features/auth/LoginPage";
import { UNAUTHORIZED_EVENT } from "@/lib/http";
import { AdminLayout } from "./AdminLayout";

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
  return <AdminLayout onLogout={() => setLoggedIn(false)} />;
}
