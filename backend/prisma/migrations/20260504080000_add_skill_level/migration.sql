-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('AUTONOMOUS', 'IN_TRAINING');

-- AlterTable
ALTER TABLE "luxlait_employee_machine_skills"
  ADD COLUMN "level" "SkillLevel" NOT NULL DEFAULT 'AUTONOMOUS';
