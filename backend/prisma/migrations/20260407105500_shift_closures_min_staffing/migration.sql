-- CreateTable
CREATE TABLE "luxlait_weekly_employee_shift_statuses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_weekly_employee_shift_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_machine_downtime_shifts" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machine_downtime_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_machine_closed_weekday_shifts" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machine_closed_weekday_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luxlait_machine_staffing_requirements" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "min_employees" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_machine_staffing_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_weekly_employee_shift_statuses_day_date_employee_id_time_slot_id_key" ON "luxlait_weekly_employee_shift_statuses"("day_date", "employee_id", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_machine_downtime_shifts_machine_id_day_date_time_slot_id_key" ON "luxlait_machine_downtime_shifts"("machine_id", "day_date", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_machine_closed_weekday_shifts_machine_id_weekday_time_slot_id_key" ON "luxlait_machine_closed_weekday_shifts"("machine_id", "weekday", "time_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_machine_staffing_requirements_machine_id_day_date_time_slot_id_key" ON "luxlait_machine_staffing_requirements"("machine_id", "day_date", "time_slot_id");

-- AddForeignKey
ALTER TABLE "luxlait_weekly_employee_shift_statuses" ADD CONSTRAINT "luxlait_weekly_employee_shift_statuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "luxlait_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_employee_shift_statuses" ADD CONSTRAINT "luxlait_weekly_employee_shift_statuses_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "luxlait_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_employee_shift_statuses" ADD CONSTRAINT "luxlait_weekly_employee_shift_statuses_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_downtime_shifts" ADD CONSTRAINT "luxlait_machine_downtime_shifts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_downtime_shifts" ADD CONSTRAINT "luxlait_machine_downtime_shifts_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_closed_weekday_shifts" ADD CONSTRAINT "luxlait_machine_closed_weekday_shifts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_closed_weekday_shifts" ADD CONSTRAINT "luxlait_machine_closed_weekday_shifts_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_staffing_requirements" ADD CONSTRAINT "luxlait_machine_staffing_requirements_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_machine_staffing_requirements" ADD CONSTRAINT "luxlait_machine_staffing_requirements_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

