#!/bin/sh
set -e

# Host mounts ./backend over /app; schema.prisma updates but node_modules may be a stale
# anonymous volume from an older image. Regenerate Prisma Client so delegates match schema.
npx prisma generate

# Apply SQL migrations (idempotent) so new tables are present after git pull.
npx prisma migrate deploy

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
