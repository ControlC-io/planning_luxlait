-- CreateTable
CREATE TABLE "luxlait_weekly_machine_closed_shifts" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "iso_week" INTEGER NOT NULL,
    "machine_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "luxlait_weekly_machine_closed_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_weekly_machine_closed_shifts_year_iso_week_machine_id_weekday_time_slot_id_key" ON "luxlait_weekly_machine_closed_shifts"("year", "iso_week", "machine_id", "weekday", "time_slot_id");

-- CreateIndex
CREATE INDEX "luxlait_weekly_machine_closed_shifts_year_iso_week_idx" ON "luxlait_weekly_machine_closed_shifts"("year", "iso_week");

-- AddForeignKey
ALTER TABLE "luxlait_weekly_machine_closed_shifts" ADD CONSTRAINT "luxlait_weekly_machine_closed_shifts_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "luxlait_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "luxlait_weekly_machine_closed_shifts" ADD CONSTRAINT "luxlait_weekly_machine_closed_shifts_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "luxlait_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
