#!/bin/sh
set -eu
role="${1:-}"
node /opt/deploy/validate.mjs "$role"
export TELEGRAM_BOT_ID="${BOT_TOKEN%%:*}"
if [ "$role" = bot ]; then
  export ROOM_WS_PORT="${PORT:-10000}"
  exec node --import tsx src/index.ts
fi
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-10000}"
