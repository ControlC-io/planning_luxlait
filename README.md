# Luxlait Planning

Luxlait Planning is a workforce scheduling application for the dairy plant. It
covers the full operations cycle: machine catalogue, employee skill matrix
(polyvalence), shift openings and closures, planned downtimes, leaves catalogue,
weekly and daily assignments, and an automatic planner that calls a CP SAT
solver (Google OR Tools) to propose valid plannings under a configurable set of
hard, soft and preference constraints.

The stack is fully containerised through Docker Compose, with strict network
segmentation between the DMZ (frontend + reverse proxy) and the internal
network (backend, database, email service, solver service).

## Architecture

```text
                     ┌─────────────────────────────────────────┐
                     │              dmz_net (public)            │
                     │                                          │
   user (browser) ──▶│  reverse_proxy (nginx)  ──▶ frontend     │
                     │           │                              │
                     └───────────┼──────────────────────────────┘
                                 │ /api  (proxied only)
                     ┌───────────┴──────────────────────────────┐
                     │            internal_net (private)        │
                     │                                          │
                     │   backend_api (Express + Prisma)         │
                     │        │            │            │       │
                     │        ▼            ▼            ▼       │
                     │   database   email_service  solver_service │
                     │  (Postgres)   (SendGrid)    (FastAPI + OR Tools) │
                     └──────────────────────────────────────────┘
```

| Service | Network | Role |
|---------|---------|------|
| `nginx` (`reverse_proxy`) | `dmz_net` + `internal_net` | TLS termination, routes `/` to the SPA, `/api/*` to the backend, exposes ports `80` and `443`. |
| `frontend` (`frontend_app`) | `dmz_net` | React 18 + Vite + Tailwind SPA. Login flow, planning grid, admin pages (employees, machines, skills, closures, leaves, constraints). |
| `backend` (`backend_api`) | `internal_net` | Express + TypeScript API. Better Auth for sessions, JWT for protected API calls, RBAC, planning endpoints, autoplan orchestration, Swagger UI. |
| `postgres` (`database`) | `internal_net` | PostgreSQL 16. Better Auth tables, RBAC, Luxlait planning tables, solver constraints catalogue, audit logs. |
| `email_service` | `internal_net` | Express microservice. Sends 2FA OTP emails through SendGrid. |
| `solver_service` | `internal_net` | FastAPI + OR Tools (CP SAT) microservice. Receives a planning model and returns assignment proposals. |

The frontend container never touches the database directly; all writes go
through the backend on the internal network.

## Tech stack

* **Frontend**: React 18, Vite 5, TypeScript 5.6, Tailwind CSS, React Router 7,
  Zustand, TanStack Query, Better Auth client.
* **Backend**: Node 20, Express 4, TypeScript 5.3, Prisma 5 (PostgreSQL),
  Better Auth 1.4 with Two Factor plugin, JWT, bcryptjs, Swagger UI.
* **Solver**: Python 3.12, FastAPI 0.115, Pydantic 2, Google OR Tools 9.11
  (CP SAT).
* **Email**: Express + `@sendgrid/mail`.
* **Infrastructure**: Docker, Docker Compose, NGINX 1.x.
* **Database**: PostgreSQL 16.

## Repository layout

```text
luxlait/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # Better Auth + RBAC + Luxlait + solver constraints
│   │   └── migrations/              # SQL migrations including solver constraints seed
│   ├── src/
│   │   ├── index.ts                 # Express server, route mounts
│   │   ├── lib/                     # auth (Better Auth), prisma client, swagger, RBAC, email client
│   │   ├── middleware/              # jwtAuth (centralised JWT + RBAC), adminAuth, auditLog
│   │   ├── routes/                  # auth, betterAuthProxy, admin, roles, counter, planning, autoplan, solverConstraints
│   │   └── scripts/
│   │       ├── bootstrap.ts         # Production bootstrap orchestrator (run by docker-entrypoint.sh)
│   │       ├── seed.ts              # SystemSettings + RBAC roles + planning endpoint mappings
│   │       ├── seed-admin.ts        # Provision the admin user via Better Auth
│   │       ├── seed-luxlait-real.ts # Real Luxlait reference data (machines, employees, skills, shifts, leaves)
│   │       ├── seed-planning.ts     # Demo planning data (development only)
│   │       └── test-auth.ts         # Inspect users, sessions, system settings
│   ├── docker-entrypoint.sh         # prisma generate + migrate deploy + bootstrap.ts
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Routes (planning, login, 2FA challenges, demo mode)
│   │   ├── pages/                   # LuxlaitApp, admin pages, auth pages
│   │   ├── features/planning/       # Planning grid views, cells, modals
│   │   ├── components/              # RequireAuth, layout, admin shells
│   │   ├── context/                 # PlanningDataContext, DemoModeContext
│   │   └── lib/                     # api (Better Auth client + fetch wrapper), planningApi, helpers
│   └── Dockerfile
├── solver_service/
│   ├── app.py                       # FastAPI app, POST /solve, GET /health
│   ├── solver.py                    # CP SAT model (OR Tools)
│   ├── models.py                    # Pydantic request/response schemas
│   ├── requirements.txt
│   └── Dockerfile
├── email_service/
│   ├── src/index.ts                 # Express microservice, POST /send-otp via SendGrid
│   └── Dockerfile
├── nginx/
│   └── nginx.conf                   # Reverse proxy: / -> frontend, /api -> backend
├── docker-compose.yml               # Orchestration of the 6 services
├── .env.example                     # Reference for all environment variables
├── architecture.md                  # Network topology specification
├── auth_spec.md                     # Dynamic authentication design
└── README.md                        # This file
```

## Prerequisites

* Docker 24+ and Docker Compose v2 (i.e. `docker compose` as a subcommand).
* About 4 GB of free RAM.
* Optional: Node.js 20+ if you want to run scripts on the host (Prisma CLI,
  ad hoc seeds, etc).

## Quick start

```bash
# 1. Copy and edit environment variables
cp .env.example .env
# At a minimum set: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, JWT_SECRET,
# BETTER_AUTH_SECRET, ADMIN_SECRET, EMAIL_SERVICE_SECRET, SOLVER_SERVICE_SECRET,
# POSTGRES_PASSWORD and DATABASE_URL.

# 2. Build and start the full stack
docker compose up --build -d

# 3. Watch the bootstrap finish
docker compose logs -f backend
# Expect: "===== Bootstrap completed in <ms> ms ====="

# 4. Open the app
open http://localhost
# Sign in with ADMIN_EMAIL / ADMIN_PASSWORD from .env
```

The backend container automatically applies Prisma migrations and runs the
production bootstrap on startup. On a fresh database it provisions the admin
account, RBAC roles, system settings and the Luxlait reference data. On
subsequent boots every step is a no op since data already exists.

## Production VM bootstrap

`backend/docker-entrypoint.sh` runs the following sequence each time the
backend container starts:

1. `npx prisma generate` regenerates the Prisma client.
2. `npx prisma migrate deploy` applies any pending SQL migrations. The
   migration `20260508120000_add_solver_constraints` also seeds the 22 solver
   constraints catalogue (legal, safety, production, RH, preferences).
3. `npx ts-node src/scripts/bootstrap.ts` runs the production bootstrap when
   `BOOTSTRAP_ON_BOOT=true` (the default).
4. The Express API starts (`npm run dev` in development, `npm start` if you
   replace the CMD with the compiled build).

The bootstrap orchestrates five idempotent stages:

| Stage | Action | When it acts |
|-------|--------|--------------|
| `seedAuthSettings` | Inserts `auth_email_password_enabled`, `auth_google_enabled`, `auth_github_enabled`. | Inserts only the missing keys. |
| `seedRoles` | Creates the RBAC roles `Admin User` and `Manager`. | Inserts only the missing roles. |
| `seedAdmin` | Creates the admin user via Better Auth (`POST /sign-up/email`), forces `emailVerified=true`, attaches the `Admin User` role and creates the `LuxlaitProfile`. | Skips creation if a user with `ADMIN_EMAIL` already exists. The password is **never** overwritten; only role, profile and verified flag are repaired. |
| `seedPlanningRbac` | Inserts the `* /api/planning` endpoint mappings for both roles, then assigns the `Manager` role to every existing non admin user. | Idempotent upserts. |
| `seedLuxlaitReal({ skipIfPopulated: true })` | Inserts 8 machines, 35 employees, 3 time slots (Matin, Après midi, Nuit), 1 leave status, 98 skills, 24 open shifts, 1590 weekly closed shifts (recurring all year), 24 global staffing requirements and the May 2026 leaves catalogue. | Runs **only** when both `luxlait_machines` and `luxlait_employees` are empty. Never purges existing data. |

`seedAdmin` validates the credentials at startup. If `ADMIN_EMAIL` is missing or
`ADMIN_PASSWORD` is shorter than 8 characters the container exits with a clear
error rather than starting in a half configured state.

Set `BOOTSTRAP_ON_BOOT=false` only when you want to skip the seeds, for
example when restoring from a backup or running a manual recovery script.

### Manual seed scripts

```bash
docker compose exec backend npm run seed:bootstrap
# Replays the orchestrator the entrypoint runs (idempotent everywhere).

docker compose exec backend npm run seed:admin
# Repairs only the admin user (creates from ADMIN_EMAIL / ADMIN_PASSWORD if
# missing, then enforces role, profile and emailVerified).

docker compose exec backend npm run seed
# Re-runs the SystemSettings, RBAC roles and planning endpoint mappings only.

docker compose exec backend npm run seed:luxlait
# DESTRUCTIVE: purges every luxlait_* table and reloads the reference data.
# Reserved for development. Never run on a production VM with real data.

docker compose exec backend npm run seed:planning
# Generates synthetic planning demo data (employees, skills, etc) for dev.
```

### Reset the database to a clean state

```bash
docker compose down -v        # drops the postgres_data volume
docker compose up --build -d  # entrypoint reapplies migrations + bootstrap
```

## Environment variables

`.env.example` is the source of truth. Every variable below must be present in
`.env` before the first `docker compose up`.

| Variable | Purpose |
|----------|---------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL credentials and database name. |
| `DATABASE_URL` | Connection string used by Prisma. Use the docker service name `postgres` as host. |
| `NODE_ENV` | `development` or `production`. |
| `ADMIN_SECRET` | Shared secret guarding `/api/admin/*` endpoints (header `x-admin-secret`). |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Signing key and lifetime for the API JWT. |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS` | Better Auth session cookie encryption, public base URL and allowed origins. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Initial admin account provisioned by the bootstrap. Change before deploying to a new VM. |
| `BOOTSTRAP_ON_BOOT` | `true` (default) to run the bootstrap on container start. |
| `EMAIL_SERVICE_URL`, `EMAIL_SERVICE_SECRET`, `EMAIL_SERVICE_PORT` | URL and shared secret between backend and `email_service`. |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Used only by `email_service` to deliver OTP messages. |
| `SOLVER_SERVICE_URL`, `SOLVER_SERVICE_SECRET` | URL and shared secret between backend and `solver_service`. |

Generate strong secrets with:

```bash
openssl rand -base64 32
```

## Services and URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend (planning app) | http://localhost | Reverse proxied by nginx. |
| API root | http://localhost/api | Proxied to `backend_api:3000`. |
| Health check | http://localhost/api/health | Returns DB latency + service status. |
| Swagger UI | http://localhost/api/docs | OpenAPI spec for auth, planning, admin and roles. |
| Demo mode | http://localhost/demo | Read only anonymised planning. |
| Prisma Studio | http://localhost:5555 | After `docker compose exec backend npx prisma studio`. |
| Postgres | `localhost:5432` | Exposed for development; comment out in production. |

## Authentication and RBAC

* **Login**: Better Auth handles sessions through `/api/auth/sign-in/email`,
  `/api/auth/sign-out`, `/api/auth/get-session`. The frontend uses the Better
  Auth client.
* **Two Factor**: TOTP via the `twoFactor` plugin or email OTP delivered by
  `email_service`. The 2FA challenge pages live in `frontend/src/pages/auth`.
* **JWT**: After login the frontend can request a Bearer JWT through
  `GET /api/auth/jwt-from-session` or `POST /api/auth/token`. Protected API
  calls go through the centralised `jwtAuth` middleware which also enforces
  RBAC by checking `RoleEndpointMapping` rows.
* **Admin API**: `/api/admin/*` is gated by `adminAuth` (header
  `x-admin-secret`). It is bypassed by the JWT middleware on purpose.
* **Default roles**: `Admin User` (full access) and `Manager` (read and write
  on planning). Admin gets all access; managers are auto attached to
  `* /api/planning` by the bootstrap. The bootstrap also assigns the
  `Manager` role to every existing non admin user.

## Planning model overview

The Prisma schema ships the following Luxlait tables (all prefixed
`luxlait_`):

* `luxlait_machines` with `importance` (`MANDATORY`, `PRIORITY`, `OPTIONAL`),
  `max_employees`, `sort_order` and `machine_group`.
* `luxlait_employees` with `is_backup` and `active` flags.
* `luxlait_employee_machine_skills` with a `level` enum (`AUTONOMOUS`,
  `IN_TRAINING`).
* `luxlait_time_slots` (Matin, Après midi, Nuit by default).
* `luxlait_machine_open_shifts` (which slots a machine accepts).
* `luxlait_weekly_machine_closed_shifts` (per ISO week + weekday closures).
* `luxlait_machine_staffing_requirements` (with a sentinel date `1970-01-01`
  for the global recurring requirement).
* `luxlait_machine_downtimes` and `luxlait_machine_downtime_shifts` plus their
  default catalogue counterparts.
* `luxlait_statuses`, `luxlait_weekly_employee_statuses`,
  `luxlait_weekly_employee_shift_statuses`, `luxlait_default_leaves`.
* `luxlait_daily_assignments` and `luxlait_weekly_assignments`.
* `luxlait_solver_constraints` (22 rows seeded by SQL migration, exposed
  read mostly to the admin UI).
* `luxlait_profiles` linking Better Auth `User` to a planning profile.

Routes:

* `GET/PATCH /api/planning/*` for the catalogue and the assignments.
* `POST /api/planning/autoplan` triggers the solver service.
* `GET /api/planning/luxlait_solver_constraints` exposes the constraints
  catalogue read by the **Contraintes** admin page.

## Common operations

```bash
# Container management
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose up -d --build backend     # rebuild only the backend

# Database and Prisma
docker compose exec backend npx prisma migrate status
docker compose exec backend npx prisma studio
docker compose exec database psql -U postgres -d luxlait_db

# Authentication smoke test
docker compose exec backend npm run test:auth

# Health checks
curl http://localhost/api/health
curl http://localhost/api  # {"message":"Backend API is running"}
```

## Demo mode

The frontend exposes a read only demo mount at `/demo`. It loads an
anonymised version of the planning bundle (see
`frontend/src/lib/demoAnonymizePlanningBundle.ts`) and skips destructive
actions. Use it to share the UI publicly without exposing real Luxlait names
or schedules.

## Production deployment checklist

Before exposing the stack to the internet:

1. **Network hardening (`docker-compose.yml`):**
   * Set `internal_net.internal: true` so internal services have no internet
     route.
   * Remove the public `5432:5432` port mapping on the `postgres` service.
   * Remove the public `5555` Prisma Studio port mapping on the `backend`
     service.
2. **Secrets:** regenerate every secret with `openssl rand -base64 32`. At a
   minimum: `BETTER_AUTH_SECRET`, `JWT_SECRET`, `ADMIN_SECRET`,
   `EMAIL_SERVICE_SECRET`, `SOLVER_SERVICE_SECRET`, `POSTGRES_PASSWORD`.
3. **Admin credentials:** set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (16+ characters)
   and `ADMIN_NAME` to real values. After the first successful login, change
   the admin password from the user profile to invalidate the value stored in
   `.env`.
4. **TLS:** mount real certificates in `nginx/`, enable port `443` and force
   redirects from port `80`.
5. **CORS / origins:** set `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` to your
   public domain.
6. **NODE_ENV=production** and consider switching the backend `CMD` to
   `npm run build && npm start` for a compiled artefact instead of
   `ts-node-dev`.
7. **Database backups:** schedule `pg_dump` of the `database` container or use
   a managed Postgres instance.

## Troubleshooting

| Symptom | Investigation |
|---------|---------------|
| Backend container restarts in a loop. | `docker compose logs backend`. Most often the bootstrap aborted because of `ADMIN_EMAIL` / `ADMIN_PASSWORD` missing in `.env`. |
| Login returns `Invalid email or password`. | Verify `ADMIN_PASSWORD` in `.env` matches what the user types. The bootstrap never overwrites an existing user; if the user existed with another password, reset it through `/api/auth/forgot-password` or delete the row and rerun `seed:admin`. |
| Frontend cannot reach the API. | Check that `nginx` is up (`docker compose ps`) and that `nginx.conf` resolves the `backend` service. The frontend always calls `/api/*` through nginx. |
| Solver returns `error: solver exception`. | Ensure `SOLVER_SERVICE_SECRET` matches between backend and solver, and that the request payload matches `solver_service/models.py`. |
| Email OTP never arrives. | Verify `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (must be a verified sender) and the SendGrid dashboard for blocked recipients. |
| `prisma migrate deploy` fails. | Run `docker compose exec backend npx prisma migrate status` and inspect the failed migration. Never `npx prisma db push` against a database that already has migrations applied. |

## License

Private project. All rights reserved.
