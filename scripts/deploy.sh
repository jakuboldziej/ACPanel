#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
SERVICE="${SERVICE_NAME:-acpanel}"
PORT="$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2-)"
PORT="${PORT:-8090}"

echo "== git pull"
git pull --ff-only
echo "== npm ci"
npm ci --no-audit --no-fund
echo "== build"
npm run build
echo "== restart $SERVICE"
sudo -n systemctl restart "$SERVICE"

for _ in $(seq 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "== ok: $(git log -1 --format='%h %s')"
    exit 0
  fi
  sleep 1
done
echo "Panel did not respond on port $PORT, check: journalctl -u $SERVICE -n 50"
exit 1
