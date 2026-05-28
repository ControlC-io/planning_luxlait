UPDATE "system_settings"
SET
    "providerConfig" = '{"value": 5}'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "settingKey" = 'planning_solver_max_work_days_per_week';

UPDATE "system_settings"
SET
    "providerConfig" = '{"value": 2}'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "settingKey" = 'planning_solver_min_rest_days_per_week';

UPDATE "system_settings"
SET
    "providerConfig" = '{"value": 5}'::jsonb,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "settingKey" = 'planning_solver_max_consecutive_work_days';

INSERT INTO "system_settings" ("id", "settingKey", "isEnabled", "providerConfig", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'planning_solver_leave_weekend_protection_weight',
    true,
    '{"value": 20}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("settingKey") DO NOTHING;

INSERT INTO "system_settings" ("id", "settingKey", "isEnabled", "providerConfig", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'planning_solver_exact_monthly_worked_plus_leaves_days',
    true,
    '{"value": 21}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("settingKey") DO NOTHING;

UPDATE "luxlait_solver_constraints"
SET
    "description" = 'Sur chaque semaine ISO (du lundi au dimanche), un même employé ne peut pas être affecté plus de N jours, congés et jours verrouillés inclus. La valeur par défaut est cinq jours, soit quarante heures avec des créneaux de huit heures.',
    "impact" = 'Évite les semaines de plus de cinq jours travaillés par personne.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'cap_days_per_week';

UPDATE "luxlait_solver_constraints"
SET
    "description" = 'Sur chaque semaine ISO du planning, chaque employé doit disposer d''au moins N jours de repos. La valeur par défaut est deux jours, cohérente avec un maximum de cinq jours travaillés par semaine.',
    "impact" = 'Empêche de descendre sous deux jours de repos sur une semaine complète.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'rest_weekly_min';

UPDATE "luxlait_solver_constraints"
SET
    "description" = 'Aucune fenêtre glissante de N+1 jours ne peut comporter plus de N jours travaillés pour un même employé. La valeur par défaut est cinq, pour limiter les séries de travail.',
    "impact" = 'Évite les séries de plus de cinq jours travaillés consécutifs.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'consec_max_days';

INSERT INTO "luxlait_solver_constraints" (
    "id", "category", "group_name", "title", "description", "metric", "impact",
    "weight", "active", "editable", "sort_order", "created_at", "updated_at"
) VALUES (
    'leave_weekend_protection',
    'SOFT',
    'Congés',
    'Protection weekends autour des congés',
    'Si un employé est en congé le lundi, le weekend précédent est préféré non planifié. Si un employé est en congé le vendredi, le weekend suivant est préféré non planifié. Cette règle est une préférence soft.',
    'planning_solver_leave_weekend_protection_weight',
    'Réduit les weekends travaillés adjacents à un congé lundi ou vendredi.',
    20,
    true,
    true,
    14,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "luxlait_solver_constraints"
SET
    "description" = 'Si un employé est en congé le lundi, le weekend précédent est préféré non planifié. Si un employé est en congé le vendredi, le weekend suivant est préféré non planifié. Cette règle est une préférence soft.',
    "impact" = 'Réduit les weekends travaillés adjacents à un congé lundi ou vendredi.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'leave_weekend_protection';

INSERT INTO "luxlait_solver_constraints" (
    "id", "category", "group_name", "title", "description", "metric", "impact",
    "weight", "active", "editable", "sort_order", "created_at", "updated_at"
) VALUES (
    'monthly_exact_worked_plus_leaves',
    'HARD',
    'Équité',
    'Exact mensuel jours travaillés plus congés',
    'Sur chaque mois civil, chaque employé actif non backup doit totaliser un nombre de jours travaillés plus congés inférieure ou égale à N. Les jours verrouillés sont inclus dans les jours travaillés.',
    'planning_solver_exact_monthly_worked_plus_leaves_days',
    'Garantit un plafond mensuel pour les employés actifs non backup en combinant travail et congés.',
    0,
    true,
    true,
    15,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "luxlait_solver_constraints"
SET
    "description" = 'Sur chaque mois civil, chaque employé actif non backup doit totaliser un nombre de jours travaillés plus congés inférieure ou égale à N. Les jours verrouillés sont inclus dans les jours travaillés.',
    "impact" = 'Garantit un plafond mensuel pour les employés actifs non backup en combinant travail et congés.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'monthly_exact_worked_plus_leaves';
