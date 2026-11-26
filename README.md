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

```bash
npm run build
npm start
```

## Features

- **Cars** – enabling/disabling (moving between `content/cars` <-> `content/cars_off`),
  generating `entry_list.ini`, and `CARS=` / `MAX_CLIENTS=` in `server_cfg.ini` based on the track's pitbox count.
  Before every write, the cfg files are backed up to `<AC_ROOT>/panel-backups/`.