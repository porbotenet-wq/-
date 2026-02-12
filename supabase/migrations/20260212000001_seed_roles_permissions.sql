-- ===========================
-- STSphera — Seed: Departments, Roles, Permissions, Role-Permission Matrix, Notification Settings
-- ===========================

-- --- Departments ---
INSERT INTO departments (name) VALUES
  ('Управление проектом'),
  ('Производство'),
  ('Контроль качества'),
  ('Логистика'),
  ('Производство модулей'),
  ('ПТО'),
  ('IT')
ON CONFLICT (name) DO NOTHING;

-- --- Roles (10 roles from section 4.1) ---
INSERT INTO roles (system_name, display_name, description, access_level, receives_notifications) VALUES
  ('project_director', 'Руководитель проекта', 'Весь проект, стратегические решения, эскалации', 'Full', 'Эскалации, сводки, критические отклонения'),
  ('site_manager', 'Начальник участка', 'Участок / набор фасадов, контроль прорабов', 'Write + Approve', 'Эскалации от прорабов, ежедневные сводки, просрочки'),
  ('foreman', 'Прораб', 'Фасад / зона, управление бригадами, ежедневный план-факт', 'Write', 'Задачи, план-факт, дефекты, напоминания'),
  ('brigadier', 'Бригадир', 'Бригада, ввод факта, фото-фиксация', 'Write (limited)', 'Назначенные задачи, напоминания'),
  ('qc_inspector', 'Инспектор ОТК', 'Приёмка работ, проверка модулей, дефекты', 'Write + Verify', 'Задачи на проверку, дефекты'),
  ('logistics_manager', 'Менеджер логистики', 'Отгрузка / доставка модулей', 'Write (modules)', 'Статусы модулей, отгрузки'),
  ('production_manager', 'Менеджер производства', 'Производство модулей, план производства', 'Write (modules)', 'План производства, отклонения'),
  ('engineer', 'Инженер ПТО', 'Документация, ГПР, объёмы', 'Write + Docs', 'Документы на согласование, изменения ГПР'),
  ('admin', 'Администратор системы', 'Настройки, пользователи, импорт, RBAC', 'Full', 'Системные ошибки, импорт'),
  ('viewer', 'Наблюдатель', 'Только просмотр дашбордов и сводок', 'Read-only', 'Сводки (по подписке)')
ON CONFLICT (system_name) DO NOTHING;

-- --- RBAC Permissions (40 permissions) ---
INSERT INTO rbac_permissions (resource, action, description) VALUES
  ('project', 'read', 'View project'),
  ('project', 'write', 'Create/update project'),
  ('project', 'manage', 'Manage project settings'),
  ('task', 'read', 'View tasks'),
  ('task', 'create', 'Create tasks'),
  ('task', 'update', 'Update tasks'),
  ('task', 'assign', 'Assign tasks'),
  ('task', 'verify', 'Verify/accept tasks'),
  ('task', 'delete', 'Delete tasks'),
  ('plan_fact', 'read', 'View plan-fact'),
  ('plan_fact', 'create', 'Create plan-fact entries'),
  ('plan_fact', 'update', 'Update plan-fact'),
  ('plan_fact', 'approve', 'Approve plan-fact'),
  ('module', 'read', 'View modules'),
  ('module', 'create', 'Create modules'),
  ('module', 'update', 'Update modules'),
  ('module', 'status_change', 'Change module status'),
  ('gpr', 'read', 'View GPR'),
  ('gpr', 'create', 'Create GPR'),
  ('gpr', 'update', 'Update GPR'),
  ('gpr', 'approve', 'Approve GPR'),
  ('defect', 'read', 'View defects'),
  ('defect', 'report', 'Report defect'),
  ('defect', 'assign', 'Assign defect'),
  ('defect', 'verify', 'Verify defect fix'),
  ('document', 'read', 'View documents'),
  ('document', 'upload', 'Upload documents'),
  ('document', 'approve', 'Approve documents'),
  ('analytics', 'read', 'View analytics'),
  ('analytics', 'export', 'Export analytics'),
  ('notification_settings', 'read', 'View notification settings'),
  ('notification_settings', 'update', 'Update notification settings'),
  ('user_management', 'read', 'View users'),
  ('user_management', 'create', 'Create users'),
  ('user_management', 'update', 'Update users'),
  ('user_management', 'delete', 'Delete users'),
  ('user_management', 'assign_role', 'Assign roles'),
  ('import', 'upload', 'Upload import files'),
  ('import', 'execute', 'Execute import'),
  ('import', 'view_log', 'View import logs'),
  ('audit_log', 'read', 'View audit logs')
ON CONFLICT (resource, action) DO NOTHING;

-- --- Role ↔ Permission matrix (section 4.3) ---
-- project_director
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'project_director' AND (p.resource || '.' || p.action) IN (
  'project.read','project.write','project.manage',
  'task.read','task.create','task.update','task.assign','task.verify','task.delete',
  'plan_fact.read','plan_fact.approve',
  'module.read','module.create','module.update','module.status_change',
  'gpr.read','gpr.create','gpr.update','gpr.approve',
  'defect.read','defect.report','defect.assign',
  'document.read','document.upload','document.approve',
  'analytics.read','analytics.export',
  'notification_settings.read',
  'import.upload','audit_log.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- site_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'site_manager' AND (p.resource || '.' || p.action) IN (
  'project.read',
  'task.read','task.create','task.update','task.assign','task.verify',
  'plan_fact.read','plan_fact.create','plan_fact.update','plan_fact.approve',
  'module.read','module.update','module.status_change',
  'gpr.read','gpr.create','gpr.update',
  'defect.read','defect.report','defect.assign','defect.verify',
  'document.read','document.upload','document.approve',
  'analytics.read','analytics.export',
  'notification_settings.read',
  'import.upload','audit_log.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- foreman
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'foreman' AND (p.resource || '.' || p.action) IN (
  'project.read',
  'task.read','task.create','task.update','task.assign',
  'plan_fact.read','plan_fact.create','plan_fact.update',
  'module.read','gpr.read',
  'defect.read','defect.report',
  'document.read','document.upload',
  'analytics.read','notification_settings.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- brigadier
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'brigadier' AND (p.resource || '.' || p.action) IN (
  'project.read',
  'task.read','task.update',
  'plan_fact.read','plan_fact.create','plan_fact.update',
  'module.read','gpr.read',
  'defect.read','defect.report',
  'notification_settings.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- qc_inspector
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'qc_inspector' AND (p.resource || '.' || p.action) IN (
  'project.read',
  'task.read','task.verify',
  'plan_fact.read',
  'module.read','module.status_change',
  'gpr.read',
  'defect.read','defect.report','defect.assign','defect.verify',
  'document.read','document.upload',
  'analytics.read','notification_settings.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- logistics_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'logistics_manager' AND (p.resource || '.' || p.action) IN (
  'project.read','task.read',
  'module.read','module.update','module.status_change',
  'document.read','analytics.read','notification_settings.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- production_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'production_manager' AND (p.resource || '.' || p.action) IN (
  'project.read','task.read',
  'module.read','module.create','module.update','module.status_change',
  'document.read','analytics.read','notification_settings.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- engineer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'engineer' AND (p.resource || '.' || p.action) IN (
  'project.read',
  'task.read','task.create','task.update',
  'plan_fact.read',
  'module.read','module.create','module.update',
  'gpr.read','gpr.create','gpr.update',
  'defect.read','defect.report',
  'document.read','document.upload',
  'analytics.read','analytics.export',
  'notification_settings.read','import.upload'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, rbac_permissions p
WHERE r.system_name = 'viewer' AND (p.resource || '.' || p.action) IN (
  'project.read','task.read','plan_fact.read','module.read',
  'gpr.read','defect.read','document.read','analytics.read'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- --- Notification Settings (defaults from section 7.2) ---
INSERT INTO notification_settings (parameter, value, description, applies_to, is_configurable, example) VALUES
  ('morning_reminder_time', '08:00', 'Время утреннего напоминания', 'NS-07', true, '08:00'),
  ('fact_reminder_time', '19:00', 'Время напоминания о вводе факта', 'NS-05', true, '19:00'),
  ('fact_escalation_time', '21:00', 'Время эскалации факта', 'NS-06', true, '21:00'),
  ('daily_summary_time', '23:00', 'Время ежедневной сводки', 'NS-08', true, '23:00'),
  ('overdue_check_time', '07:00', 'Время проверки просрочек', 'NS-02..NS-04', true, '07:00'),
  ('escalation_l1_days', '1', 'Дней до L1 эскалации', 'NS-02', true, '1'),
  ('escalation_l2_days', '3', 'Дней до L2 эскалации', 'NS-03', true, '3'),
  ('escalation_l3_days', '7', 'Дней до L3 эскалации', 'NS-04', true, '7'),
  ('deviation_threshold_pct', '20', '% отклонения для критического уведомления', 'NS-11', true, '20'),
  ('task_accept_timeout_min', '120', 'Минут на принятие задачи', 'NS-01', true, '120')
ON CONFLICT (parameter) DO NOTHING;

-- --- Demo Project (СИТИ-4) ---
INSERT INTO projects (name, code, description, status, start_date)
VALUES ('СИТИ-4', 'CITY-4', 'Референс-объект STSphera', 'ACTIVE', '2025-12-10')
ON CONFLICT (code) DO NOTHING;
