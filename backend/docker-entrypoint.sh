#!/bin/sh
set -e

cd /app

PRISMA_SCHEMA="./prisma/schema.prisma"
PRISMA_BIN="./node_modules/.bin/prisma"

if [ ! -f "$PRISMA_SCHEMA" ]; then
  echo "[entrypoint] ERROR: $PRISMA_SCHEMA not found (pwd=$(pwd))."
  echo "[entrypoint] A volume or bind mount is likely overriding /app with an empty directory."
  echo "[entrypoint] On Coolify: remove any Storage / bind mount on the backend service."
  echo "[entrypoint] Use docker-compose.yml only (not docker-compose.dev.yml) for deployment."
  exit 1
fi

# Use the project-local Prisma CLI (v5). Avoid 'npx prisma' — if node_modules is empty it
# downloads Prisma 7 and fails with confusing schema / prisma.config.ts errors.
if [ ! -x "$PRISMA_BIN" ]; then
  echo "[entrypoint] Prisma CLI not found; installing dependencies..."
  npm install --include=dev
fi

"$PRISMA_BIN" generate --schema="$PRISMA_SCHEMA"

# Apply SQL migrations (idempotent) so new tables are present after git pull.
"$PRISMA_BIN" migrate deploy --schema="$PRISMA_SCHEMA"

# Production bootstrap: creates the admin account and seeds the Luxlait
# reference data on a fresh VM. Each step is idempotent: existing users,
# roles, settings and Luxlait data are detected and the script becomes a
# no op. Set BOOTSTRAP_ON_BOOT=false to opt out (for example to run a
# manual recovery seed by hand).
if [ "${BOOTSTRAP_ON_BOOT:-true}" = "true" ]; then
  echo "[entrypoint] Running production bootstrap..."
  npx ts-node src/scripts/bootstrap.ts || {
    echo "[entrypoint] Bootstrap failed. Aborting container start to surface the error."
    exit 1
  }
else
  echo "[entrypoint] BOOTSTRAP_ON_BOOT=${BOOTSTRAP_ON_BOOT}; skipping production bootstrap."
fi

exec "$@"
