import { createApp } from "./app.js";
import { config } from "./config.js";
import { usingEphemeralSecret } from "./modules/auth/auth.js";
import { isValidHash } from "./modules/auth/password.js";
import { cleanupStaleUploads, markInterruptedUploads } from "./modules/mods/service.js";
import { startPlayerTracking } from "./modules/players/service.js";

if (!isValidHash(config.adminPasswordHash)) {
  console.error("ADMIN_PASSWORD_HASH is missing or invalid. Run `npm run hash-password` and put the result in .env");
  process.exit(1);
}
if (usingEphemeralSecret) {
  console.warn("SESSION_SECRET is not set, using a random one: sessions will be lost on every restart");
}

await markInterruptedUploads();
void cleanupStaleUploads();
setInterval(() => void cleanupStaleUploads(), 60 * 60 * 1000).unref();
startPlayerTracking();

createApp().listen(config.port, config.host, () => {
  console.log(`AC Panel: http://${config.host}:${config.port}  (AC_ROOT=${config.acRoot})`);
});
