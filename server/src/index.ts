import express, { type ErrorRequestHandler } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { config } from "./config.js";
import { checkOrigin, requireAuth, usingEphemeralSecret } from "./lib/auth.js";
import { HttpError } from "./lib/fsutil.js";
import { isValidHash } from "./lib/password.js";
import { authRouter } from "./routes/auth.js";
import { carsRouter } from "./routes/cars.js";
import { tracksRouter } from "./routes/tracks.js";
import { serverRouter } from "./routes/server.js";
import { pluginsRouter } from "./routes/plugins.js";
import { extraConfigRouter } from "./routes/extraConfig.js";

if (!isValidHash(config.adminPasswordHash)) {
  console.error("ADMIN_PASSWORD_HASH is missing or invalid. Run `npm run hash-password` and put the result in .env");
  process.exit(1);
}
if (usingEphemeralSecret) {
  console.warn("SESSION_SECRET is not set, using a random one: sessions will be lost on every restart");
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
  });
  next();
});
app.use(express.json({ limit: "100kb" }));

app.use("/api", checkOrigin);
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api", requireAuth);
app.use("/api/cars", carsRouter);
app.use("/api/tracks", tracksRouter);
app.use("/api/server", serverRouter);
app.use("/api/plugins", pluginsRouter);
app.use("/api/extra-config", extraConfigRouter);
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

app.listen(config.port, config.host, () => {
  console.log(`AC Panel: http://${config.host}:${config.port}  (AC_ROOT=${config.acRoot})`);
});
