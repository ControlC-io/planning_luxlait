-- Migration: convert monthly worked plus leaves target from HARD to SOFT objective.
--
-- The constraint planning_solver_exact_monthly_worked_plus_leaves_days still
-- defines the target day count (default 21). A new weight setting drives the
-- soft penalty applied when an employee deviates from that target.
--
-- The catalog entry is updated to reflect the SOFT nature of the rule.

-- Ensure the target setting is present and set to 21 (the soft objective target).
-- A previous migration may have inserted it with value 0 (disabled). We force
-- the correct value here so the soft objective is active by default.
INSERT INTO "system_settings" ("id", "settingKey", "isEnabled", "providerConfig", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'planning_solver_exact_monthly_worked_plus_leaves_days',
    true,
    '{"value": 21}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("settingKey") DO UPDATE SET
    "providerConfig" = '{"value": 21}'::jsonb,
    "updatedAt"      = CURRENT_TIMESTAMP;

-- New setting: weight of the soft monthly deviation penalty.
INSERT INTO "system_settings" ("id", "settingKey", "isEnabled", "providerConfig", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'planning_solver_monthly_soft_target_weight',
    true,
    '{"value": 50}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("settingKey") DO NOTHING;

-- Update the catalog entry: change category from HARD to SOFT and reword description.
INSERT INTO "luxlait_solver_constraints" (
    "id", "category", "group_name", "title", "description", "metric", "impact",
    "weight", "active", "editable", "sort_order", "created_at", "updated_at"
) VALUES (
    'monthly_exact_worked_plus_leaves',
    'SOFT',
    'Équité',
    'Objectif mensuel jours travaillés plus congés',
    'Sur chaque mois civil, le solver cherche à atteindre exactement N jours travaillés plus congés pour chaque employé actif non backup. Un écart au dessus ou en dessous du seuil est pénalisé proportionnellement au poids défini. Les jours verrouillés sont inclus dans les jours travaillés.',
    'planning_solver_exact_monthly_worked_plus_leaves_days',
    'Guide le solver vers un quota mensuel de N jours par employé sans bloquer la faisabilité.',
    50,
    true,
    true,
    15,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
    "category"     = EXCLUDED."category",
    "title"        = EXCLUDED."title",
    "description"  = EXCLUDED."description",
    "impact"       = EXCLUDED."impact",
    "weight"       = EXCLUDED."weight",
    "updated_at"   = CURRENT_TIMESTAMP;
