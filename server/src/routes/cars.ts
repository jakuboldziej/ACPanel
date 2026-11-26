import { Router } from "express";
import { z } from "zod";
import { applyCars, getCarsState, planCars } from "../lib/cars.js";
import { withLock } from "../lib/lock.js";

const body = z.object({
  enabled: z.array(z.string().min(1).max(100)).max(500),
  maxSlotsPerCar: z.number().int().min(1).max(50).optional(),
});

export const carsRouter = Router();

carsRouter.get("/", async (_req, res) => {
  res.json(await getCarsState());
});

carsRouter.post("/preview", async (req, res) => {
  const { enabled, maxSlotsPerCar } = body.parse(req.body);
  res.json(await planCars(enabled, maxSlotsPerCar));
});

carsRouter.post("/apply", async (req, res) => {
  const { enabled, maxSlotsPerCar } = body.parse(req.body);
  res.json(await withLock(() => applyCars(enabled, maxSlotsPerCar)));
});
