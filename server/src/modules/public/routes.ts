import { Router } from "express";
import { rateLimit } from "../auth/auth.js";
import { getPublicStatus } from "./status.js";

export const publicRouter = Router();

publicRouter.use(rateLimit(120));
publicRouter.use((_req, res, next) => {
  res.set("Cache-Control", "public, max-age=5");
  next();
});

publicRouter.get("/status", async (_req, res) => {
  res.json(await getPublicStatus());
});
