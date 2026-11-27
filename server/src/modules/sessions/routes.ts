import { Router } from "express";
import { z } from "zod";
import { withLock } from "../../core/lock.js";
import { SUN_ANGLE_MAX, SUN_ANGLE_MIN, getSessions, saveSessions } from "./service.js";

const name = z.string().trim().min(1).max(60).regex(/^[^\r\n=\[\]]+$/, "Name cannot contain = [ ] or new lines");
const timed = z.object({
  enabled: z.boolean(),
  name,
  minutes: z.number().int().min(1).max(1440),
  isOpen: z.boolean(),
});
const graphics = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_. -]+$/, "Invalid weather name");

const sessionsBody = z.object({
  practice: timed,
  qualify: timed,
  race: z.object({
    enabled: z.boolean(),
    name,
    mode: z.enum(["laps", "time"]),
    laps: z.number().int().min(1).max(999),
    minutes: z.number().int().min(1).max(1440),
    extraLap: z.boolean(),
    waitSeconds: z.number().int().min(0).max(3600),
    joinRule: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  }),
  sunAngle: z.number().int().min(SUN_ANGLE_MIN).max(SUN_ANGLE_MAX),
  timeMultiplier: z.number().min(0).max(60),
  loopMode: z.boolean(),
  raceOverSeconds: z.number().int().min(0).max(3600),
  dynamicTrack: z.object({
    enabled: z.boolean(),
    sessionStart: z.number().int().min(0).max(100),
    randomness: z.number().int().min(0).max(100),
    sessionTransfer: z.number().int().min(0).max(100),
    lapGain: z.number().int().min(0).max(10000),
  }),
  weathers: z
    .array(
      z.object({
        graphics,
        ambient: z.number().int().min(-30).max(60),
        road: z.number().int().min(-20).max(40),
        variationAmbient: z.number().int().min(0).max(30),
        variationRoad: z.number().int().min(0).max(30),
        windMin: z.number().int().min(0).max(200),
        windMax: z.number().int().min(0).max(200),
        windDirection: z.number().int().min(0).max(359),
        windDirectionVariation: z.number().int().min(0).max(180),
      }),
    )
    .min(1, "At least one weather is required")
    .max(20),
});

export const sessionsRouter = Router();

sessionsRouter.get("/", async (_req, res) => {
  res.json(await getSessions());
});

sessionsRouter.put("/", async (req, res) => {
  const body = sessionsBody.parse(req.body);
  if (!body.practice.enabled && !body.qualify.enabled && !body.race.enabled) {
    res.status(400).json({ error: "Enable at least one session" });
    return;
  }
  if (body.weathers.some((w) => w.windMax < w.windMin)) {
    res.status(400).json({ error: "Wind max must be greater than or equal to wind min" });
    return;
  }
  res.json(await withLock(() => saveSessions(body)));
});
