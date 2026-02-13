-- ===========================
-- STSphera — Enterprise Operating Model Seed
-- Adds: enterprise roles, extended permissions, notification templates/scenarios
-- ===========================

-- --- Additional departments for enterprise operating model ---
INSERT INTO departments (name) VALUES
  ('Руководство'),
  ('Договорной отдел'),
  ('Проектный отдел'),
  ('Снабжение')
ON CONFLICT (name) DO NOTHING;

-- --- Additional enterprise roles ---
INSERT INTO roles (system_name, display_name, description, access_level, receives_notifications) VALUES
  ('ceo', 'Генеральный директор', 'Портфель, бюджет, риски, эскалации 3-го уровня', 'Portfolio Read + Escalation', 'Критические блокеры, бюджетные и сроковые отклонения'),
  ('direction_director', 'Директор направления', 'Маржинальность направления, ресурсы и межобъектная координация', 'Cross-project Management', 'Эскалации 2-го уровня, ресурсные и поставочные риски'),
  ('contract_manager', 'Договорной отдел', 'Контракты, допсоглашения, этапы оплат', 'Contract Lifecycle', 'Подписание, изменения условий, просрочки согласования'),
  ('design_manager', 'Проектный отдел', 'Чертежи, версии, замечания, выдача в работу', 'Document Workflow', 'Замечания, просрочки ревью, изменение РД после выдачи'),
  ('procurement_manager', 'Снабжение', 'Закупки, поставки, дефициты, поставщики', 'Procurement + Supply', 'Срывы сроков, изменения цен, недопоставки'),
  ('pto_manager', 'ПТО', 'Исполнительная документация, акты, закрытие объемов', 'Acts + Closing', 'Акты, несоответствия, возвраты на доработку')
ON CONFLICT (system_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  access_level = EXCLUDED.access_level,
  receives_notifications = EXCLUDED.receives_notifications;

-- --- Additional RBAC permissions ---
INSERT INTO rbac_permissions (resource, action, description) VALUES
  ('portfolio', 'read', 'View portfolio summary'),
  ('risk', 'read', 'View risk register'),
  ('finance_summary', 'read', 'View finance summary'),
  ('contract', 'read', 'View contracts'),
  ('contract', 'create', 'Create contracts'),
  ('contract', 'update', 'Update contracts'),
  ('contract', 'approve', 'Approve contracts'),
  ('procurement', 'read', 'View procurement items'),
  ('procurement', 'create', 'Create procurement items'),
  ('procurement', 'update', 'Update procurement items'),
  ('procurement', 'approve', 'Approve procurement operations'),
  ('supply', 'read', 'View supply statuses'),
  ('supply', 'update', 'Update supply statuses and ETA'),
  ('supply', 'status_change', 'Change supply stage'),
  ('acts', 'read', 'View acts and closing docs'),
  ('acts', 'create', 'Create acts'),
  ('acts', 'update', 'Update acts'),
  ('acts', 'approve', 'Approve acts'),
  ('blocker', 'read', 'View blockers'),
  ('blocker', 'create', 'Create blockers'),
  ('blocker', 'update', 'Update blockers'),
  ('blocker', 'close', 'Close blockers'),
  ('blocker', 'escalate', 'Escalate blockers')
ON CONFLICT (resource, action) DO UPDATE SET
  description = EXCLUDED.description;

-- --- Role ↔ Permission mappings for enterprise roles ---
WITH role_perm_seed AS (
  SELECT 'ceo'::text AS role_name, ARRAY[
    'portfolio.read',
    'risk.read',
    'finance_summary.read',
    'project.read',
    'analytics.read',
    'audit_log.read',
    'blocker.read'
  ]::text[] AS permissions
  UNION ALL
  SELECT 'direction_director', ARRAY[
    'portfolio.read',
    'risk.read',
    'finance_summary.read',
    'project.read',
    'project.write',
    'task.read',
    'task.assign',
    'plan_fact.read',
    'module.read',
    'module.update',
    'procurement.read',
    'supply.read',
    'supply.update',
    'analytics.read',
    'analytics.export',
    'blocker.read',
    'blocker.update',
    'blocker.escalate',
    'audit_log.read'
  ]
  UNION ALL
  SELECT 'contract_manager', ARRAY[
    'project.read',
    'contract.read',
    'contract.create',
    'contract.update',
    'contract.approve',
    'acts.read',
    'acts.approve',
    'finance_summary.read',
    'audit_log.read'
  ]
  UNION ALL
  SELECT 'design_manager', ARRAY[
    'project.read',
    'gpr.read',
    'gpr.create',
    'gpr.update',
    'document.read',
    'document.upload',
    'document.approve',
    'task.read',
    'task.create',
    'task.update',
    'blocker.read',
    'blocker.create',
    'audit_log.read'
  ]
  UNION ALL
  SELECT 'procurement_manager', ARRAY[
    'project.read',
    'procurement.read',
    'procurement.create',
    'procurement.update',
    'procurement.approve',
    'supply.read',
    'supply.update',
    'supply.status_change',
    'module.read',
    'analytics.read',
    'risk.read',
    'blocker.read',
    'blocker.create',
    'blocker.escalate',
    'audit_log.read'
  ]
  UNION ALL
  SELECT 'pto_manager', ARRAY[
    'project.read',
    'plan_fact.read',
    'acts.read',
    'acts.create',
    'acts.update',
    'acts.approve',
    'document.read',
    'document.upload',
    'task.read',
    'analytics.read',
    'blocker.read',
    'blocker.create',
    'blocker.update',
    'audit_log.read'
  ]
),
expanded AS (
  SELECT role_name, unnest(permissions) AS permission_key
  FROM role_perm_seed
),
resolved AS (
  SELECT
    r.id AS role_id,
    p.id AS permission_id
  FROM expanded e
  JOIN roles r ON r.system_name = e.role_name
  JOIN rbac_permissions p ON (p.resource || '.' || p.action) = e.permission_key
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT role_id, permission_id
FROM resolved
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- --- Additional notification settings ---
INSERT INTO notification_settings (parameter, value, description, applies_to, is_configurable, example) VALUES
  ('module_accept_timeout_min', '240', 'Минут на принятие статуса модуля', 'NS-09', true, '240'),
  ('defect_critical_timeout_min', '1440', 'Минут на реакцию по критическому дефекту', 'NS-12', true, '1440'),
  ('doc_review_timeout_min', '2880', 'Минут на ревью документа', 'NS-14', true, '2880'),
  ('retry_count', '3', 'Число повторов отправки', 'ALL', false, '3'),
  ('retry_backoff_seconds', '30,60,120', 'Backoff для повторов', 'ALL', false, '30,60,120'),
  ('quiet_hours_start', '23:00', 'Начало тихих часов', 'ALL', true, '23:00'),
  ('quiet_hours_end', '07:00', 'Окончание тихих часов', 'ALL', true, '07:00')
ON CONFLICT (parameter) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  applies_to = EXCLUDED.applies_to,
  is_configurable = EXCLUDED.is_configurable,
  example = EXCLUDED.example;

-- --- Message templates (12 templates) ---
WITH message_template_seed AS (
  SELECT * FROM (
    VALUES
      ('TASK_ASSIGNED', 'Вам назначена задача:\n📋 {task_name}\n📍 Фасад: {facade}\n📅 Срок: {deadline}\n⚡ Приоритет: {priority}', '["task_name","facade","deadline","priority"]'::jsonb, 'Вам назначена задача: Монтаж Ф1'),
      ('TASK_OVERDUE', '⚠️ Задача просрочена на {days} дн.:\n📋 {task_name}\n👤 Ответственный: {assignee_name}\n📅 Дедлайн: {deadline}', '["days","task_name","assignee_name","deadline"]'::jsonb, '⚠️ Задача просрочена на 2 дня'),
      ('TASK_OVERDUE_ESCALATION', '🚨 ЭСКАЛАЦИЯ ({level}): Задача просрочена на {days} дн.:\n📋 {task_name}\n👤 {assignee_name}\n📍 Участок: {site}', '["level","days","task_name","assignee_name","site"]'::jsonb, '🚨 ЭСКАЛАЦИЯ (L2)'),
      ('FACT_REMINDER', '📝 Факт за {date} не введен:\n📋 {task_name}\nВнесите данные до конца дня.', '["date","task_name"]'::jsonb, '📝 Факт за 2026-02-12 не введен'),
      ('FACT_ESCALATION', '🚨 ЭСКАЛАЦИЯ: {foreman_name} не внес факт за {date}.\n📋 Задачи: {task_list}', '["foreman_name","date","task_list"]'::jsonb, '🚨 ЭСКАЛАЦИЯ: прораб не внес факт'),
      ('PLAN_MORNING', '☀️ Доброе утро! Задачи на сегодня:\n{task_list}\n📊 Общий план: {plan_total} {unit}', '["task_list","plan_total","unit"]'::jsonb, '☀️ Доброе утро!'),
      ('DAILY_SUMMARY', '📊 Сводка за {date}:\n✅ Прогресс: {pct}%\n📋 Выполнено: {done}/{total}\n⏰ Просрочено: {overdue}\n⚠️ Отклонения: {deviations}', '["date","pct","done","total","overdue","deviations"]'::jsonb, '📊 Сводка за день'),
      ('MODULE_STATUS_CHANGED', '🔄 Модуль {code} ({type}):\n{old_status} → {new_status}\n📍 Фасад: {facade}', '["code","type","old_status","new_status","facade"]'::jsonb, '🔄 Модуль MOD-001: PRODUCED → SHIPPED'),
      ('DEFECT_REPORTED', '🔴 Дефект в {facade}/{zone}:\n{description}\n⚡ Критичность: {priority}\n👤 Автор: {reporter_name}', '["facade","zone","description","priority","reporter_name"]'::jsonb, '🔴 Дефект в Ф1/ось А-Б'),
      ('IMPORT_COMPLETED', '📥 Импорт завершен: {file_name}\n✅ Записей: {imported}/{total}\n❌ Ошибок: {errors}\n⚠️ Предупреждений: {warnings}', '["file_name","imported","total","errors","warnings"]'::jsonb, '📥 Импорт завершен'),
      ('USER_REGISTERED', '👤 Новый пользователь: {name} (@{username})\n🆔 TG ID: {tg_id}\nТребуется назначение роли.', '["name","username","tg_id"]'::jsonb, '👤 Новый пользователь зарегистрирован'),
      ('TASK_COMPLETED', '✅ Задача завершена:\n📋 {task_name}\n👤 {assignee_name}\n📊 Факт: {actual}/{planned} ({pct}%)', '["task_name","assignee_name","actual","planned","pct"]'::jsonb, '✅ Задача завершена')
  ) AS t(message_type, template_text, variables, example_filled)
)
INSERT INTO message_templates (message_type, template_text, variables, example_filled)
SELECT message_type, template_text, variables, example_filled
FROM message_template_seed
ON CONFLICT (message_type) DO UPDATE SET
  template_text = EXCLUDED.template_text,
  variables = EXCLUDED.variables,
  example_filled = EXCLUDED.example_filled;

-- --- Notification scenarios (18 scenarios) ---
WITH scenario_seed AS (
  SELECT * FROM (
    VALUES
      ('NS-01', 'Назначение задачи исполнителю', 'DATA_CHANGE', 'Push (Bot)', '{"roles":["foreman","brigadier"]}'::jsonb, 'TASK_ASSIGNED', '{"buttons":["accept:task:{id}","detail:task:{id}"]}'::jsonb, '{"escalateToRole":"site_manager","reason":"no_accept"}'::jsonb, 120, true),
      ('NS-02', 'Просрочка задачи L1', 'SCHEDULE', 'Push (Bot)', '{"roles":["foreman","brigadier"]}'::jsonb, 'TASK_OVERDUE', '{"buttons":["update:task:{id}","reschedule:task:{id}"]}'::jsonb, '{"escalateToRole":"site_manager","level":"L1"}'::jsonb, 1440, true),
      ('NS-03', 'Просрочка задачи L2', 'SCHEDULE', 'Push (Bot)', '{"roles":["site_manager"]}'::jsonb, 'TASK_OVERDUE_ESCALATION', '{"buttons":["escalate_ack:task:{id}","detail:task:{id}"]}'::jsonb, '{"escalateToRole":"direction_director","level":"L2"}'::jsonb, 2880, true),
      ('NS-04', 'Просрочка задачи L3', 'SCHEDULE', 'Push (Bot)', '{"roles":["ceo","project_director"]}'::jsonb, 'TASK_OVERDUE_ESCALATION', '{"buttons":["detail:task:{id}"]}'::jsonb, '{"final":true,"level":"L3"}'::jsonb, 10080, true),
      ('NS-05', 'Напоминание о вводе факта', 'SCHEDULE', 'Push (Bot)', '{"roles":["foreman","brigadier"]}'::jsonb, 'FACT_REMINDER', '{"buttons":["enter_fact:task:{id}"]}'::jsonb, '{"escalateToRole":"site_manager"}'::jsonb, 120, true),
      ('NS-06', 'Эскалация отсутствия факта', 'SCHEDULE', 'Push (Bot)', '{"roles":["site_manager","project_director"]}'::jsonb, 'FACT_ESCALATION', '{"buttons":["contact:user:{id}","detail:task:{id}"]}'::jsonb, NULL::jsonb, 120, true),
      ('NS-07', 'Утренний план', 'SCHEDULE', 'Push (Bot)', '{"roles":["foreman","brigadier"]}'::jsonb, 'PLAN_MORNING', '{"buttons":["plan_fact:date:{date}"]}'::jsonb, NULL::jsonb, NULL::int, true),
      ('NS-08', 'Ежедневная сводка', 'SCHEDULE', 'Push (Bot)', '{"roles":["project_director","direction_director","ceo","site_manager"]}'::jsonb, 'DAILY_SUMMARY', '{"buttons":["dashboard:project:{id}"]}'::jsonb, NULL::jsonb, NULL::int, true),
      ('NS-09', 'Смена статуса модуля', 'DATA_CHANGE', 'Push (Bot)', '{"roles":["production_manager","logistics_manager","foreman"]}'::jsonb, 'MODULE_STATUS_CHANGED', '{"buttons":["detail:module:{id}","accept:module:{id}"]}'::jsonb, '{"escalateToRole":"site_manager"}'::jsonb, 240, true),
      ('NS-10', 'Просрочка по модулю', 'SCHEDULE', 'Push (Bot)', '{"roles":["logistics_manager","procurement_manager"]}'::jsonb, 'MODULE_STATUS_CHANGED', '{"buttons":["update:module:{id}","detail:module:{id}"]}'::jsonb, '{"escalateToRole":"direction_director"}'::jsonb, 1440, true),
      ('NS-11', 'Критическое отклонение план-факт', 'DATA_CHANGE', 'Push (Bot)', '{"roles":["site_manager","project_director"]}'::jsonb, 'DAILY_SUMMARY', '{"buttons":["detail:task:{id}","blocker_raise:task:{id}"]}'::jsonb, '{"createBlocker":true}'::jsonb, 60, true),
      ('NS-12', 'Дефект зафиксирован', 'UI_ACTION', 'Push (Bot)', '{"roles":["foreman","site_manager","qc_inspector"]}'::jsonb, 'DEFECT_REPORTED', '{"buttons":["accept:defect:{id}","delegate:task:{id}"]}'::jsonb, '{"escalateToRole":"project_director","criticalOnly":true}'::jsonb, 1440, true),
      ('NS-13', 'Дефект исправлен', 'DATA_CHANGE', 'Push (Bot)', '{"roles":["qc_inspector"]}'::jsonb, 'TASK_COMPLETED', '{"buttons":["verify:task:{id}","detail:task:{id}"]}'::jsonb, '{"escalateToRole":"site_manager"}'::jsonb, 1440, true),
      ('NS-14', 'Документ на согласовании', 'UI_ACTION', 'Push (Bot)', '{"roles":["engineer","design_manager","project_director"]}'::jsonb, 'TASK_ASSIGNED', '{"buttons":["open:doc:{id}","approve:doc:{id}","reject:doc:{id}"]}'::jsonb, '{"escalateToRole":"project_director"}'::jsonb, 2880, true),
      ('NS-15', 'Импорт завершен', 'IMPORT', 'Push (Bot)', '{"roles":["admin","engineer"]}'::jsonb, 'IMPORT_COMPLETED', '{"buttons":["import_log:{id}"]}'::jsonb, NULL::jsonb, NULL::int, true),
      ('NS-16', 'Новый пользователь зарегистрирован', 'UI_ACTION', 'Push (Bot)', '{"roles":["admin"]}'::jsonb, 'USER_REGISTERED', '{"buttons":["assign_role:user:{id}"]}'::jsonb, NULL::jsonb, NULL::int, true),
      ('NS-17', 'Задача завершена', 'DATA_CHANGE', 'Push (Bot)', '{"roles":["site_manager","project_director"]}'::jsonb, 'TASK_COMPLETED', '{"buttons":["accept:task:{id}","rework:task:{id}"]}'::jsonb, '{"escalateToRole":"site_manager"}'::jsonb, 1440, true),
      ('NS-18', 'ГПР утвержден', 'UI_ACTION', 'Push (Bot)', '{"roles":["site_manager","foreman","engineer"]}'::jsonb, 'TASK_ASSIGNED', '{"buttons":["gpr:project:{id}"]}'::jsonb, NULL::jsonb, NULL::int, true)
  ) AS t(code, task_name, trigger_type, notification_type, recipients_config, message_type, buttons_config, escalation_config, escalation_time_minutes, is_active)
)
INSERT INTO notification_scenarios (
  code,
  task_name,
  trigger_type,
  notification_type,
  recipients_config,
  message_template_id,
  buttons_config,
  escalation_config,
  escalation_time_minutes,
  is_active
)
SELECT
  s.code,
  s.task_name,
  s.trigger_type,
  s.notification_type,
  s.recipients_config,
  mt.id AS message_template_id,
  s.buttons_config,
  s.escalation_config,
  s.escalation_time_minutes,
  s.is_active
FROM scenario_seed s
LEFT JOIN message_templates mt ON mt.message_type = s.message_type
ON CONFLICT (code) DO UPDATE SET
  task_name = EXCLUDED.task_name,
  trigger_type = EXCLUDED.trigger_type,
  notification_type = EXCLUDED.notification_type,
  recipients_config = EXCLUDED.recipients_config,
  message_template_id = EXCLUDED.message_template_id,
  buttons_config = EXCLUDED.buttons_config,
  escalation_config = EXCLUDED.escalation_config,
  escalation_time_minutes = EXCLUDED.escalation_time_minutes,
  is_active = EXCLUDED.is_active;
