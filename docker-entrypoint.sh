#!/bin/sh
set -e

MODE="${APP_ENV:-development}"

if [ "$MODE" = "production" ]; then
  echo "[entrypoint] APP_ENV=production -> building and serving via nginx on :3000"
  npm run build
  exec nginx -g "daemon off;"
else
  echo "[entrypoint] APP_ENV=$MODE -> starting Vite dev server on :3000"
  exec npm run dev -- --host --port 3000
fi
