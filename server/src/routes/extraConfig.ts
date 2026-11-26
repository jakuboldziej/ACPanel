import { Router } from "express";
import { z } from "zod";
import { getExtraConfig, saveExtraRaw, updateExtraValues } from "../lib/extraConfig.js";
import { withLock } from "../lib/lock.js";

const value = z.union([z.boolean(), z.number(), z.string().max(10_000), z.null()]);

export const extraConfigRouter = Router();

extraConfigRouter.get("/", async (_req, res) => {
  res.json(await getExtraConfig());
});

extraConfigRouter.put("/values", async (req, res) => {
  const { values } = z.object({ values: z.record(value) }).parse(req.body);
  res.json(await withLock(() => updateExtraValues(values)));
});

extraConfigRouter.put("/raw", async (req, res) => {
  const { yaml } = z.object({ yaml: z.string().max(1_000_000) }).parse(req.body);
  res.json(await withLock(() => saveExtraRaw(yaml)));
});
