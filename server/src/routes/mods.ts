import { Router } from "express";
import { z } from "zod";
import { withLock } from "../lib/lock.js";
import {
  completeUpload,
  createUpload,
  deleteUpload,
  getUpload,
  installUpload,
  listUploads,
  uploadSettings,
  writeChunk,
} from "../lib/mods.js";

export const modsRouter = Router();

modsRouter.get("/settings", (_req, res) => {
  res.json(uploadSettings());
});

modsRouter.get("/uploads", async (_req, res) => {
  res.json({ uploads: await listUploads() });
});

modsRouter.post("/uploads", async (req, res) => {
  const { fileName, size } = z
    .object({ fileName: z.string().min(1).max(255), size: z.number().int().positive() })
    .parse(req.body);
  res.json(await createUpload(fileName, size));
});

modsRouter.put("/uploads/:id/chunks/:index", async (req, res) => {
  res.json(await writeChunk(req.params.id, Number(req.params.index), req));
});

modsRouter.post("/uploads/:id/complete", async (req, res) => {
  res.json(await completeUpload(req.params.id));
});

modsRouter.get("/uploads/:id", async (req, res) => {
  res.json(await getUpload(req.params.id));
});

modsRouter.post("/uploads/:id/install", async (req, res) => {
  const { items, slim } = z
    .object({
      items: z.array(z.object({ key: z.string().min(1).max(1000), overwrite: z.boolean() })).max(500),
      slim: z.boolean(),
    })
    .parse(req.body);
  res.json(await withLock(() => installUpload(req.params.id, items, slim)));
});

modsRouter.delete("/uploads/:id", async (req, res) => {
  await deleteUpload(req.params.id);
  res.json({ ok: true });
});
