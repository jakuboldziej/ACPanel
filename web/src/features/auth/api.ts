import { call } from "@/lib/http";

export const authApi = {
  me: () => call<{ loggedIn: boolean }>("/admin/api/auth/me"),
  login: (password: string) =>
    call<{ loggedIn: true }>("/admin/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => call<{ loggedIn: false }>("/admin/api/auth/logout", { method: "POST" }),
};
