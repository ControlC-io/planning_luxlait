#!/bin/sh
set -e
# Host mounts ./backend over /app; schema.prisma updates but node_modules may be a stale
# anonymous volume from an older image. Regenerate Prisma Client so delegates match schema.
npx prisma generate
# Apply SQL migrations (idempotent) so new tables are present after git pull
npx prisma migrate deploy
exec "$@"
