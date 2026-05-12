-- Squashed migration: full DDL from prisma/schema.prisma plus planner seeds (solver catalog and system_settings).
-- This migration is intentionally idempotent so it can be safely applied on existing databases without crashing.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MachineImportance" AS ENUM ('MANDATORY', 'PRIORITY', 'OPTIONAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SkillLevel" AS ENUM ('AUTONOMOUS', 'IN_TRAINING');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SolverConstraintCategory" AS ENUM ('HARD', 'SOFT', 'PREF');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
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
CREATE TABLE IF NOT EXISTS "accounts" (
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
CREATE TABLE IF NOT EXISTS "sessions" (
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
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "providerConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "role_endpoint_mappings" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_endpoint_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_employees" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "is_backup" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_machines" (
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
CREATE TABLE IF NOT EXISTS "luxlait_time_slots" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#E5E7EB',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "short_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_weekly_machine_closed_shifts" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "iso_week" INTEGER NOT NULL,
    "machine_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_weekly_machine_closed_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_machine_open_shifts" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "time_slot_id" UUID NOT NULL,

    CONSTRAINT "luxlait_machine_open_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_machine_downtimes" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machine_downtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_statuses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#9CA3AF',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_weekly_employee_shift_statuses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_weekly_employee_shift_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_machine_downtime_shifts" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machine_downtime_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_machine_staffing_requirements" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "min_employees" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machine_staffing_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_solver_constraints" (
    "id" TEXT NOT NULL,
    "category" "SolverConstraintCategory" NOT NULL,
    "group_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT,
    "impact" TEXT,
    "weight" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "editable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "luxlait_solver_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_profiles" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "luxlait_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_employee_machine_skills" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "level" "SkillLevel" NOT NULL DEFAULT 'AUTONOMOUS',

    CONSTRAINT "luxlait_employee_machine_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_daily_assignments" (
    "id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "employee_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "time_slot_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_daily_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_weekly_assignments" (
    "id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "machine_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "luxlait_weekly_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_weekly_employee_statuses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_weekly_employee_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_default_leaves" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_default_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "luxlait_default_machine_downtimes" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_default_machine_downtimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_settingKey_key" ON "system_settings"("settingKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_userId_key" ON "two_factor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "role_endpoint_mappings_roleId_endpoint_method_key" ON "role_endpoint_mappings"("roleId", "endpoint", "method");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "luxlait_weekly_machine_closed_shifts_year_iso_week_idx" ON "luxlait_weekly_machine_closed_shifts"("year", "iso_week");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_weekly_machine_closed_shifts_year_iso_week_machine__key" ON "luxlait_weekly_machine_closed_shifts"("year", "iso_week", "machine_id", "weekday", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_machine_open_shifts_machine_id_time_slot_id_key" ON "luxlait_machine_open_shifts"("machine_id", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_machine_downtimes_machine_id_day_date_key" ON "luxlait_machine_downtimes"("machine_id", "day_date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_weekly_employee_shift_statuses_day_date_employee_id_key" ON "luxlait_weekly_employee_shift_statuses"("day_date", "employee_id", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_machine_downtime_shifts_machine_id_day_date_time_sl_key" ON "luxlait_machine_downtime_shifts"("machine_id", "day_date", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_machine_staffing_requirements_machine_id_day_date_t_key" ON "luxlait_machine_staffing_requirements"("machine_id", "day_date", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_profiles_user_id_key" ON "luxlait_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_employee_machine_skills_employee_id_machine_id_key" ON "luxlait_employee_machine_skills"("employee_id", "machine_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_daily_assignments_day_date_employee_id_key" ON "luxlait_daily_assignments"("day_date", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_weekly_employee_statuses_day_date_employee_id_key" ON "luxlait_weekly_employee_statuses"("day_date", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_default_leaves_day_date_employee_id_key" ON "luxlait_default_leaves"("day_date", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "luxlait_default_machine_downtimes_day_date_machine_id_key" ON "luxlait_default_machine_downtimes"("day_date", "machine_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "role_endpoint_mappings" ADD CONSTRAINT "role_endpoint_mappings_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_machine_closed_shifts" ADD CONSTRAINT "luxlait_weekly_machine_closed_shifts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_machine_closed_shifts" ADD CONSTRAINT "luxlait_weekly_machine_closed_shifts_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_machine_open_shifts" ADD CONSTRAINT "luxlait_machine_open_shifts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_machine_open_shifts" ADD CONSTRAINT "luxlait_machine_open_shifts_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_machine_downtimes" ADD CONSTRAINT "luxlait_machine_downtimes_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_employee_shift_statuses" ADD CONSTRAINT "luxlait_weekly_employee_shift_statuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_employee_shift_statuses" ADD CONSTRAINT "luxlait_weekly_employee_shift_statuses_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "luxlait_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_employee_shift_statuses" ADD CONSTRAINT "luxlait_weekly_employee_shift_statuses_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_machine_downtime_shifts" ADD CONSTRAINT "luxlait_machine_downtime_shifts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_machine_downtime_shifts" ADD CONSTRAINT "luxlait_machine_downtime_shifts_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_machine_staffing_requirements" ADD CONSTRAINT "luxlait_machine_staffing_requirements_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_machine_staffing_requirements" ADD CONSTRAINT "luxlait_machine_staffing_requirements_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_profiles" ADD CONSTRAINT "luxlait_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_employee_machine_skills" ADD CONSTRAINT "luxlait_employee_machine_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_employee_machine_skills" ADD CONSTRAINT "luxlait_employee_machine_skills_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_daily_assignments" ADD CONSTRAINT "luxlait_daily_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_daily_assignments" ADD CONSTRAINT "luxlait_daily_assignments_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_daily_assignments" ADD CONSTRAINT "luxlait_daily_assignments_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_assignments" ADD CONSTRAINT "luxlait_weekly_assignments_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_assignments" ADD CONSTRAINT "luxlait_weekly_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_employee_statuses" ADD CONSTRAINT "luxlait_weekly_employee_statuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "luxlait_weekly_employee_statuses" ADD CONSTRAINT "luxlait_weekly_employee_statuses_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "luxlait_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;



-- Seed planner system settings (solver caps and legal defaults)
INSERT INTO "system_settings" ("id", "settingKey", "isEnabled", "providerConfig", "createdAt", "updatedAt")
VALUES
(
    gen_random_uuid(),
    'planning_solver_max_work_days_per_week',
    true,
    '{"value": 6}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    gen_random_uuid(),
    'planning_solver_min_rest_days_per_week',
    true,
    '{"value": 1}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    gen_random_uuid(),
    'planning_solver_max_consecutive_work_days',
    true,
    '{"value": 6}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("settingKey") DO NOTHING;

-- Seed solver constraint catalog (aligned with solver_service)
INSERT INTO "luxlait_solver_constraints" (
    "id", "category", "group_name", "title", "description", "metric", "impact",
    "weight", "active", "editable", "sort_order", "created_at", "updated_at"
) VALUES
(
    'lock_plan',
    'HARD',
    'Planning figé',
    'Jours verrouillés',
    'Les affectations déjà acceptées ou verrouillées sont réinjectées telles quelles. Elles occupent la capacité des machines et ne sont pas recalculées.',
    'existing_assignments',
    'Base fixe pour un replanage partiel.',
    NULL,
    true,
    false,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'qual_machine',
    'HARD',
    'Compétences',
    'Qualification par machine',
    'Une variable d''affectation n''existe que si le collaborateur possède une compétence sur la machine (autonome ou en formation).',
    'skills',
    'Impossible d''affecter hors référentiel compétences.',
    NULL,
    true,
    false,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'indispo_jour',
    'HARD',
    'Disponibilité',
    'Indisponibilités jour',
    'Les journées marquées indisponibles pour un employé dans les données d''entrée ne reçoivent aucune affectation travail.',
    'unavailable_days',
    'Aligné congés et absences jour dans l''API de résolution.',
    NULL,
    true,
    false,
    2,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'indispo_shift',
    'HARD',
    'Disponibilité',
    'Indisponibilités créneau',
    'Les couples jour et créneau interdits pour un employé excluent ce créneau pour ce jour.',
    'unavailable_shifts',
    'Permet de bloquer un shift précis sans bloquer toute la journée.',
    NULL,
    true,
    false,
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'shift_machine',
    'HARD',
    'Machines',
    'Créneaux ouverts et fermetures',
    'Si la machine a des créneaux ouverts, le shift choisi doit être compatible. Les fermetures machine par jour ou par créneau interdisent l''affectation sur ces créneaux.',
    'open_time_slots, fermetures',
    'Respect du calendrier machine renseigné en base.',
    NULL,
    true,
    false,
    4,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'cov_mandatory',
    'HARD',
    'Machines',
    'Couverture machine obligatoire',
    'Pour une machine en importance MANDATORY, chaque créneau ouvert non fermé doit avoir au moins un opérateur qualifié présent sur ce poste et ce créneau.',
    'importance MANDATORY',
    'Sinon le solveur déclare l''instance infaisable.',
    NULL,
    true,
    false,
    5,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'cap_max',
    'HARD',
    'Machines',
    'Plafond par créneau',
    'Sur chaque machine, jour et créneau ouvrable, le nombre de personnes simultanées ne dépasse pas max employés, diminué des personnes déjà verrouillées sur ce créneau.',
    'max_employees',
    'Évite la suroccupation d''un poste.',
    NULL,
    true,
    false,
    6,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'training_partner',
    'HARD',
    'Formation',
    'Formation jamais isolée',
    'Un opérateur en compétence IN_TRAINING sur une machine ne peut pas être seul sur ce machine, jour et créneau : au moins un collègue AUTONOMOUS doit être présent (figé ou choisi par le solveur).',
    'IN_TRAINING / AUTONOMOUS',
    'Garantit un tuteur effectif sur le créneau.',
    NULL,
    true,
    false,
    7,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'min_staff',
    'HARD',
    'Effectifs',
    'Effectif minimum par créneau',
    'Lorsqu''un minimum d''employés est défini pour une machine, un jour et un créneau, la somme des affectations atteint ce plancher si des candidats existent.',
    'machine_shift_min_requirements',
    'Sinon instance rejetée si le plancher est impossible.',
    NULL,
    true,
    false,
    8,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'night_morning',
    'HARD',
    'Repos',
    'Repos minimum entre services',
    'Les créneaux travaillés sont triés selon leur ordre de présentation (sort_order). Après un service donné, les deux créneaux suivants dans la séquence sont interdits pour le même employé. Pour des créneaux de huit heures cela garantit au moins seize heures de repos entre deux services consécutifs (par exemple Nuit puis Matin ou Aprèm puis Matin du lendemain).',
    'sort_order des time_slots',
    'Limite la fatigue liée aux enchaînements de services trop rapprochés.',
    NULL,
    true,
    false,
    9,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'enforce_slot',
    'HARD',
    'Modèle',
    'Créneau obligatoire si jour travaillé',
    'Si le paramètre enforce time slot when assigned est actif, une journée travaillée se voit attribuer exactement un créneau parmi les créneaux ouvrables.',
    'booléen',
    'Évite une machine sans shift choisi.',
    NULL,
    true,
    false,
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'obj_equity',
    'SOFT',
    'Objectif',
    'Équité charge',
    'Réduit l''écart entre le nombre minimal et maximal de jours travaillés par employé sur la fenêtre (pondération fairness weight).',
    'défaut 1',
    'Lisse la charge entre personnes éligibles.',
    1,
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'obj_priority',
    'SOFT',
    'Objectif',
    'Machines prioritaires',
    'Maximise la couverture des créneaux ouverts pour les machines en importance PRIORITY lorsque la couverture n''est pas une contrainte dure (pondération priority machine weight).',
    'défaut 50',
    'Favorise les postes marqués prioritaires.',
    50,
    true,
    true,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'obj_stability',
    'SOFT',
    'Objectif',
    'Stabilité plan de référence',
    'Lorsqu''un plan de référence est fourni et que le poids est strictement positif, favorise de conserver la même machine et le même créneau que la référence (pondération stability weight).',
    'défaut 0',
    'Utile au replanage incrémental.',
    0,
    true,
    true,
    2,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'obj_train_bonus',
    'SOFT',
    'Objectif',
    'Affecter les profils formation pure',
    'Bonus pour chaque jour où un employé qui n''a que des compétences en formation est affecté : il doit être placé pour pouvoir être binômé avec un autonome (pondération training bonus weight).',
    'défaut 10',
    'Évite de laisser ces profils sans mission.',
    10,
    true,
    true,
    3,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'obj_poly_a',
    'SOFT',
    'Objectif',
    'Polyvalents sur poste autonome',
    'Bonus lorsqu''un employé à la fois autonome et en formation sur des machines différentes est placé sur une machine où il est autonome ce jour là (pondération polyvalent in autonomous bonus weight).',
    'défaut 7',
    'Priorise le travail productif pour les polyvalents.',
    7,
    true,
    true,
    4,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'obj_poly_f',
    'SOFT',
    'Objectif',
    'Polyvalents sur poste formation',
    'Bonus plus faible lorsque ce même profil polyvalent est placé sur une machine en formation ce jour là (pondération polyvalent in training bonus weight).',
    'défaut 6',
    'Autorise la formation si aucun slot autonome n''est disponible.',
    6,
    true,
    true,
    5,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'obj_extra_pen',
    'SOFT',
    'Objectif',
    'Pénalité sur effectif au delà du minimum',
    'Pénalise chaque personne au delà du minimum requis sur un triplet machine, jour, créneau lorsqu''un minimum est défini (pondération extra coverage penalty weight).',
    'défaut 5',
    'Limite le sur effectif inutile sur un shift.',
    5,
    true,
    true,
    6,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'meta_solver',
    'PREF',
    'Moteur',
    'Temps et précision de résolution',
    'Le solveur CP SAT utilise un temps maximum de calcul et une tolérance d''optimisation relative (quality gap). Ce sont des réglages techniques, pas des règles métier pondérées.',
    'solve_time_limit_seconds, relative_gap_limit',
    'Équilibre qualité de solution et durée d''attente.',
    NULL,
    true,
    false,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'cap_days_per_week',
    'HARD',
    'Repos',
    'Plafond jours travaillés par semaine',
    'Sur chaque semaine ISO (du lundi au dimanche), un même employé ne peut pas être affecté plus de N jours, congés et jours verrouillés inclus. La valeur par défaut est six jours pour respecter le code du travail luxembourgeois (44h de repos hebdomadaire consécutif).',
    'planning_solver_max_work_days_per_week',
    'Évite les semaines de plus de six jours travaillés par personne.',
    NULL,
    true,
    false,
    11,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'rest_weekly_min',
    'HARD',
    'Repos',
    'Repos hebdomadaire minimum',
    'Sur chaque semaine ISO du planning, chaque employé doit disposer d''au moins N jours de repos. Code du travail luxembourgeois article L. 231 3 (repos hebdomadaire de 44 heures consécutives, dont au moins 24 heures ininterrompues). Les jours verrouillés comptent dans la fenêtre.',
    'planning_solver_min_rest_days_per_week',
    'Empêche une semaine entièrement travaillée par une même personne.',
    NULL,
    true,
    false,
    12,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'consec_max_days',
    'HARD',
    'Repos',
    'Plafond jours consécutifs',
    'Aucune fenêtre glissante de N+1 jours ne peut comporter plus de N jours travaillés pour un même employé. Garantit qu''au moins un jour de repos suit toute série de N jours travaillés. Code du travail luxembourgeois articles L. 211 et L. 231.',
    'planning_solver_max_consecutive_work_days',
    'Évite les très longues séries de jours travaillés consécutifs.',
    NULL,
    true,
    false,
    13,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- Refresh the night_morning catalog entry so its description always matches
-- the generalized rest rule shipped with the solver (16h gap = 2 slots after
-- every shift). Idempotent: running it multiple times converges to the same
-- state.
UPDATE "luxlait_solver_constraints"
SET
    "title" = 'Repos minimum entre services',
    "description" = 'Les créneaux travaillés sont triés selon leur ordre de présentation (sort_order). Après un service donné, les deux créneaux suivants dans la séquence sont interdits pour le même employé. Pour des créneaux de huit heures cela garantit au moins seize heures de repos entre deux services consécutifs (par exemple Nuit puis Matin ou Aprèm puis Matin du lendemain).',
    "metric" = 'sort_order des time_slots',
    "impact" = 'Limite la fatigue liée aux enchaînements de services trop rapprochés.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'night_morning';
