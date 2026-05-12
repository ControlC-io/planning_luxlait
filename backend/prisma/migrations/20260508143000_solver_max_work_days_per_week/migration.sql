-- Add the planning_solver_max_work_days_per_week system setting (default 6)
-- and document the matching catalog row in luxlait_solver_constraints.
--
-- Hard limit: each employee can be scheduled for at most N working days
-- inside a single ISO calendar week (Monday to Sunday). Locked assignments
-- count toward the cap. Set the value to 0 to disable.
--
-- Default 6 matches the Luxembourg labor code: max 6 working days per week
-- (article L. 231-3 mandates 44h consecutive weekly rest, equivalent to one
-- full day off per week).

INSERT INTO "system_settings" ("id", "settingKey", "isEnabled", "providerConfig", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'planning_solver_max_work_days_per_week',
    true,
    '{"value": 6}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("settingKey") DO NOTHING;

INSERT INTO "luxlait_solver_constraints" (
    "id", "category", "group_name", "title", "description", "metric", "impact",
    "weight", "active", "editable", "sort_order", "created_at", "updated_at"
) VALUES (
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
)
ON CONFLICT ("id") DO UPDATE SET
    "category" = EXCLUDED."category",
    "group_name" = EXCLUDED."group_name",
    "title" = EXCLUDED."title",
    "description" = EXCLUDED."description",
    "metric" = EXCLUDED."metric",
    "impact" = EXCLUDED."impact",
    "active" = EXCLUDED."active",
    "editable" = EXCLUDED."editable",
    "sort_order" = EXCLUDED."sort_order",
    "updated_at" = CURRENT_TIMESTAMP;
