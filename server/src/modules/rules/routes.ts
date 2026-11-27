import { Router } from "express";
import { z } from "zod";
import { withLock } from "../../core/lock.js";
import { getRules, saveRules } from "./service.js";

const rulesBody = z.object({
  cutPenalties: z.boolean(),
  allowedTyresOut: z.number().int(),
  gasPenalty: z.boolean(),
  startRule: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  contactLimit: z.boolean(),
  maxContactsPerKm: z.number().int(),
});

export const rulesRouter = Router();

rulesRouter.get("/", async (_req, res) => {
  res.json(await getRules());
});

rulesRouter.put("/", async (req, res) => {
  const rules = rulesBody.parse(req.body);
  res.json(await withLock(() => saveRules(rules)));
});
