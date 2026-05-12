-- CreateTable
CREATE TABLE "luxlait_default_machine_downtimes" (
  "id" UUID NOT NULL,
  "machine_id" UUID NOT NULL,
  "day_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "luxlait_default_machine_downtimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_default_machine_downtimes_day_date_machine_id_key"
  ON "luxlait_default_machine_downtimes"("day_date", "machine_id");
