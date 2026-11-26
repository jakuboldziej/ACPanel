import express, { type ErrorRequestHandler } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { config } from "./config.js";
import { HttpError } from "./lib/fsutil.js";
import { carsRouter } from "./routes/cars.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, acRoot: config.acRoot });
});
app.use("/api/cars", carsRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "No such endpoint" });
});

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid data", details: err.issues });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: (err as Error).message ?? "Server error" });
  }
};
app.use(onError);

app.listen(config.port, () => {
  console.log(`AC Panel: http://localhost:${config.port}  (AC_ROOT=${config.acRoot})`);
});
