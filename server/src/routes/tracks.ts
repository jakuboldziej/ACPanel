import { Router } from "express";
import { z } from "zod";
import { withLock } from "../lib/lock.js";
import { config } from "../config.js";
import { assertSafeName } from "../lib/fsutil.js";
import { sendImageInside, trackImagePath } from "../lib/preview.js";
import { applyTrack, deleteTrack, getTracksState, planTrack, setPitboxOverride, trackDir } from "../lib/tracks.js";

const selection = z.object({
  track: z.string().min(1).max(200),
  layout: z.string().max(200).default(""),
  maxSlotsPerCar: z.number().int().min(1).max(50).optional(),
});

const pitboxes = z.object({
  track: z.string().min(1).max(200),
  layout: z.string().max(200).default(""),
  pitboxes: z.number().int().min(1).max(200).nullable(),
});

export const tracksRouter = Router();

tracksRouter.get("/", async (_req, res) => {
  res.json(await getTracksState());
});

tracksRouter.post("/preview", async (req, res) => {
  const { track, layout, maxSlotsPerCar } = selection.parse(req.body);
  res.json(await planTrack(track, layout, maxSlotsPerCar));
});

tracksRouter.post("/apply", async (req, res) => {
  const { track, layout, maxSlotsPerCar } = selection.parse(req.body);
  res.json(await withLock(() => applyTrack(track, layout, maxSlotsPerCar)));
});

tracksRouter.put("/pitboxes", async (req, res) => {
  const body = pitboxes.parse(req.body);
  await withLock(() => setPitboxOverride(body.track, body.layout, body.pitboxes));
  res.json({ ok: true });
});

tracksRouter.get("/:id/image", async (req, res) => {
  const { layout, kind } = z
    .object({ layout: z.string().max(200).default(""), kind: z.enum(["preview", "outline"]).default("preview") })
    .parse(req.query);
  if (layout) assertSafeName(layout);
  await sendImageInside(res, [config.tracksDir], trackImagePath(await trackDir(req.params.id), layout, kind));
});

tracksRouter.delete("/:id", async (req, res) => {
  res.json(await withLock(() => deleteTrack(req.params.id)));
});
