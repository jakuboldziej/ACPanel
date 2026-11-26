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

### Reverse proxy / tunnel

The panel works behind any HTTPS reverse proxy or Cloudflare Tunnel without extra configuration:
point it at `http://localhost:8090`. Uploads are chunked (32 MB) so proxy body limits are not a problem.
Requirements for the proxy: forward the original `Host` header and `X-Forwarded-Proto`.

### Server requirements

- Node.js 22+
- `7z` with RAR support for mod uploads (Ubuntu/Debian: `sudo apt install 7zip 7zip-rar`)

## Features

- **Cars** – enabling/disabling (moving between `content/cars` <-> `content/cars_off`),
  generating `entry_list.ini`, and `CARS=` / `MAX_CLIENTS=` in `server_cfg.ini` based on the track's pitbox count.
  Before every write, the cfg files are backed up to `<AC_ROOT>/panel-backups/`.