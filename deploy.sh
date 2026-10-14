#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/nest-api"
BRANCH="main"
SERVICE="nest-api.service"
LOCAL_URL="http://127.0.0.1:8080/api/roles"
PUBLIC_URL="https://27.71.17.228/api/roles"

log() { printf '\n=== %s ===\n' "$1"; }

show_diagnostics() {
  echo "--- Trang thai systemd ---" >&2
  sudo systemctl status "$SERVICE" --no-pager -l >&2 || true
  echo "--- 80 dong log NestJS gan nhat ---" >&2
  sudo journalctl -u "$SERVICE" -n 80 --no-pager >&2 || true
  echo "--- 50 dong log Traefik gan nhat ---" >&2
  sudo docker logs traefik --tail 50 >&2 || true
}

# A 2xx status (including HTTP 201) means the endpoint responded successfully.
check_url() {
  local url="$1" code
  code=$(curl --silent --show-error --output /dev/null \
    --connect-timeout 3 --max-time 8 \
    --write-out '%{http_code}' "$url") || return 1
  [[ "$code" =~ ^2[0-9][0-9]$ ]] || return 1
  echo "OK: $url (HTTP $code)"
}

wait_for_url() {
  local url="$1" attempts="$2" delay="$3" label="$4"
  local i
  for ((i=1; i<=attempts; i++)); do
    if check_url "$url"; then
      return 0
    fi
    echo "$label chua san sang ($i/$attempts)"
    if ! sudo systemctl is-active --quiet "$SERVICE"; then
      echo "CANH BAO: $SERVICE khong active" >&2
    fi
    if ((i < attempts)); then sleep "$delay"; fi
  done
  return 1
}

cd "$APP_DIR"

log "1. Kiem tra Git"
git status --short
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Repository co thay doi chua commit. Hay commit/stash truoc khi deploy." >&2
  exit 1
fi

log "2. Cap nhat source"
git pull --ff-only origin "$BRANCH"

log "3. Cai dependencies"
npm ci

log "4. Build NestJS"
npm run build
if [[ ! -f dist/main.js ]]; then
  echo "ERROR: Khong tim thay dist/main.js sau build" >&2
  exit 1
fi

log "5. Restart API"
sudo systemctl restart "$SERVICE"

log "6. Cho API noi bo san sang"
if ! wait_for_url "$LOCAL_URL" 20 3 "Nginx/NestJS"; then
  echo "ERROR: API noi bo khong tra HTTP 2xx" >&2
  show_diagnostics
  exit 1
fi

log "7. Kiem tra Traefik HTTPS"
if ! wait_for_url "$PUBLIC_URL" 10 3 "Traefik HTTPS"; then
  echo "ERROR: API HTTPS khong tra HTTP 2xx (khong bo qua chung chi TLS)" >&2
  show_diagnostics
  exit 1
fi

log "DEPLOY THANH CONG: local va HTTPS deu san sang"
