import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RoleSeed = {
  systemName: string;
  displayName: string;
  description: string;
  accessLevel: string;
  receivesNotifications: string;
};

type PermissionSeed = {
  resource: string;
  action: string;
  description: string;
};

type NotificationSettingSeed = {
  parameter: string;
  value: string;
  description: string;
  appliesTo: string;
  isConfigurable: boolean;
  example: string;
};

type MessageTemplateSeed = {
  messageType: string;
  templateText: string;
  variables: string[];
  exampleFilled: string;
};

type NotificationScenarioSeed = {
  code: string;
  taskName: string;
  triggerType: 'UI_ACTION' | 'DATA_CHANGE' | 'SCHEDULE' | 'IMPORT';
  notificationType: string;
  recipientsConfig: Record<string, unknown>;
  messageType: string;
  buttonsConfig: Record<string, unknown>;
  escalationConfig?: Record<string, unknown>;
  escalationTimeMinutes?: number;
  isActive?: boolean;
};

const CORE_ROLES: RoleSeed[] = [
  {
    systemName: 'project_director',
    displayName: 'Руководитель проекта',
    description: 'Весь проект, стратегические решения, эскалации',
    accessLevel: 'Full',
    receivesNotifications: 'Эскалации, сводки, критические отклонения',
  },
  {
    systemName: 'site_manager',
    displayName: 'Начальник участка',
    description: 'Участок / набор фасадов, контроль прорабов',
    accessLevel: 'Write + Approve',
    receivesNotifications: 'Эскалации от прорабов, ежедневные сводки, просрочки',
  },
  {
    systemName: 'foreman',
    displayName: 'Прораб',
    description: 'Фасад / зона, управление бригадами, ежедневный план-факт',
    accessLevel: 'Write',
    receivesNotifications: 'Задачи, план-факт, дефекты, напоминания',
  },
  {
    systemName: 'brigadier',
    displayName: 'Бригадир',
    description: 'Бригада, ввод факта, фото-фиксация',
    accessLevel: 'Write (limited)',
    receivesNotifications: 'Назначенные задачи, напоминания',
  },
  {
    systemName: 'qc_inspector',
    displayName: 'Инспектор ОТК',
    description: 'Приемка работ, проверка модулей, дефекты',
    accessLevel: 'Write + Verify',
    receivesNotifications: 'Задачи на проверку, дефекты',
  },
  {
    systemName: 'logistics_manager',
    displayName: 'Менеджер логистики',
    description: 'Отгрузка / доставка модулей',
    accessLevel: 'Write (modules)',
    receivesNotifications: 'Статусы модулей, отгрузки',
  },
  {
    systemName: 'production_manager',
    displayName: 'Менеджер производства',
    description: 'Производство модулей, план производства',
    accessLevel: 'Write (modules)',
    receivesNotifications: 'План производства, отклонения',
  },
  {
    systemName: 'engineer',
    displayName: 'Инженер ПТО',
    description: 'Документация, ГПР, объемы',
    accessLevel: 'Write + Docs',
    receivesNotifications: 'Документы на согласование, изменения ГПР',
  },
  {
    systemName: 'admin',
    displayName: 'Администратор системы',
    description: 'Настройки, пользователи, импорт, RBAC',
    accessLevel: 'Full',
    receivesNotifications: 'Системные ошибки, импорт',
  },
  {
    systemName: 'viewer',
    displayName: 'Наблюдатель',
    description: 'Только просмотр дашбордов и сводок',
    accessLevel: 'Read-only',
    receivesNotifications: 'Сводки (по подписке)',
  },
];

const ENTERPRISE_ROLES: RoleSeed[] = [
  {
    systemName: 'ceo',
    displayName: 'Генеральный директор',
    description: 'Портфель, бюджет, риски, эскалации 3-го уровня',
    accessLevel: 'Portfolio Read + Escalation',
    receivesNotifications: 'Критические блокеры, бюджетные и сроковые отклонения',
  },
  {
    systemName: 'direction_director',
    displayName: 'Директор направления',
    description: 'Маржинальность направления, ресурсы и межобъектная координация',
    accessLevel: 'Cross-project Management',
    receivesNotifications: 'Эскалации 2-го уровня, ресурсные и поставочные риски',
  },
  {
    systemName: 'contract_manager',
    displayName: 'Договорной отдел',
    description: 'Контракты, допсоглашения, этапы оплат',
    accessLevel: 'Contract Lifecycle',
    receivesNotifications: 'Подписание, изменения условий, просрочки согласования',
  },
  {
    systemName: 'design_manager',
    displayName: 'Проектный отдел',
    description: 'Чертежи, версии, замечания, выдача в работу',
    accessLevel: 'Document Workflow',
    receivesNotifications: 'Замечания, просрочки ревью, изменение РД после выдачи',
  },
  {
    systemName: 'procurement_manager',
    displayName: 'Снабжение',
    description: 'Закупки, поставки, дефициты, поставщики',
    accessLevel: 'Procurement + Supply',
    receivesNotifications: 'Срывы сроков, изменения цен, недопоставки',
  },
  {
    systemName: 'pto_manager',
    displayName: 'ПТО',
    description: 'Исполнительная документация, акты, закрытие объемов',
    accessLevel: 'Acts + Closing',
    receivesNotifications: 'Акты, несоответствия, возвраты на доработку',
  },
];

const PERMISSIONS: PermissionSeed[] = [
  { resource: 'project', action: 'read', description: 'View project' },
  { resource: 'project', action: 'write', description: 'Create/update project' },
  { resource: 'project', action: 'manage', description: 'Manage project settings' },
  { resource: 'portfolio', action: 'read', description: 'View portfolio summary' },
  { resource: 'risk', action: 'read', description: 'View risk register' },
  { resource: 'finance_summary', action: 'read', description: 'View finance summary' },
  { resource: 'task', action: 'read', description: 'View tasks' },
  { resource: 'task', action: 'create', description: 'Create tasks' },
  { resource: 'task', action: 'update', description: 'Update tasks' },
  { resource: 'task', action: 'assign', description: 'Assign tasks' },
  { resource: 'task', action: 'verify', description: 'Verify/accept tasks' },
  { resource: 'task', action: 'delete', description: 'Delete tasks' },
  { resource: 'plan_fact', action: 'read', description: 'View plan-fact' },
  {
    resource: 'plan_fact',
    action: 'create',
    description: 'Create plan-fact entries',
  },
  { resource: 'plan_fact', action: 'update', description: 'Update plan-fact' },
  { resource: 'plan_fact', action: 'approve', description: 'Approve plan-fact' },
  { resource: 'module', action: 'read', description: 'View modules' },
  { resource: 'module', action: 'create', description: 'Create modules' },
  { resource: 'module', action: 'update', description: 'Update modules' },
  {
    resource: 'module',
    action: 'status_change',
    description: 'Change module status',
  },
  { resource: 'gpr', action: 'read', description: 'View GPR' },
  { resource: 'gpr', action: 'create', description: 'Create GPR' },
  { resource: 'gpr', action: 'update', description: 'Update GPR' },
  { resource: 'gpr', action: 'approve', description: 'Approve GPR' },
  { resource: 'defect', action: 'read', description: 'View defects' },
  { resource: 'defect', action: 'report', description: 'Report defect' },
  { resource: 'defect', action: 'assign', description: 'Assign defect' },
  { resource: 'defect', action: 'verify', description: 'Verify defect fix' },
  { resource: 'document', action: 'read', description: 'View documents' },
  { resource: 'document', action: 'upload', description: 'Upload documents' },
  { resource: 'document', action: 'approve', description: 'Approve documents' },
  { resource: 'analytics', action: 'read', description: 'View analytics' },
  { resource: 'analytics', action: 'export', description: 'Export analytics' },
  { resource: 'contract', action: 'read', description: 'View contracts' },
  { resource: 'contract', action: 'create', description: 'Create contracts' },
  { resource: 'contract', action: 'update', description: 'Update contracts' },
  { resource: 'contract', action: 'approve', description: 'Approve contracts' },
  { resource: 'procurement', action: 'read', description: 'View procurement items' },
  {
    resource: 'procurement',
    action: 'create',
    description: 'Create procurement items',
  },
  {
    resource: 'procurement',
    action: 'update',
    description: 'Update procurement items',
  },
  {
    resource: 'procurement',
    action: 'approve',
    description: 'Approve procurement operations',
  },
  { resource: 'supply', action: 'read', description: 'View supply statuses' },
  {
    resource: 'supply',
    action: 'update',
    description: 'Update supply statuses and ETA',
  },
  {
    resource: 'supply',
    action: 'status_change',
    description: 'Change supply stage',
  },
  { resource: 'acts', action: 'read', description: 'View acts and closing docs' },
  { resource: 'acts', action: 'create', description: 'Create acts' },
  { resource: 'acts', action: 'update', description: 'Update acts' },
  { resource: 'acts', action: 'approve', description: 'Approve acts' },
  { resource: 'blocker', action: 'read', description: 'View blockers' },
  { resource: 'blocker', action: 'create', description: 'Create blockers' },
  { resource: 'blocker', action: 'update', description: 'Update blockers' },
  { resource: 'blocker', action: 'close', description: 'Close blockers' },
  { resource: 'blocker', action: 'escalate', description: 'Escalate blockers' },
  {
    resource: 'notification_settings',
    action: 'read',
    description: 'View notification settings',
  },
  {
    resource: 'notification_settings',
    action: 'update',
    description: 'Update notification settings',
  },
  { resource: 'user_management', action: 'read', description: 'View users' },
  { resource: 'user_management', action: 'create', description: 'Create users' },
  { resource: 'user_management', action: 'update', description: 'Update users' },
  { resource: 'user_management', action: 'delete', description: 'Delete users' },
  {
    resource: 'user_management',
    action: 'assign_role',
    description: 'Assign roles',
  },
  { resource: 'import', action: 'upload', description: 'Upload import files' },
  { resource: 'import', action: 'execute', description: 'Execute import' },
  { resource: 'import', action: 'view_log', description: 'View import logs' },
  { resource: 'audit_log', action: 'read', description: 'View audit logs' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  project_director: [
    'project.read',
    'project.write',
    'project.manage',
    'task.read',
    'task.create',
    'task.update',
    'task.assign',
    'task.verify',
    'task.delete',
    'plan_fact.read',
    'plan_fact.approve',
    'module.read',
    'module.create',
    'module.update',
    'module.status_change',
    'gpr.read',
    'gpr.create',
    'gpr.update',
    'gpr.approve',
    'defect.read',
    'defect.report',
    'defect.assign',
    'document.read',
    'document.upload',
    'document.approve',
    'analytics.read',
    'analytics.export',
    'procurement.read',
    'supply.read',
    'supply.update',
    'acts.read',
    'acts.approve',
    'blocker.read',
    'blocker.create',
    'blocker.update',
    'blocker.close',
    'blocker.escalate',
    'notification_settings.read',
    'import.upload',
    'audit_log.read',
  ],
  site_manager: [
    'project.read',
    'task.read',
    'task.create',
    'task.update',
    'task.assign',
    'task.verify',
    'plan_fact.read',
    'plan_fact.create',
    'plan_fact.update',
    'plan_fact.approve',
    'module.read',
    'module.update',
    'module.status_change',
    'gpr.read',
    'gpr.create',
    'gpr.update',
    'defect.read',
    'defect.report',
    'defect.assign',
    'defect.verify',
    'document.read',
    'document.upload',
    'analytics.read',
    'risk.read',
    'blocker.read',
    'blocker.create',
    'blocker.update',
    'blocker.close',
    'notification_settings.read',
    'audit_log.read',
  ],
  foreman: [
    'project.read',
    'task.read',
    'task.update',
    'plan_fact.read',
    'plan_fact.create',
    'plan_fact.update',
    'defect.read',
    'defect.report',
    'document.read',
    'document.upload',
    'blocker.read',
    'blocker.create',
    'blocker.update',
    'notification_settings.read',
  ],
  brigadier: [
    'project.read',
    'task.read',
    'task.update',
    'plan_fact.read',
    'plan_fact.create',
    'plan_fact.update',
    'defect.read',
    'defect.report',
    'blocker.read',
    'blocker.create',
  ],
  qc_inspector: [
    'project.read',
    'task.read',
    'task.verify',
    'module.read',
    'module.status_change',
    'defect.read',
    'defect.verify',
    'document.read',
    'analytics.read',
  ],
  logistics_manager: [
    'project.read',
    'module.read',
    'module.update',
    'module.status_change',
    'procurement.read',
    'supply.read',
    'supply.update',
    'supply.status_change',
    'analytics.read',
    'blocker.read',
    'blocker.create',
    'blocker.escalate',
  ],
  production_manager: [
    'project.read',
    'task.read',
    'module.read',
    'module.create',
    'module.update',
    'module.status_change',
    'analytics.read',
    'blocker.read',
    'blocker.create',
  ],
  engineer: [
    'project.read',
    'task.read',
    'task.create',
    'task.update',
    'plan_fact.read',
    'module.read',
    'module.create',
    'module.update',
    'gpr.read',
    'gpr.create',
    'gpr.update',
    'document.read',
    'document.upload',
    'analytics.read',
    'analytics.export',
    'import.upload',
  ],
  viewer: [
    'project.read',
    'task.read',
    'plan_fact.read',
    'module.read',
    'gpr.read',
    'defect.read',
    'document.read',
    'analytics.read',
  ],
  ceo: [
    'portfolio.read',
    'risk.read',
    'finance_summary.read',
    'project.read',
    'analytics.read',
    'audit_log.read',
    'blocker.read',
  ],
  direction_director: [
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
    'audit_log.read',
  ],
  contract_manager: [
    'project.read',
    'contract.read',
    'contract.create',
    'contract.update',
    'contract.approve',
    'acts.read',
    'acts.approve',
    'finance_summary.read',
    'audit_log.read',
  ],
  design_manager: [
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
    'audit_log.read',
  ],
  procurement_manager: [
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
    'audit_log.read',
  ],
  pto_manager: [
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
    'audit_log.read',
  ],
};

const NOTIFICATION_SETTINGS: NotificationSettingSeed[] = [
  {
    parameter: 'morning_reminder_time',
    value: '08:00',
    description: 'Время утреннего напоминания',
    appliesTo: 'NS-07',
    isConfigurable: true,
    example: '08:00',
  },
  {
    parameter: 'fact_reminder_time',
    value: '19:00',
    description: 'Время напоминания о вводе факта',
    appliesTo: 'NS-05',
    isConfigurable: true,
    example: '19:00',
  },
  {
    parameter: 'fact_escalation_time',
    value: '21:00',
    description: 'Время эскалации факта',
    appliesTo: 'NS-06',
    isConfigurable: true,
    example: '21:00',
  },
  {
    parameter: 'daily_summary_time',
    value: '23:00',
    description: 'Время ежедневной сводки',
    appliesTo: 'NS-08',
    isConfigurable: true,
    example: '23:00',
  },
  {
    parameter: 'overdue_check_time',
    value: '07:00',
    description: 'Время проверки просрочек',
    appliesTo: 'NS-02..NS-04, NS-10',
    isConfigurable: true,
    example: '07:00',
  },
  {
    parameter: 'escalation_l1_days',
    value: '1',
    description: 'Дней до L1 эскалации',
    appliesTo: 'NS-02',
    isConfigurable: true,
    example: '1',
  },
  {
    parameter: 'escalation_l2_days',
    value: '3',
    description: 'Дней до L2 эскалации',
    appliesTo: 'NS-03',
    isConfigurable: true,
    example: '3',
  },
  {
    parameter: 'escalation_l3_days',
    value: '7',
    description: 'Дней до L3 эскалации',
    appliesTo: 'NS-04',
    isConfigurable: true,
    example: '7',
  },
  {
    parameter: 'deviation_threshold_pct',
    value: '20',
    description: '% отклонения для критического уведомления',
    appliesTo: 'NS-11',
    isConfigurable: true,
    example: '20',
  },
  {
    parameter: 'task_accept_timeout_min',
    value: '120',
    description: 'Минут на принятие задачи',
    appliesTo: 'NS-01',
    isConfigurable: true,
    example: '120',
  },
  {
    parameter: 'module_accept_timeout_min',
    value: '240',
    description: 'Минут на принятие статуса модуля',
    appliesTo: 'NS-09',
    isConfigurable: true,
    example: '240',
  },
  {
    parameter: 'defect_critical_timeout_min',
    value: '1440',
    description: 'Минут на реакцию по критическому дефекту',
    appliesTo: 'NS-12',
    isConfigurable: true,
    example: '1440',
  },
  {
    parameter: 'doc_review_timeout_min',
    value: '2880',
    description: 'Минут на ревью документа',
    appliesTo: 'NS-14',
    isConfigurable: true,
    example: '2880',
  },
  {
    parameter: 'retry_count',
    value: '3',
    description: 'Число повторов отправки',
    appliesTo: 'ALL',
    isConfigurable: false,
    example: '3',
  },
  {
    parameter: 'retry_backoff_seconds',
    value: '30,60,120',
    description: 'Backoff для повторов',
    appliesTo: 'ALL',
    isConfigurable: false,
    example: '30,60,120',
  },
  {
    parameter: 'quiet_hours_start',
    value: '23:00',
    description: 'Начало тихих часов',
    appliesTo: 'ALL',
    isConfigurable: true,
    example: '23:00',
  },
  {
    parameter: 'quiet_hours_end',
    value: '07:00',
    description: 'Окончание тихих часов',
    appliesTo: 'ALL',
    isConfigurable: true,
    example: '07:00',
  },
];

const MESSAGE_TEMPLATES: MessageTemplateSeed[] = [
  {
    messageType: 'TASK_ASSIGNED',
    templateText:
      'Вам назначена задача:\n📋 {task_name}\n📍 Фасад: {facade}\n📅 Срок: {deadline}\n⚡ Приоритет: {priority}',
    variables: ['task_name', 'facade', 'deadline', 'priority'],
    exampleFilled:
      'Вам назначена задача:\n📋 Монтаж панелей Ф1-3\n📍 Фасад: Ф1\n📅 Срок: 15.03.2026\n⚡ Приоритет: HIGH',
  },
  {
    messageType: 'TASK_OVERDUE',
    templateText:
      '⚠️ Задача просрочена на {days} дн.:\n📋 {task_name}\n👤 Ответственный: {assignee_name}\n📅 Дедлайн: {deadline}',
    variables: ['days', 'task_name', 'assignee_name', 'deadline'],
    exampleFilled:
      '⚠️ Задача просрочена на 2 дн.:\n📋 Бетонирование плиты\n👤 Иванов И.И.\n📅 10.03.2026',
  },
  {
    messageType: 'TASK_OVERDUE_ESCALATION',
    templateText:
      '🚨 ЭСКАЛАЦИЯ ({level}): Задача просрочена на {days} дн.:\n📋 {task_name}\n👤 {assignee_name}\n📍 Участок: {site}',
    variables: ['level', 'days', 'task_name', 'assignee_name', 'site'],
    exampleFilled:
      '🚨 ЭСКАЛАЦИЯ (L2): Задача просрочена на 4 дн.:\n📋 Монтаж кронштейнов\n👤 Петров П.П.\n📍 Участок: Ф1',
  },
  {
    messageType: 'FACT_REMINDER',
    templateText:
      '📝 Факт за {date} не введен:\n📋 {task_name}\nВнесите данные до конца дня.',
    variables: ['date', 'task_name'],
    exampleFilled:
      '📝 Факт за 2026-02-12 не введен:\n📋 Установка направляющих\nВнесите данные до конца дня.',
  },
  {
    messageType: 'FACT_ESCALATION',
    templateText:
      '🚨 ЭСКАЛАЦИЯ: {foreman_name} не внес факт за {date}.\n📋 Задачи: {task_list}',
    variables: ['foreman_name', 'date', 'task_list'],
    exampleFilled:
      '🚨 ЭСКАЛАЦИЯ: Иванов И.И. не внес факт за 2026-02-12.\n📋 Задачи: Т-001, Т-003',
  },
  {
    messageType: 'PLAN_MORNING',
    templateText:
      '☀️ Доброе утро! Задачи на сегодня:\n{task_list}\n📊 Общий план: {plan_total} {unit}',
    variables: ['task_list', 'plan_total', 'unit'],
    exampleFilled:
      '☀️ Доброе утро! Задачи на сегодня:\n1) Монтаж Ф2\n2) Проверка узлов\n📊 Общий план: 320 м2',
  },
  {
    messageType: 'DAILY_SUMMARY',
    templateText:
      '📊 Сводка за {date}:\n✅ Прогресс: {pct}%\n📋 Выполнено: {done}/{total}\n⏰ Просрочено: {overdue}\n⚠️ Отклонения: {deviations}',
    variables: ['date', 'pct', 'done', 'total', 'overdue', 'deviations'],
    exampleFilled:
      '📊 Сводка за 2026-02-12:\n✅ Прогресс: 78%\n📋 Выполнено: 42/58\n⏰ Просрочено: 6\n⚠️ Отклонения: 3',
  },
  {
    messageType: 'MODULE_STATUS_CHANGED',
    templateText:
      '🔄 Модуль {code} ({type}):\n{old_status} → {new_status}\n📍 Фасад: {facade}',
    variables: ['code', 'type', 'old_status', 'new_status', 'facade'],
    exampleFilled:
      '🔄 Модуль MOD-001 (Фасадная панель):\nPRODUCED → SHIPPED\n📍 Фасад: Ф1',
  },
  {
    messageType: 'DEFECT_REPORTED',
    templateText:
      '🔴 Дефект в {facade}/{zone}:\n{description}\n⚡ Критичность: {priority}\n👤 Автор: {reporter_name}',
    variables: ['facade', 'zone', 'description', 'priority', 'reporter_name'],
    exampleFilled:
      '🔴 Дефект в Ф2/ось А-Б:\nПовреждение крепежа\n⚡ Критичность: HIGH\n👤 Автор: Сидоров С.С.',
  },
  {
    messageType: 'IMPORT_COMPLETED',
    templateText:
      '📥 Импорт завершен: {file_name}\n✅ Записей: {imported}/{total}\n❌ Ошибок: {errors}\n⚠️ Предупреждений: {warnings}',
    variables: ['file_name', 'imported', 'total', 'errors', 'warnings'],
    exampleFilled:
      '📥 Импорт завершен: gpr.xlsx\n✅ Записей: 120/122\n❌ Ошибок: 2\n⚠️ Предупреждений: 5',
  },
  {
    messageType: 'USER_REGISTERED',
    templateText:
      '👤 Новый пользователь: {name} (@{username})\n🆔 TG ID: {tg_id}\nТребуется назначение роли.',
    variables: ['name', 'username', 'tg_id'],
    exampleFilled:
      '👤 Новый пользователь: Иван Иванов (@ivan)\n🆔 TG ID: 123456\nТребуется назначение роли.',
  },
  {
    messageType: 'TASK_COMPLETED',
    templateText:
      '✅ Задача завершена:\n📋 {task_name}\n👤 {assignee_name}\n📊 Факт: {actual}/{planned} ({pct}%)',
    variables: ['task_name', 'assignee_name', 'actual', 'planned', 'pct'],
    exampleFilled:
      '✅ Задача завершена:\n📋 Монтаж Ф3\n👤 Петров П.П.\n📊 Факт: 120/120 (100%)',
  },
];

const NOTIFICATION_SCENARIOS: NotificationScenarioSeed[] = [
  {
    code: 'NS-01',
    taskName: 'Назначение задачи исполнителю',
    triggerType: 'DATA_CHANGE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['foreman', 'brigadier'] },
    messageType: 'TASK_ASSIGNED',
    buttonsConfig: { buttons: ['accept:task:{id}', 'detail:task:{id}'] },
    escalationConfig: { escalateToRole: 'site_manager', reason: 'no_accept' },
    escalationTimeMinutes: 120,
  },
  {
    code: 'NS-02',
    taskName: 'Просрочка задачи L1',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['foreman', 'brigadier'] },
    messageType: 'TASK_OVERDUE',
    buttonsConfig: { buttons: ['update:task:{id}', 'reschedule:task:{id}'] },
    escalationConfig: { escalateToRole: 'site_manager', level: 'L1' },
    escalationTimeMinutes: 1440,
  },
  {
    code: 'NS-03',
    taskName: 'Просрочка задачи L2',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['site_manager'] },
    messageType: 'TASK_OVERDUE_ESCALATION',
    buttonsConfig: { buttons: ['escalate_ack:task:{id}', 'detail:task:{id}'] },
    escalationConfig: { escalateToRole: 'direction_director', level: 'L2' },
    escalationTimeMinutes: 2880,
  },
  {
    code: 'NS-04',
    taskName: 'Просрочка задачи L3',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['ceo', 'project_director'] },
    messageType: 'TASK_OVERDUE_ESCALATION',
    buttonsConfig: { buttons: ['detail:task:{id}'] },
    escalationConfig: { final: true, level: 'L3' },
    escalationTimeMinutes: 10080,
  },
  {
    code: 'NS-05',
    taskName: 'Напоминание о вводе факта',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['foreman', 'brigadier'] },
    messageType: 'FACT_REMINDER',
    buttonsConfig: { buttons: ['enter_fact:task:{id}'] },
    escalationConfig: { escalateToRole: 'site_manager' },
    escalationTimeMinutes: 120,
  },
  {
    code: 'NS-06',
    taskName: 'Эскалация отсутствия факта',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['site_manager', 'project_director'] },
    messageType: 'FACT_ESCALATION',
    buttonsConfig: { buttons: ['contact:user:{id}', 'detail:task:{id}'] },
    escalationTimeMinutes: 120,
  },
  {
    code: 'NS-07',
    taskName: 'Утренний план',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['foreman', 'brigadier'] },
    messageType: 'PLAN_MORNING',
    buttonsConfig: { buttons: ['plan_fact:date:{date}'] },
  },
  {
    code: 'NS-08',
    taskName: 'Ежедневная сводка',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: {
      roles: ['project_director', 'direction_director', 'ceo', 'site_manager'],
    },
    messageType: 'DAILY_SUMMARY',
    buttonsConfig: { buttons: ['dashboard:project:{id}'] },
  },
  {
    code: 'NS-09',
    taskName: 'Смена статуса модуля',
    triggerType: 'DATA_CHANGE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['production_manager', 'logistics_manager', 'foreman'] },
    messageType: 'MODULE_STATUS_CHANGED',
    buttonsConfig: { buttons: ['detail:module:{id}', 'accept:module:{id}'] },
    escalationConfig: { escalateToRole: 'site_manager' },
    escalationTimeMinutes: 240,
  },
  {
    code: 'NS-10',
    taskName: 'Просрочка по модулю',
    triggerType: 'SCHEDULE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['logistics_manager', 'procurement_manager'] },
    messageType: 'MODULE_STATUS_CHANGED',
    buttonsConfig: { buttons: ['update:module:{id}', 'detail:module:{id}'] },
    escalationConfig: { escalateToRole: 'direction_director' },
    escalationTimeMinutes: 1440,
  },
  {
    code: 'NS-11',
    taskName: 'Критическое отклонение план-факт',
    triggerType: 'DATA_CHANGE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['site_manager', 'project_director'] },
    messageType: 'DAILY_SUMMARY',
    buttonsConfig: { buttons: ['detail:task:{id}', 'blocker_raise:task:{id}'] },
    escalationConfig: { createBlocker: true },
    escalationTimeMinutes: 60,
  },
  {
    code: 'NS-12',
    taskName: 'Дефект зафиксирован',
    triggerType: 'UI_ACTION',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['foreman', 'site_manager', 'qc_inspector'] },
    messageType: 'DEFECT_REPORTED',
    buttonsConfig: { buttons: ['accept:defect:{id}', 'delegate:task:{id}'] },
    escalationConfig: { escalateToRole: 'project_director', criticalOnly: true },
    escalationTimeMinutes: 1440,
  },
  {
    code: 'NS-13',
    taskName: 'Дефект исправлен',
    triggerType: 'DATA_CHANGE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['qc_inspector'] },
    messageType: 'TASK_COMPLETED',
    buttonsConfig: { buttons: ['verify:task:{id}', 'detail:task:{id}'] },
    escalationConfig: { escalateToRole: 'site_manager' },
    escalationTimeMinutes: 1440,
  },
  {
    code: 'NS-14',
    taskName: 'Документ на согласовании',
    triggerType: 'UI_ACTION',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['engineer', 'design_manager', 'project_director'] },
    messageType: 'TASK_ASSIGNED',
    buttonsConfig: { buttons: ['open:doc:{id}', 'approve:doc:{id}', 'reject:doc:{id}'] },
    escalationConfig: { escalateToRole: 'project_director' },
    escalationTimeMinutes: 2880,
  },
  {
    code: 'NS-15',
    taskName: 'Импорт завершен',
    triggerType: 'IMPORT',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['admin', 'engineer'] },
    messageType: 'IMPORT_COMPLETED',
    buttonsConfig: { buttons: ['import_log:{id}'] },
  },
  {
    code: 'NS-16',
    taskName: 'Новый пользователь зарегистрирован',
    triggerType: 'UI_ACTION',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['admin'] },
    messageType: 'USER_REGISTERED',
    buttonsConfig: { buttons: ['assign_role:user:{id}'] },
  },
  {
    code: 'NS-17',
    taskName: 'Задача завершена',
    triggerType: 'DATA_CHANGE',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['site_manager', 'project_director'] },
    messageType: 'TASK_COMPLETED',
    buttonsConfig: { buttons: ['accept:task:{id}', 'rework:task:{id}'] },
    escalationConfig: { escalateToRole: 'site_manager' },
    escalationTimeMinutes: 1440,
  },
  {
    code: 'NS-18',
    taskName: 'ГПР утвержден',
    triggerType: 'UI_ACTION',
    notificationType: 'Push (Bot)',
    recipientsConfig: { roles: ['site_manager', 'foreman', 'engineer'] },
    messageType: 'TASK_ASSIGNED',
    buttonsConfig: { buttons: ['gpr:project:{id}'] },
  },
];

function key(resource: string, action: string): string {
  return `${resource}.${action}`;
}

async function seedDepartments() {
  const departments = [
    'Руководство',
    'Управление проектом',
    'Договорной отдел',
    'Проектный отдел',
    'Снабжение',
    'Производство',
    'Контроль качества',
    'Логистика',
    'ПТО',
    'IT',
  ];

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  console.log(`  Departments: ${departments.length}`);
}

async function seedRoles() {
  const allRoles = [...CORE_ROLES, ...ENTERPRISE_ROLES];

  for (const role of allRoles) {
    await prisma.role.upsert({
      where: { systemName: role.systemName },
      create: role,
      update: role,
    });
  }

  console.log(`  Roles: ${allRoles.length}`);
}

async function seedPermissions() {
  for (const permission of PERMISSIONS) {
    await prisma.rbacPermission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      create: permission,
      update: permission,
    });
  }

  console.log(`  Permissions: ${PERMISSIONS.length}`);
}

async function seedRolePermissions() {
  const permissionMap = new Map<string, number>();
  for (const permission of PERMISSIONS) {
    const record = await prisma.rbacPermission.findUnique({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
    });

    if (record) {
      permissionMap.set(key(permission.resource, permission.action), record.id);
    }
  }

  let inserted = 0;
  const allPermissionIds = [...permissionMap.values()];

  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { systemName: roleName } });
    if (!role) continue;

    const permissionIds =
      permKeys.length === 1 && permKeys[0] === '*'
        ? allPermissionIds
        : permKeys
            .map((permKey) => permissionMap.get(permKey))
            .filter((value): value is number => typeof value === 'number');

    for (const permissionId of permissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
        create: {
          roleId: role.id,
          permissionId,
        },
        update: {},
      });
      inserted += 1;
    }
  }

  console.log(`  Role-Permission mappings: ${inserted}`);
}

async function seedNotificationSettings() {
  for (const setting of NOTIFICATION_SETTINGS) {
    await prisma.notificationSetting.upsert({
      where: { parameter: setting.parameter },
      create: setting,
      update: setting,
    });
  }

  console.log(`  Notification settings: ${NOTIFICATION_SETTINGS.length}`);
}

async function seedMessageTemplates() {
  const templateIds = new Map<string, number>();

  for (const template of MESSAGE_TEMPLATES) {
    const record = await prisma.messageTemplate.upsert({
      where: { messageType: template.messageType },
      create: template,
      update: template,
    });
    templateIds.set(template.messageType, record.id);
  }

  console.log(`  Message templates: ${MESSAGE_TEMPLATES.length}`);
  return templateIds;
}

async function seedNotificationScenarios(templateIds: Map<string, number>) {
  for (const scenario of NOTIFICATION_SCENARIOS) {
    const messageTemplateId = templateIds.get(scenario.messageType) || null;

    await prisma.notificationScenario.upsert({
      where: { code: scenario.code },
      create: {
        code: scenario.code,
        taskName: scenario.taskName,
        triggerType: scenario.triggerType,
        notificationType: scenario.notificationType,
        recipientsConfig: scenario.recipientsConfig,
        messageTemplateId,
        buttonsConfig: scenario.buttonsConfig,
        escalationConfig: scenario.escalationConfig || null,
        escalationTimeMinutes: scenario.escalationTimeMinutes || null,
        isActive: scenario.isActive ?? true,
      },
      update: {
        taskName: scenario.taskName,
        triggerType: scenario.triggerType,
        notificationType: scenario.notificationType,
        recipientsConfig: scenario.recipientsConfig,
        messageTemplateId,
        buttonsConfig: scenario.buttonsConfig,
        escalationConfig: scenario.escalationConfig || null,
        escalationTimeMinutes: scenario.escalationTimeMinutes || null,
        isActive: scenario.isActive ?? true,
      },
    });
  }

  console.log(`  Notification scenarios: ${NOTIFICATION_SCENARIOS.length}`);
}

async function main() {
  console.log('Seeding database...');

  await seedDepartments();
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedNotificationSettings();

  const templateIds = await seedMessageTemplates();
  await seedNotificationScenarios(templateIds);

  console.log('Seed completed!');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
