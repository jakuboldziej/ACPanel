import { Router } from "express";
import { z } from "zod";
import { config } from "../../config.js";
import {
  clearLoginFailures,
  clearSessionCookie,
  clientIp,
  isAuthenticated,
  loginBlockedFor,
  recordLoginFailure,
  setSessionCookie,
} from "./auth.js";
import { verifyPassword } from "./password.js";

export const authRouter = Router();

authRouter.get("/me", (req, res) => {
  res.json({ loggedIn: isAuthenticated(req) });
});

authRouter.post("/login", async (req, res) => {
  const ip = clientIp(req);
  const blocked = loginBlockedFor(ip);
  if (blocked) {
    res.set("Retry-After", String(blocked)).status(429).json({ error: `Too many attempts, try again in ${Math.ceil(blocked / 60)} min` });
    return;
  }
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
  const ok = config.adminPasswordHash ? await verifyPassword(password, config.adminPasswordHash) : false;
  if (!ok) {
    recordLoginFailure(ip);
    console.warn(`Failed login from ${ip}`);
    res.status(401).json({ error: "Wrong password" });
    return;
  }
  clearLoginFailures(ip);
  setSessionCookie(req, res);
  res.json({ loggedIn: true });
});

authRouter.post("/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ loggedIn: false });
});
