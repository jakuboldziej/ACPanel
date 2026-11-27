import { Router } from "express";
import { rateLimit } from "../auth/auth.js";
import { getPublicStatus } from "./status.js";
import { z } from "zod";
import { HttpError } from "../../core/fsutil.js";
import { publicDownload } from "../sharing/service.js";

export const publicRouter = Router();

publicRouter.use(rateLimit(120));

publicRouter.get("/status", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=5");
  res.json(await getPublicStatus());
});

publicRouter.get("/content/:kind/:file", async (req, res) => {
  const kind = z.enum(["cars", "tracks"]).parse(req.params.kind);
  const m = /^(.+)\.zip$/.exec(req.params.file);
  if (!m) throw new HttpError(404, "Not available");
  const file = await publicDownload(kind, m[1]!);
  res.set("Cache-Control", "public, max-age=3600");
  res.download(file, `${m[1]}.zip`);
});
