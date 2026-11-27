# AC Panel

Web panel for an Assetto Corsa server (AssettoServer). TypeScript: Express (`server/`) + React/Vite (`web/`).

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

### Local development (e.g. Windows) without a real server

```bash
npm run fixture
# in .env: AC_ROOT=./dev-ac
npm run dev
```

### Production (on the server)

Keep production in its own clone so development changes do not affect the running panel.

```bash
git clone https://github.com/jakuboldziej/ACPanel ~/acpanel-prod
cd ~/acpanel-prod
npm ci && npm run build
cp .env.example .env            # fill in, see below
npm run hash-password           # paste the result into .env
REQUIRES_MOUNTS=/mnt/hdd_data npm run install-service
```

`install-service` asks for the sudo password once. It writes `/etc/systemd/system/acpanel.service`,
a sudoers rule that allows only `systemctl restart acpanel` and `systemctl restart <ACSERVER_UNIT>`,
and starts the service. `REQUIRES_MOUNTS` is optional (use it when content lives on another disk).

Updating production later:

```bash
cd ~/acpanel-prod && npm run deploy
```

Minimal production `.env`:

```
AC_ROOT=/path/to/acserver
PORT=8090
ACSERVER_UNIT=acserver
ADMIN_PASSWORD_HASH='scrypt$...'
SESSION_SECRET=<openssl rand -hex 32>
```

Optional: `HOST=127.0.0.1` (only reachable through a reverse proxy or tunnel), `LAN_URL=http://<lan-ip>:8090`,
`UPLOADS_DIR` / `BACKUPS_DIR` (put them on the same disk as `content`), `MAX_UPLOAD_MB`, `MAX_EXTRACT_MB`.

When production uses port 8090, run development on another port: `PORT=8095` in the development `.env`
(the Vite proxy follows it).

### RCON (Players tab)

Kick, ban, chat announcements, restarts with a countdown and live session controls use AssettoServer's RCON.
Enable it on the Players page (sets `RconPort` in `extra_cfg.yml`, default `RCON_PORT=27015`, then restart the server).
The panel connects to `127.0.0.1` and authenticates with `ADMIN_PASSWORD` from `server_cfg.ini`.
AssettoServer listens on all interfaces, so do not forward the RCON port on your router.

### URLs

| Path | What |
|---|---|
| `/` | public server page (no login) |
| `/admin/` | admin panel (login required) |
| `/api/public/*` | public read-only API (rate limited, no Steam IDs) |
| `/admin/api/*` | admin API (session cookie with `Path=/admin`) |
| `/api/health` | health check used by `npm run deploy` |

In development the public page is at `http://localhost:5173/` and the panel at `http://localhost:5173/admin/`.
Old links like `/#cars` redirect to `/admin/#cars`.

With Cloudflare Access, protect only `<host>/admin` so the public page stays open.

### Reverse proxy / tunnel

The panel works behind any HTTPS reverse proxy or Cloudflare Tunnel without extra configuration:
point it at `http://localhost:8090`. Uploads are chunked (32 MB) so proxy body limits are not a problem.
Requirements for the proxy: forward the original `Host` header and `X-Forwarded-Proto`.

### Server requirements

- Node.js 22+
- `7z` with RAR support for mod uploads (Ubuntu/Debian: `sudo apt install 7zip 7zip-rar`)

## Project structure

```
server/src/
  index.ts              startup checks + listen
  app.ts                Express app factory (public site, /api/public, /admin/api)
  config.ts             environment configuration
  core/                 shared helpers: fs, INI, YAML, locks, HTTP errors, previews, ui_*.json parsing
  modules/<feature>/    one folder per feature: service.ts (logic) + routes.ts (HTTP)
    index.ts            registry of admin modules mounted under /admin/api
server/test/            Vitest unit and integration tests

web/src/
  apps/admin/           admin entry, auth gate, layout, lazy-loaded tab registry (tabs.ts)
  apps/public/          public site entry
  features/<feature>/   page, components/, hooks/, api.ts (types + calls), <feature>.css
  components/           shared components (confirm dialog, Thumb, YamlEditor) and ui/ (shadcn)
  lib/                  http client, formatting, theme
  styles/               index.css (Tailwind + shadcn theme), base.css (shared styles)
```

Adding a feature: create `server/src/modules/<name>/` with `service.ts` and `routes.ts`, register the router in
`modules/index.ts`, then create `web/src/features/<name>/` and add the page to `apps/admin/tabs.ts`
(and its id to `tabIds.ts`). Each admin page is loaded on demand, together with its CSS.

## Features

- **Cars** – enabling/disabling (moving between `content/cars` <-> `content/cars_off`),
  generating `entry_list.ini`, and `CARS=` / `MAX_CLIENTS=` in `server_cfg.ini` based on the track's pitbox count.
  Before every write, the cfg files are backed up to `<AC_ROOT>/panel-backups/`.