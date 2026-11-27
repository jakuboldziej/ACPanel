import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { errorHandler, notFound, securityHeaders } from "./core/http.js";
import { checkOrigin, requireAuth } from "./modules/auth/auth.js";
import { authRouter } from "./modules/auth/routes.js";
import { adminModules } from "./modules/index.js";
import { publicRouter } from "./modules/public/routes.js";

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");

function adminApi(): express.Router {
  const api = express.Router();
  api.use(checkOrigin);
  api.use("/auth", authRouter);
  api.use(requireAuth);
  for (const m of adminModules) api.use(m.path, m.router);
  api.use(notFound);
  return api;
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(securityHeaders);
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/public", publicRouter);
  app.use("/api", notFound);
  app.use("/admin/api", adminApi());

  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false }));
    app.get(/^\/admin(\/.*)?$/, (_req, res) => res.sendFile(path.join(webDist, "admin", "index.html")));
    app.get(/^(?!\/api(\/|$)).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
