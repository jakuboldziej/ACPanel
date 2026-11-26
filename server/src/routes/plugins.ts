import { Router } from "express";
import { z } from "zod";
import { withLock } from "../lib/lock.js";
import {
  createPluginConfigFromReference,
  getPluginConfig,
  listPlugins,
  savePluginConfig,
  setEnabledPlugins,
} from "../lib/plugins.js";

const yamlBody = z.object({ yaml: z.string().max(1_000_000) });

export const pluginsRouter = Router();

pluginsRouter.get("/", async (_req, res) => {
  res.json(await listPlugins());
});

pluginsRouter.put("/", async (req, res) => {
  const { enabled } = z.object({ enabled: z.array(z.string().min(1).max(100)).max(100) }).parse(req.body);
  res.json(await withLock(() => setEnabledPlugins(enabled)));
});

pluginsRouter.get("/:name/config", async (req, res) => {
  res.json(await getPluginConfig(req.params.name));
});

pluginsRouter.put("/:name/config", async (req, res) => {
  const { yaml } = yamlBody.parse(req.body);
  res.json(await withLock(() => savePluginConfig(req.params.name, yaml)));
});

pluginsRouter.post("/:name/config/from-reference", async (req, res) => {
  res.json(await withLock(() => createPluginConfigFromReference(req.params.name)));
});
