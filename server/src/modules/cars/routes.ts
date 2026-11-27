import { Router } from "express";
import { z } from "zod";
import { config } from "../../config.js";
import { applyCars, carDir, deleteCar, getCarsState, planCars } from "./service.js";
import { HttpError } from "../../core/fsutil.js";
import { findCarImage, sendImageInside } from "../../core/preview.js";
import { withLock } from "../../core/lock.js";
import { streamFolderZip } from "../../core/zip.js";
import { forgetShared } from "../sharing/service.js";

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

carsRouter.get("/:id/image", async (req, res) => {
  const image = await findCarImage(await carDir(req.params.id));
  if (!image) throw new HttpError(404, "No image");
  await sendImageInside(res, [config.carsDir, config.carsOffDir], image.file);
});

carsRouter.delete("/:id", async (req, res) => {
  const result = await withLock(() => deleteCar(req.params.id));
  await forgetShared("cars", req.params.id);
  res.json(result);
});

carsRouter.get("/:id/download", async (req, res) => {
  streamFolderZip(res, await carDir(req.params.id), req.params.id);
});
