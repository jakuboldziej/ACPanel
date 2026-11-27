import { Router } from "express";
import { z } from "zod";
import { withLock } from "../../core/lock.js";
import { addBan, listBans, unban } from "./bans.js";
import { enableRcon, rconStatus } from "./rcon.js";
import { banPlayer, kickPlayer, listPlayers, nextSession, restartSession, say, setTime } from "./service.js";

const sessionParam = z.coerce.number().int().min(0).max(1000);
const reasonBody = z.object({ reason: z.string().max(200).default("") });

export const playersRouter = Router();

playersRouter.get("/", async (_req, res) => {
  res.json(await listPlayers());
});

playersRouter.get("/rcon", async (_req, res) => {
  res.json(await rconStatus());
});

playersRouter.post("/rcon/enable", async (req, res) => {
  const { port } = z.object({ port: z.number().int().min(1024).max(65535).optional() }).parse(req.body);
  res.json(await withLock(() => enableRcon(port)));
});

playersRouter.post("/:sessionId/kick", async (req, res) => {
  const { reason } = reasonBody.parse(req.body);
  res.json({ reply: await kickPlayer(sessionParam.parse(req.params.sessionId), reason) });
});

playersRouter.post("/:sessionId/ban", async (req, res) => {
  const { reason } = reasonBody.parse(req.body);
  res.json({ reply: await banPlayer(sessionParam.parse(req.params.sessionId), reason) });
});

playersRouter.post("/chat", async (req, res) => {
  const { message } = z.object({ message: z.string().min(1).max(300) }).parse(req.body);
  res.json({ reply: await say(message) });
});

playersRouter.post("/session/next", async (_req, res) => {
  res.json({ reply: await nextSession() });
});

playersRouter.post("/session/restart", async (_req, res) => {
  res.json({ reply: await restartSession() });
});

playersRouter.post("/time", async (req, res) => {
  const { time } = z.object({ time: z.string() }).parse(req.body);
  res.json({ reply: await setTime(time) });
});

playersRouter.get("/bans", async (_req, res) => {
  res.json({ bans: await listBans() });
});

playersRouter.post("/bans", async (req, res) => {
  const { steamId, reason } = z.object({ steamId: z.string(), reason: z.string().max(200).nullable().default(null) }).parse(req.body);
  res.json({ bans: await withLock(() => addBan(steamId, reason)) });
});

playersRouter.delete("/bans/:steamId", async (req, res) => {
  res.json({ bans: await withLock(() => unban(req.params.steamId)) });
});
