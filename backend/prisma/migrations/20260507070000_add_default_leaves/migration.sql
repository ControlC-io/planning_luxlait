-- CreateTable
CREATE TABLE "luxlait_default_leaves" (
  "id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "status_id" UUID NOT NULL,
  "day_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "luxlait_default_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "luxlait_default_leaves_day_date_employee_id_key"
  ON "luxlait_default_leaves"("day_date", "employee_id");
