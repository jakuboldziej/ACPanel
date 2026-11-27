import type { Router } from "express";
import { carsRouter } from "./cars/routes.js";
import { extraConfigRouter } from "./extraConfig/routes.js";
import { modsRouter } from "./mods/routes.js";
import { playersRouter } from "./players/routes.js";
import { pluginsRouter } from "./plugins/routes.js";
import { presetsRouter } from "./presets/routes.js";
import { rulesRouter } from "./rules/routes.js";
import { serverRouter } from "./server/routes.js";
import { sessionsRouter } from "./sessions/routes.js";
import { sharingRouter } from "./sharing/routes.js";
import { tracksRouter } from "./tracks/routes.js";

export interface AdminModule {
  path: string;
  router: Router;
}

export const adminModules: AdminModule[] = [
  { path: "/players", router: playersRouter },
  { path: "/cars", router: carsRouter },
  { path: "/tracks", router: tracksRouter },
  { path: "/sessions", router: sessionsRouter },
  { path: "/rules", router: rulesRouter },
  { path: "/presets", router: presetsRouter },
  { path: "/plugins", router: pluginsRouter },
  { path: "/extra-config", router: extraConfigRouter },
  { path: "/mods", router: modsRouter },
  { path: "/server", router: serverRouter },
  { path: "/sharing", router: sharingRouter },
];
