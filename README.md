# MyRTest - Secure DMZ Architecture

A secure multi tier application implementing network segmentation with separate DMZ and internal networks using Docker Compose. Requirements and auth design: see [new_requisites.md](new_requisites.md) and [auth_spec.md](auth_spec.md).

## Using this template

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in values (no real secrets in the repo).
3. Optionally replace the project name "MyRTest" and database name `myrtest` with your own.
4. Follow **Quick Start** below to run with Docker.

## Architecture Overview

This project implements a secure DMZ (Demilitarized Zone) architecture with two isolated networks and multiple services:

### DMZ Network (`dmz_net`)
* **NGINX Reverse Proxy** (`reverse_proxy`): Entry point, handles routing, health checks and SSL termination
* **Main Frontend** (`main_frontend_app`): React/Vite app for end users (Home, Login, Register, Dashboard, Counter, 2FA)
* **Admin Frontend** (`admin_frontend_app`): React/Vite admin panel (Settings, Audit Logs, Database view, User Roles placeholder)

### Internal Network (`internal_net`)
* **Express Backend** (`backend_api`): Business logic, authentication, RBAC and database access
* **PostgreSQL Database** (`database`): Stores users, sessions, roles, feature flags, audit logs, etc.
* **Email Service** (`email_service`): Dedicated microservice that sends 2FA (OTP) emails via SendGrid

## Key Features

* **Network Isolation**: Frontends in the DMZ never touch the database directly; they only talk to the backend
* **Dynamic Authentication**: Better Auth with database‑driven provider configuration stored in `system_settings`
* **JWT + Sessions**: Session cookies for Better Auth, plus JWT Bearer tokens for protected API routes
* **Two‑Factor Authentication (2FA)**: TOTP via Better Auth plugin and optional email‑OTP via the `email_service`
* **Role Based Access Control (RBAC)**: `Role`, `UserRole` and `RoleEndpointMapping` models controlling access per endpoint
* **Counter Test Feature**: A persisted counter API used by the Main Frontend to prove centralized JWT + RBAC enforcement
* **Audit Logging**: `AuditLog` table with hooks for sign‑in / sign‑up / sign‑out and admin operations
* **API Documentation**: OpenAPI/Swagger UI served at `/api/docs`
* **Type Safety**: Full TypeScript support across frontend and backend
* **Modern Stack**: React + Vite, Express, Prisma ORM, Docker, NGINX
* **Feature Flags**: `SystemSettings` model for runtime configuration

## Compliance with new_requisites.md

This section maps each requirement from [new_requisites.md](new_requisites.md) to the current implementation.

### 1. Backend and Security — Implemented

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| **Centralized Middleware** | Done | Single [jwtAuth](backend/src/middleware/jwtAuth.ts) middleware; all non-public routes require JWT. Admin API uses [adminAuth](backend/src/middleware/adminAuth.ts) with `x-admin-secret`. No per-endpoint auth logic. |
| **JWT Authentication** | Done | Backend validates Bearer JWT in `jwtAuth`, verifies identity and attaches `req.user`; session-based Better Auth is used only for login/register, then JWT is issued for API access. |
| **API Documentation** | Done | OpenAPI/Swagger at `GET /api/docs` ([swagger.ts](backend/src/lib/swagger.ts)); routes documented with JSDoc. |

### 2. Frontend Separation and Testing — Implemented

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| **App Split** | Done | Two apps: [main_frontend](main_frontend/) (port 5173 / behind nginx 80) and [admin_frontend](admin_frontend/) (port 5174 / behind nginx 8080). |
| **Counter Test Feature** | Done | [Counter](main_frontend/src/components/Counter.tsx) in Main Frontend calls `GET/POST /api/counter` and [counter routes](backend/src/routes/counter.ts) persist value in `SystemSettings`. |
| **Protected UI** | Done | Counter sends `Authorization: Bearer <JWT>`; without a valid JWT (or with insufficient role) the API returns 401/403, proving centralized middleware enforcement. |

### 3. Role Based Access Control (RBAC) — Backend done; Admin UI placeholder

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| **Role Management** | Backend done | Full CRUD in [roles.ts](backend/src/routes/roles.ts): `GET/POST/DELETE /api/admin/roles`. Admin App has a **User Roles** tab that is still a **placeholder** (static data, no API calls). |
| **Specific Roles** | Done | Roles "Admin User" and "Manager" are created by the [seed script](backend/src/scripts/seed.ts). You can also create more via API or future Admin UI. |
| **Endpoint Mapping** | Backend done | [RoleEndpointMapping](backend/prisma/schema.prisma) and API: `GET/POST/DELETE /api/admin/roles/:id/endpoints`. No UI in Admin App yet to configure which endpoints each role can access. |
| **User Assignment** | Backend done | `POST /api/admin/users/:id/roles`, `DELETE /api/admin/users/:id/roles/:roleId`. No UI in Admin App yet to assign/revoke roles per user. |

RBAC is enforced: [jwtAuth](backend/src/middleware/jwtAuth.ts) checks `RoleEndpointMapping` before allowing access. To manage roles and assignments today, use the API (e.g. via Swagger at `/api/docs`) or Prisma Studio.

### 4. Two Factor Authentication (2FA) and Infrastructure — Implemented

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| **Email 2FA** | Done | Flow: `POST /api/auth/token` (if user has `twoFactorEnabled`) returns `requires2FA` and sends OTP via [email_service](email_service/); client calls `POST /api/auth/verify-otp` with code to get JWT. [auth routes](backend/src/routes/auth.ts), [EmailOtpChallenge](main_frontend/src/pages/EmailOtpChallenge.tsx). |
| **SendGrid Integration** | Done | [email_service](email_service/src/index.ts) uses `@sendgrid/mail`; OTP emails sent from `SENDGRID_FROM_EMAIL`. |
| **Dedicated Docker Service** | Done | [email_service](email_service/) runs as its own container in [docker-compose.yml](docker-compose.yml); backend calls it via `EMAIL_SERVICE_URL`. |
| **Secret Management** | Done | SendGrid key and config in `.env` only; [.gitignore](.gitignore) excludes `.env`; [.env.example](.env.example) documents variables without real secrets. |

## Quick Start Guide

```bash
# 1. Start all services
docker-compose up --build -d

# 2. Wait 30 seconds for initialization

# 3. Initialize database schema (first time only)
cd backend
npx prisma db push
cd ..

# 4. Seed auth configuration (first time only)
docker exec backend_api npm run seed

# 5. Open browser
# Visit: http://localhost
# Click "Create Account" and register
```

## Common Commands

```bash
# View all users and sessions
docker exec backend_api npm run test:auth

# Open database GUI (Prisma Studio)
docker exec -it backend_api npx prisma studio
# Then visit: http://localhost:5555

# View logs
docker logs backend_api -f

# Restart a service
docker-compose restart backend

# Stop everything
docker-compose down

# Reset database (deletes all data)
docker-compose down -v && docker-compose up -d
```

## Local Development (Backend and Frontends on Your Machine)

Use this flow when you want to run the backend and frontends on your host (e.g. on Windows, to avoid Prisma engine issues when using Docker for the backend).

**Requirements:** Node.js 20+, PostgreSQL reachable at `localhost:5432` (you can run only the database with Docker).

### First Time Setup

1. **Start only the database** (from the project root):

   ```bash
   docker-compose up -d postgres
   ```

   (Or use a local PostgreSQL instance with user `postgres`, password `postgres`, database `myrtest`.)

2. **Backend: schema and seed data**

   ```bash
   cd backend
   npx prisma db push
   npm run seed
   ```

3. **Frontends:** no special first time steps required.

### Every Time You Start Everything

1. **Database:** if you use Docker only for Postgres:

   ```bash
   docker-compose up -d postgres
   ```

2. **Backend** (terminal 1):

   ```bash
   cd backend
   npm run dev
   ```

   It should be running at `http://localhost:3000`.

3. **Main Frontend** (terminal 2):

   ```bash
   cd main_frontend
   npm install
   npm run dev
   ```

   It will be available at `http://localhost:5173`.

4. **Admin Frontend** (terminal 3):

   ```bash
   cd admin_frontend
   npm install
   npm run dev
   ```

   By default it runs on `http://localhost:5174`. When using Docker/nginx you typically access it via `http://localhost:8080` instead.

5. **Use the app:** open **http://localhost:5173** in your browser for the Main Frontend, and **http://localhost:8080** for the Admin panel when running via Docker/nginx.

### Environment Variables

- **Root `.env` (backend + infrastructure):** see `.env.example` for all required variables such as `DATABASE_URL`, `ADMIN_SECRET`, `JWT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `EMAIL_SERVICE_SECRET`, `EMAIL_SERVICE_URL`, etc. **Do not commit real secrets; use `.env.example` as a template.**
- **Admin Frontend:** `admin_frontend/.env` (or `.env.local`) with:
  - `VITE_API_URL` (optional). When running behind nginx (`http://localhost:8080`), you can leave it empty to use relative `/api` calls. For direct dev against the backend without nginx, set `VITE_API_URL=http://localhost:3000`.
  - `VITE_ADMIN_SECRET` which must match `ADMIN_SECRET` in the backend `.env`.

## Project Structure

```text
myrtest/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry point (health, auth, JWT, admin, counter)
│   │   ├── lib/
│   │   │   ├── auth.ts           # Better Auth configuration + dynamic config loader
│   │   │   ├── emailService.ts   # HTTP client to the email_service (2FA OTP)
│   │   │   └── swagger.ts        # Swagger/OpenAPI spec builder
│   │   ├── middleware/
│   │   │   ├── jwtAuth.ts        # Centralized JWT + RBAC middleware
│   │   │   ├── adminAuth.ts      # x-admin-secret admin guard
│   │   │   └── auditLog.ts       # Helper to write AuditLog entries
│   │   ├── routes/
│   │   │   ├── auth.ts           # JWT issuance + email OTP 2FA endpoints
│   │   │   ├── counter.ts        # Counter feature (protected by JWT/RBAC)
│   │   │   ├── admin.ts          # Admin settings, database overview, audit logs
│   │   │   └── roles.ts          # RBAC: roles, endpoint mappings, user-role assignment
│   │   └── scripts/
│   │       ├── seed.ts           # Seed auth and system settings
│   │       └── test-auth.ts      # Test users and sessions
│   ├── prisma/
│   │   └── schema.prisma         # Database schema (users, roles, audit_logs, etc.)
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── main_frontend/
│   ├── src/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Routes: Home, Login, Register, Dashboard, 2FA flows
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # Auth state, Better Auth client, JWT handling
│   │   ├── components/
│   │   │   ├── Navbar.tsx        # Main navigation (with link to Admin panel)
│   │   │   ├── LoginForm.tsx     # Login form with 2FA hooks
│   │   │   ├── RegisterForm.tsx  # Register form
│   │   │   └── Counter.tsx       # Counter UI hitting /api/counter endpoints
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TwoFactorChallenge.tsx   # TOTP 2FA flow
│   │   │   └── EmailOtpChallenge.tsx    # Email OTP 2FA flow
│   │   └── index.css             # Tailwind styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
├── admin_frontend/
│   ├── src/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Routing + ProtectedRoute wrapper
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # Admin-side auth using Better Auth
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── SettingsTab.tsx   # SystemSettings editor (feature flags, auth config)
│   │   │   ├── LogsTab.tsx       # Audit logs table
│   │   │   └── DatabaseTab.tsx   # Database table counts and redacted views
│   │   ├── pages/
│   │   │   └── AdminDashboard.tsx # Tabs: Settings, Audit Logs, Database, User Roles (placeholder)
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
├── email_service/
│   ├── src/
│   │   └── index.ts              # Express microservice, /send-otp via SendGrid
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf                # Reverse proxy configuration (port 80 + 8080)
├── docker-compose.yml            # Multi-container orchestration (backend, DB, frontends, email, nginx)
├── .env                          # Environment variables (not committed; see .env.example)
├── .env.example                  # Example configuration without real secrets
└── README.md                     # This file
```

## Getting Started

### Prerequisites

* Docker and Docker Compose installed
* Node.js 20+ (optional, only for local development outside Docker)

### Quick Start (Recommended)

**Step 1: Configure Environment**

The `.env` file is already created with default values. For production, update:
* `BETTER_AUTH_SECRET`: Generate with `openssl rand -base64 32`

**Step 2: Start All Services**

From the project root:
```bash
# Build and start all containers
docker-compose up --build -d

# Wait about 30 seconds for services to initialize
```

**Step 3: Initialize Database Schema**

```bash
# Push the Prisma schema to the database
cd backend
npx prisma db push

# Seed authentication configuration
cd ..
docker exec backend_api npm run seed
```

**Step 4: Access the Application**

Open your browser and visit: **http://localhost**

You should see the home page with "Sign In" and "Create Account" buttons.

**Step 5: Create Your First User**

1. Click **"Create Account"**
2. Fill in the form (name, email, password min 8 chars)
3. Click **"Create Account"**
4. You will be automatically logged in and redirected to the Dashboard

Done! Your DMZ architecture with authentication is now running.

### Starting Services After First Setup

Once you've done the initial setup, you only need:

```bash
# Start everything
docker-compose up -d

# Or with rebuild if you changed code
docker-compose up --build -d
```

### Development with Local Node Modules

If you want to install dependencies locally (for IDE autocomplete, etc.):

```bash
# Install backend dependencies
cd backend
npm install

# Install main frontend dependencies
cd ../main_frontend
npm install

# Install admin frontend dependencies (optional)
cd ../admin_frontend
npm install
```

Note: The containers use their own `node_modules` via Docker volumes, so local installation is optional and only for IDE support.

### Accessing the Application

| Service | URL | Description |
|---------|-----|-------------|
| **Main Frontend** | http://localhost | Main application UI (Home/Login/Register/Dashboard/Counter/2FA) |
| **Admin Frontend** | http://localhost:8080 | Admin panel (Settings, Audit Logs, Database, Roles placeholder) |
| **Backend API** | http://localhost/api | API endpoints (auth, counter, admin, roles) |
| **Health Check** | http://localhost/api/health | Backend health status (DB latency, service status) |
| **NGINX Health** | http://localhost/nginx-health | Proxy health status |
| **Prisma Studio** | http://localhost:5555 | Database GUI (after running command) |

## Quick Verification Checklist

After starting the stack, you can quickly confirm that everything is wired correctly with these steps:

1. **Backend health:** Visit `http://localhost/api/health` and check that `status` is `ok` and `database.ok` is `true`.
2. **Main app UI:** Visit `http://localhost`, register a user and log in; you should be redirected to the Dashboard.
3. **Admin panel:** Visit `http://localhost:8080`, log in with an existing user and open the **Settings**, **Audit Logs** and **Database** tabs.
4. **Counter feature:** From the main Dashboard, use the Counter controls; the values should persist and be reflected in the admin **Database** tab (`system_settings` key `counter`). Requests are protected by JWT + RBAC.
5. **2FA Email (optional):** If `SENDGRID_API_KEY` and `EMAIL_SERVICE_SECRET` are configured, enable email 2FA for a user and verify you receive OTP codes and can complete login via the email challenge page.
6. **API docs:** Visit `http://localhost/api/docs` to inspect and try the documented endpoints (auth, counter, admin, roles).

### Smoke Test 4: Local Docker Template Availability

This step validates that the Docker Compose template starts cleanly and the NGINX reverse proxy correctly forwards health traffic to the backend.

**Prerequisites**

* Docker and Docker Compose are installed and the daemon is running.
* The `.env` file exists at the project root. If it does not, copy the example first:

  ```bash
  cp .env.example .env
  ```

* If this is the very first run, complete the initialization steps from **Quick Start** above (schema push and seed) before running the health check below.

**Start the stack**

From the project root:

```bash
docker-compose up --build -d
```

Wait approximately 30 seconds for all containers to reach a ready state.

**Verify containers are running**

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected: all six services (`reverse_proxy`, `main_frontend_app`, `admin_frontend_app`, `backend_api`, `email_service`, `database`) appear with a status of `Up`.

**Check service health via the proxy**

```bash
curl -s http://localhost/api/health
```

Expected response shape:

```json
{
  "status": "ok",
  "database": { "ok": true }
}
```

The smoke test passes when `status` is `"ok"` and `database.ok` is `true`. Any other values indicate a configuration or startup problem; consult `docker-compose logs` to diagnose.

### Docker Container Management

**View Running Containers:**
```bash
docker ps
```

**View Logs:**
```bash
# All services (follow mode)
docker-compose logs -f

# Specific service
docker logs backend_api -f
docker logs main_frontend_app -f
docker logs admin_frontend_app -f
docker logs email_service -f
docker logs reverse_proxy -f
docker logs database -f

# Last 50 lines
docker logs backend_api --tail 50
```

**Stop Services:**
```bash
# Stop but keep data
docker-compose down

# Stop and remove all data (including database)
docker-compose down -v
```

**Restart Services:**
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart main_frontend
docker-compose restart admin_frontend
docker-compose restart email_service
docker-compose restart nginx
```

**Rebuild After Code Changes:**
```bash
# Rebuild and restart specific service
docker-compose up -d --build backend

# Rebuild everything
docker-compose up --build -d
```

## Database Schema

### User Model
Compatible with Better Auth, includes fields for email, name, OAuth providers.

### SystemSettings Model
Feature flag system for dynamic authentication configuration:
* `settingKey`: Unique identifier (e.g., `auth_google_enabled`)
* `isEnabled`: Boolean flag to enable/disable features
* `providerConfig`: JSON field for additional configuration

## Security Features

* Network segmentation via Docker networks
* No direct database access from DMZ
* Security headers configured in NGINX
* Environment variable based configuration
* No hardcoded credentials

## Testing Authentication

### Initial Setup

After starting the application for the first time, seed the authentication configuration:

```bash
docker exec backend_api npm run seed
```

This creates the SystemSettings records for auth providers (email/password enabled, OAuth disabled by default).

### Creating Users via UI

1. Visit http://localhost
2. Click **Create Account**
3. Fill in the registration form:
   - Full Name: Your name
   - Email: your@email.com
   - Password: Min 8 characters
   - Confirm Password: Same as above
4. Click **Create Account**
5. You will be automatically logged in and redirected to the Dashboard

### Testing Authentication Flow

**Register a New User:**
```
Visit: http://localhost/register
Fill: Name, email, password
Result: Auto login and redirect to dashboard
```

**Login with Existing User:**
```
Visit: http://localhost/login
Fill: Email, password
Result: Redirect to dashboard
```

**Access Protected Dashboard:**
```
Visit: http://localhost/dashboard
If not logged in: Redirected to login
If logged in: See user information and status
```

**Logout:**
```
Click: Logout button on dashboard
Result: Session cleared, redirected to login
```

### Testing via Test Script

Check database state and active sessions:

```bash
docker exec backend_api npm run test:auth
```

This script shows:
- SystemSettings configuration
- All users in the database
- Active sessions

### Testing Auth Endpoints Directly

**Check Session (GET):**
```bash
curl -c cookies.txt http://localhost/api/auth/session
```

**Register (POST):**
```bash
curl -X POST http://localhost/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}' \
  -c cookies.txt
```

**Login (POST):**
```bash
curl -X POST http://localhost/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt
```

**Logout (POST):**
```bash
curl -X POST http://localhost/api/auth/sign-out \
  -b cookies.txt
```

### Database Inspection

**Important:** Use Prisma Studio from inside the Docker container to see the correct data:

```bash
docker exec -it backend_api npx prisma studio
```

This opens Prisma Studio at http://localhost:5555 connected to the Docker database.

Navigate to:
- `users` table: See all registered users
- `sessions` table: See active sessions
- `accounts` table: See authentication accounts
- `system_settings` table: See auth configuration

## Managing Users and Database

### View All Users

**Using the test script:**
```bash
docker exec backend_api npm run test:auth
```

Shows:
- All registered users with emails and names
- Active sessions
- Auth configuration settings

**Using SQL directly:**
```bash
docker exec database psql -U postgres -d myrtest -c "SELECT id, email, name FROM users;"
```

### View Active Sessions

```bash
docker exec backend_api npm run test:auth
```

Or with SQL:
```bash
docker exec database psql -U postgres -d myrtest -c "SELECT s.id, u.email, s.\"expiresAt\" FROM sessions s JOIN users u ON s.\"userId\" = u.id WHERE s.\"expiresAt\" > NOW();"
```

### Delete a Specific User

Using Prisma Studio (recommended):
```bash
docker exec -it backend_api npx prisma studio
```

Then navigate to the `users` table and delete the user visually.

**Or with SQL:**
```bash
# Replace email with the actual user email
docker exec database psql -U postgres -d myrtest -c "DELETE FROM users WHERE email = 'user@example.com';"
```

### Clear All Users, Roles and Sessions

```bash
docker exec database psql -U postgres -d myrtest -c "TRUNCATE users, accounts, sessions, roles, user_roles, role_endpoint_mappings, audit_logs, verification CASCADE;"
```

**Warning:** This deletes ALL users, roles, mappings, audit logs and sessions permanently.

### Reset Database to Fresh State

```bash
# Stop all services
docker-compose down -v

# Start services again
docker-compose up --build -d

# Wait 30 seconds, then reinitialize
cd backend
npx prisma db push
cd ..
docker exec backend_api npm run seed
```

### Access PostgreSQL Directly

```bash
# Open psql shell
docker exec -it database psql -U postgres -d myrtest

# Inside psql, you can run any SQL commands:
# \dt              - List all tables
# \d users         - Describe users table
# SELECT * FROM users;
# \q               - Exit
```

### Backup and Restore

**Create Backup:**
```bash
docker exec database pg_dump -U postgres myrtest > backup.sql
```

**Restore from Backup:**
```bash
cat backup.sql | docker exec -i database psql -U postgres -d myrtest
```

### Troubleshooting

**Issue: "Backend unavailable" on home page**
- Check: `docker logs backend_api`
- Fix: Ensure backend container is running

**Issue: Registration fails**
- Check: Password is at least 8 characters
- Check: Email is valid format
- Check: Email not already registered

**Issue: Login fails with correct credentials**
- Check: Better Auth is properly initialized
- Run: `docker exec backend_api npm run test:auth`
- Check: User exists in database

**Issue: Session not persisting**
- Check: Cookies are enabled in browser
- Check: CORS configuration allows credentials
- Check: `BETTER_AUTH_SECRET` is set in .env

**Issue: Redirect loop**
- Check: AuthContext is properly wrapping routes
- Check: Session endpoint returns valid data
- Clear browser cookies and try again

**Issue: Prisma Studio shows empty database**
- Make sure to run Prisma Studio from inside Docker: `docker exec -it backend_api npx prisma studio`
- The local Prisma Studio connects to a different database than the Docker one

**Issue: Cannot see users I created**
- Run: `docker exec backend_api npm run test:auth` to verify users exist
- Users are stored in the Docker PostgreSQL container, not locally

**Issue: Services fail to start**
- Check: `docker ps` to see which containers are running
- Check logs: `docker-compose logs`
- Try: `docker-compose down && docker-compose up --build -d`

## Production Deployment

### Security Checklist

Before deploying to production, update these configurations:

**1. Docker Compose (`docker-compose.yml`):**

Change the internal network to truly isolated:
```yaml
networks:
  internal_net:
    driver: bridge
    internal: true  # Change from false to true
```

Remove PostgreSQL port exposure:
```yaml
postgres:
  # Comment out or remove the ports section:
  # ports:
  #   - "5432:5432"
```

**2. Environment Variables (`.env`):**

Generate a strong secret:
```bash
openssl rand -base64 32
```

Update `.env`:
```
BETTER_AUTH_SECRET=<your-generated-secret>
BETTER_AUTH_URL=https://yourdomain.com
NODE_ENV=production
```

**3. NGINX Configuration:**

- Add SSL certificates
- Configure proper domain names
- Update CORS settings
- Add rate limiting
- Configure proper security headers

**4. Database:**

- Use strong PostgreSQL password
- Enable database backups
- Consider managed database service
- Set up monitoring

**5. Better Auth:**

- Configure email verification if needed
- Set up OAuth providers if needed
- Configure proper session timeouts
- Enable two factor authentication if needed

## Technologies

* **Frontend**: React 18, Vite, Tailwind CSS, TypeScript
* **Backend**: Node.js, Express, TypeScript, Prisma ORM
* **Database**: PostgreSQL
* **Auth**: Better Auth
* **Infrastructure**: Docker, Docker Compose, NGINX

## License

Private project
