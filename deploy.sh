
#!/bin/bash
set -euo pipefail

APP_DIR="/opt/nest-api"
BRANCH="main"
SERVICE="nest-api.service"

cd "$APP_DIR"

echo "=== 1. Kiem tra Git ==="
git status --short

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Thu muc co thay doi chua commit."
  exit 1
fi

echo "=== 2. Cap nhat source ==="
git pull --ff-only origin "$BRANCH"

echo "=== 3. Cai dependencies ==="
npm ci

echo "=== 4. Build NestJS ==="
npm run build

test -f dist/main.js

echo "=== 5. Restart API ==="
sudo systemctl restart "$SERVICE"

echo "=== 6. Kiem tra service ==="
sudo systemctl is-active --quiet "$SERVICE"

echo "=== 7. Kiem tra HTTP ==="
curl --fail --silent --show-error \
  http://127.0.0.1:3001/api/roles > /dev/null

echo "=== DEPLOY THANH CONG ==="
