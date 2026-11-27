import crypto from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { config } from "../config.js";

export const COOKIE_NAME = "acpanel_session";

const secret = config.sessionSecret || crypto.randomBytes(32).toString("hex");
export const usingEphemeralSecret = !config.sessionSecret;

const passwordVersion = crypto.createHash("sha256").update(config.adminPasswordHash).digest("base64url").slice(0, 12);

interface SessionPayload {
  exp: number;
  v: string;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(): { token: string; maxAgeMs: number } {
  const maxAgeMs = config.sessionDays * 24 * 60 * 60 * 1000;
  const payload: SessionPayload = { exp: Date.now() + maxAgeMs, v: passwordVersion };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${data}.${sign(data)}`, maxAgeMs };
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [data, sig] = token.split(".");
  if (!data || !sig) return false;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    return payload.v === passwordVersion && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function setSessionCookie(req: Request, res: Response): void {
  const { token, maxAgeMs } = createSessionToken();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure,
    path: "/admin",
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  for (const p of ["/admin", "/"]) {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "strict", secure: req.secure, path: p });
  }
}

export function isAuthenticated(req: Request): boolean {
  return verifySessionToken(readCookie(req, COOKIE_NAME));
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: "Not logged in" });
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const checkOrigin: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    res.status(403).json({ error: "Invalid origin" });
    return;
  }
  if (host === req.get("host") || config.allowedOrigins.includes(origin)) return next();
  res.status(403).json({ error: "Origin not allowed" });
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; until: number }>();

export function clientIp(req: Request): string {
  const cf = req.get("cf-connecting-ip");
  const fromLoopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
  return (fromLoopback && cf) || req.ip || "unknown";
}

export function loginBlockedFor(ip: string): number {
  const f = failures.get(ip);
  if (!f || f.until < Date.now()) return 0;
  return f.count >= MAX_FAILURES ? Math.ceil((f.until - Date.now()) / 1000) : 0;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const f = failures.get(ip);
  if (!f || f.until < now) failures.set(ip, { count: 1, until: now + WINDOW_MS });
  else f.count++;
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}

export function rateLimit(perMinute: number): RequestHandler {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req, res, next) => {
    const ip = clientIp(req);
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + 60_000 };
      hits.set(ip, h);
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    if (++h.count > perMinute) {
      res.set("Retry-After", String(Math.ceil((h.reset - now) / 1000))).status(429).json({ error: "Too many requests" });
      return;
    }
    next();
  };
}
