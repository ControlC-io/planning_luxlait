-- CreateEnum
CREATE TYPE "MachineImportance" AS ENUM ('MANDATORY', 'PRIORITY', 'OPTIONAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "password" TEXT,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "providerConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_endpoint_mappings" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_endpoint_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_employees" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "default_team_id" UUID,
    "is_team_leader" BOOLEAN NOT NULL DEFAULT false,
    "is_backup" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_machines" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "machine_group" TEXT,
    "max_employees" INTEGER NOT NULL DEFAULT 1,
    "short_name" TEXT,
    "importance" "MachineImportance" NOT NULL DEFAULT 'OPTIONAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_time_slots" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#E5E7EB',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "short_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_machine_open_shifts" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "time_slot_id" UUID NOT NULL,

    CONSTRAINT "luxlait_machine_open_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_machine_downtimes" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machine_downtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_statuses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#9CA3AF',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_profiles" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "luxlait_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_employee_machine_skills" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,

    CONSTRAINT "luxlait_employee_machine_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_daily_assignments" (
    "id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "employee_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "time_slot_id" UUID,
    "team_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_daily_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_team_daily_slots" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_team_daily_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_weekly_assignments" (
    "id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "team_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "luxlait_weekly_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_weekly_employee_statuses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_weekly_employee_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_settingKey_key" ON "system_settings"("settingKey");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_userId_key" ON "two_factor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_endpoint_mappings_roleId_endpoint_method_key" ON "role_endpoint_mappings"("roleId", "endpoint", "method");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_machine_open_shifts_machine_id_time_slot_id_key" ON "luxlait_machine_open_shifts"("machine_id", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_machine_downtimes_machine_id_day_date_key" ON "luxlait_machine_downtimes"("machine_id", "day_date");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_profiles_user_id_key" ON "luxlait_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_employee_machine_skills_employee_id_machine_id_key" ON "luxlait_employee_machine_skills"("employee_id", "machine_id");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_daily_assignments_day_date_employee_id_key" ON "luxlait_daily_assignments"("day_date", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_weekly_employee_statuses_day_date_employee_id_key" ON "luxlait_weekly_employee_statuses"("day_date", "employee_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_endpoint_mappings" ADD CONSTRAINT "role_endpoint_mappings_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_employees" ADD CONSTRAINT "luxlait_employees_default_team_id_fkey" FOREIGN KEY ("default_team_id") REFERENCES "luxlait_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_open_shifts" ADD CONSTRAINT "luxlait_machine_open_shifts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_open_shifts" ADD CONSTRAINT "luxlait_machine_open_shifts_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_downtimes" ADD CONSTRAINT "luxlait_machine_downtimes_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_profiles" ADD CONSTRAINT "luxlait_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_employee_machine_skills" ADD CONSTRAINT "luxlait_employee_machine_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_employee_machine_skills" ADD CONSTRAINT "luxlait_employee_machine_skills_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_daily_assignments" ADD CONSTRAINT "luxlait_daily_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_daily_assignments" ADD CONSTRAINT "luxlait_daily_assignments_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_daily_assignments" ADD CONSTRAINT "luxlait_daily_assignments_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_daily_assignments" ADD CONSTRAINT "luxlait_daily_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "luxlait_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_team_daily_slots" ADD CONSTRAINT "luxlait_team_daily_slots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "luxlait_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_team_daily_slots" ADD CONSTRAINT "luxlait_team_daily_slots_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_assignments" ADD CONSTRAINT "luxlait_weekly_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "luxlait_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_assignments" ADD CONSTRAINT "luxlait_weekly_assignments_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_assignments" ADD CONSTRAINT "luxlait_weekly_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_employee_statuses" ADD CONSTRAINT "luxlait_weekly_employee_statuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_employee_statuses" ADD CONSTRAINT "luxlait_weekly_employee_statuses_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "luxlait_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
