-- Seed Luxembourg Code du travail constraints inside the solver:
--   * minimum rest days per ISO week (article L. 231 3, repos hebdomadaire)
--   * maximum number of consecutive work days
--
-- Both are exposed as system_settings so an administrator can adjust the
-- value, and documented inside luxlait_solver_constraints so the read only
-- catalog page lists them with the other rules.

INSERT INTO "system_settings" ("id", "settingKey", "isEnabled", "providerConfig", "createdAt", "updatedAt")
VALUES
(
    gen_random_uuid(),
    'planning_solver_min_rest_days_per_week',
    true,
    '{"value": 1}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    gen_random_uuid(),
    'planning_solver_max_consecutive_work_days',
    true,
    '{"value": 6}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("settingKey") DO NOTHING;

INSERT INTO "luxlait_solver_constraints" (
    "id", "category", "group_name", "title", "description", "metric", "impact",
    "weight", "active", "editable", "sort_order", "created_at", "updated_at"
) VALUES
(
    'rest_weekly_min',
    'HARD',
    'Repos',
    'Repos hebdomadaire minimum',
    'Sur chaque semaine ISO du planning, chaque employé doit disposer d''au moins N jours de repos. Code du travail luxembourgeois article L. 231 3 (repos hebdomadaire de 44 heures consécutives, dont au moins 24 heures ininterrompues). Les jours verrouillés comptent dans la fenêtre.',
    'planning_solver_min_rest_days_per_week',
    'Empêche une semaine entièrement travaillée par une même personne.',
    NULL,
    true,
    false,
    12,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'consec_max_days',
    'HARD',
    'Repos',
    'Plafond jours consécutifs',
    'Aucune fenêtre glissante de N+1 jours ne peut comporter plus de N jours travaillés pour un même employé. Garantit qu''au moins un jour de repos suit toute série de N jours travaillés. Code du travail luxembourgeois articles L. 211 et L. 231.',
    'planning_solver_max_consecutive_work_days',
    'Évite les très longues séries de jours travaillés consécutifs.',
    NULL,
    true,
    false,
    13,
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
