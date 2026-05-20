#!/bin/sh
# Fix Prisma P1000 on Coolify when POSTGRES_PASSWORD in env does not match the
# password stored in the existing postgres_data volume.
#
# Run on the Coolify server (SSH), from anywhere:
#   sh coolify-fix-p1000.sh
#   sh coolify-fix-p1000.sh 'your-postgres-password'
#   sh coolify-fix-p1000.sh 'your-postgres-password' zdbhyyhegz6ojbpdwa5pk48y
#
# Option B (wipe DB): stop stack, then:
#   docker volume rm zdbhyyhegz6ojbpdwa5pk48y_postgres_data
# and redeploy from Coolify.

set -e

PASSWORD="${1:-postgres}"
PROJECT="${2:-zdbhyyhegz6ojbpdwa5pk48y}"

PG_CONTAINER="$(docker ps --format '{{.Names}}' | grep "postgres-${PROJECT}" | head -1)"
if [ -z "$PG_CONTAINER" ]; then
  echo "ERROR: No running postgres container matching postgres-${PROJECT}"
  echo "Containers:"
  docker ps --format '{{.Names}}' | grep postgres || true
  exit 1
fi

echo "Postgres container: $PG_CONTAINER"
echo "Setting password for user postgres to: (hidden)"

# Local socket inside the container uses trust auth — no password needed for this command.
docker exec "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER postgres WITH PASSWORD '${PASSWORD}';"

BACKEND_CONTAINER="$(docker ps --format '{{.Names}}' | grep "backend-${PROJECT}" | head -1)"
if [ -n "$BACKEND_CONTAINER" ]; then
  echo "Restarting backend: $BACKEND_CONTAINER"
  docker restart "$BACKEND_CONTAINER"
else
  echo "No backend container found — restart the stack from Coolify after this script."
fi

echo "Done. Watch backend logs for migrations/bootstrap (no more P1000)."
