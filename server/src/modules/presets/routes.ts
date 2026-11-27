import { Router } from "express";
import { z } from "zod";
import { withLock } from "../../core/lock.js";
import { applyPreset, deletePreset, listPresets, savePreset } from "./service.js";

export const presetsRouter = Router();

presetsRouter.get("/", async (_req, res) => {
  res.json({ presets: await listPresets() });
});

presetsRouter.post("/", async (req, res) => {
  const { name, overwrite } = z
    .object({ name: z.string().trim().min(1).max(64), overwrite: z.boolean().default(false) })
    .parse(req.body);
  res.json({ presets: await withLock(() => savePreset(name, overwrite)) });
});

presetsRouter.post("/:name/apply", async (req, res) => {
  res.json(await withLock(() => applyPreset(req.params.name)));
});

presetsRouter.delete("/:name", async (req, res) => {
  await withLock(() => deletePreset(req.params.name));
  res.json({ ok: true });
});
