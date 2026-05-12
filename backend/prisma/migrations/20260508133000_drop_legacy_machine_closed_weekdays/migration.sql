-- Drop legacy non dated weekly machine closure tables.
-- These were superseded by luxlait_weekly_machine_closed_shifts (year + iso_week scoped).
-- The solver and the admin Fermetures page no longer read from them.

DROP TABLE IF EXISTS "luxlait_machine_closed_weekday_shifts";
DROP TABLE IF EXISTS "luxlait_machine_closed_weekdays";
