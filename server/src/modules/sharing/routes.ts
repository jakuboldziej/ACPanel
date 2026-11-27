import { Router } from "express";
import { z } from "zod";
import { withLock } from "../../core/lock.js";
import { setShared, sharingState } from "./service.js";

export const sharingRouter = Router();

sharingRouter.get("/", async (_req, res) => {
  res.json(await sharingState());
});

sharingRouter.put("/:kind/:id", async (req, res) => {
  const kind = z.enum(["cars", "tracks"]).parse(req.params.kind);
  const { shared } = z.object({ shared: z.boolean() }).parse(req.body);
  await withLock(() => setShared(kind, req.params.id, shared));
  res.json(await sharingState());
});
