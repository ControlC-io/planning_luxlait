-- Refresh the night_morning solver constraint catalog entry to reflect the
-- generalized rest rule. The solver no longer matches shifts by their name
-- (nuit, matin) but uses sort_order to forbid the next two slots after any
-- worked shift, which guarantees a 16h rest with 8h slots.
-- Idempotent by design (single UPDATE on a fixed primary key).
UPDATE "luxlait_solver_constraints"
SET
    "title" = 'Repos minimum entre services',
    "description" = 'Les créneaux travaillés sont triés selon leur ordre de présentation (sort_order). Après un service donné, les deux créneaux suivants dans la séquence sont interdits pour le même employé. Pour des créneaux de huit heures cela garantit au moins seize heures de repos entre deux services consécutifs (par exemple Nuit puis Matin ou Aprèm puis Matin du lendemain).',
    "metric" = 'sort_order des time_slots',
    "impact" = 'Limite la fatigue liée aux enchaînements de services trop rapprochés.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'night_morning';
