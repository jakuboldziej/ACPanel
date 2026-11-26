#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE="${SERVICE_NAME:-acpanel}"
RUN_USER="${SUDO_USER:-$USER}"
NODE_BIN="$(command -v node)"
SYSTEMCTL="$(command -v systemctl)"
MOUNTS="${REQUIRES_MOUNTS:-}"

env_value() {
  grep -E "^$1=" "$APP_DIR/.env" | tail -1 | cut -d= -f2- | sed -E "s/^['\"]//; s/['\"]$//"
}

[ -f "$APP_DIR/.env" ] || { echo "Missing $APP_DIR/.env (copy .env.example and fill it in)"; exit 1; }
[ -f "$APP_DIR/server/dist/index.js" ] && [ -d "$APP_DIR/web/dist" ] || { echo "Run npm run build first"; exit 1; }
[ -n "$(env_value ADMIN_PASSWORD_HASH)" ] || { echo "ADMIN_PASSWORD_HASH is empty, run npm run hash-password"; exit 1; }
ACSERVER_UNIT="$(env_value ACSERVER_UNIT)"

UNIT_FILE="/etc/systemd/system/$SERVICE.service"
SUDOERS_FILE="/etc/sudoers.d/$SERVICE"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

{
  echo "[Unit]"
  echo "Description=AC Panel"
  echo "After=network-online.target"
  echo "Wants=network-online.target"
  [ -n "$MOUNTS" ] && echo "RequiresMountsFor=$MOUNTS"
  echo
  echo "[Service]"
  echo "Type=simple"
  echo "User=$RUN_USER"
  echo "WorkingDirectory=$APP_DIR"
  echo "ExecStart=$NODE_BIN --env-file=$APP_DIR/.env $APP_DIR/server/dist/index.js"
  echo "Environment=NODE_ENV=production"
  echo "Restart=on-failure"
  echo "RestartSec=5"
  echo
  echo "[Install]"
  echo "WantedBy=multi-user.target"
} > "$TMP/unit"

{
  echo "$RUN_USER ALL=(root) NOPASSWD: $SYSTEMCTL restart $SERVICE"
  [ -n "$ACSERVER_UNIT" ] && echo "$RUN_USER ALL=(root) NOPASSWD: $SYSTEMCTL restart $ACSERVER_UNIT"
} > "$TMP/sudoers"

echo "== $UNIT_FILE"
cat "$TMP/unit"
echo
echo "== $SUDOERS_FILE"
cat "$TMP/sudoers"
echo

sudo visudo -cf "$TMP/sudoers" >/dev/null
sudo install -m 0644 "$TMP/unit" "$UNIT_FILE"
sudo install -m 0440 "$TMP/sudoers" "$SUDOERS_FILE"
sudo "$SYSTEMCTL" daemon-reload
sudo "$SYSTEMCTL" enable --now "$SERVICE"
sleep 2
"$SYSTEMCTL" --no-pager --lines=5 status "$SERVICE" || true
