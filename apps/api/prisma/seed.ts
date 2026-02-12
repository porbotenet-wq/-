import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed: 10 roles + departments + RBAC permissions matrix
 * Based on section 4 (RBAC) of architecture docs
 */
async function main() {
  console.log('Seeding database...');

  // --- Departments ---
  const departments = [
    'Управление проектом',
    'Производство',
    'Контроль качества',
    'Логистика',
    'Производство модулей',
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

  // --- Roles (from section 4.1) ---
  const roles = [
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
      description: 'Приёмка работ, проверка модулей, дефекты',
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
      description: 'Документация, ГПР, объёмы',
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

  for (const role of roles) {
    await prisma.role.upsert({
      where: { systemName: role.systemName },
      create: role,
      update: role,
    });
  }
  console.log(`  Roles: ${roles.length}`);

  // --- Permissions ---
  const permissions: { resource: string; action: string; description: string }[] = [
    // project
    { resource: 'project', action: 'read', description: 'View project' },
    { resource: 'project', action: 'write', description: 'Create/update project' },
    { resource: 'project', action: 'manage', description: 'Manage project settings' },
    // task
    { resource: 'task', action: 'read', description: 'View tasks' },
    { resource: 'task', action: 'create', description: 'Create tasks' },
    { resource: 'task', action: 'update', description: 'Update tasks' },
    { resource: 'task', action: 'assign', description: 'Assign tasks' },
    { resource: 'task', action: 'verify', description: 'Verify/accept tasks' },
    { resource: 'task', action: 'delete', description: 'Delete tasks' },
    // plan_fact
    { resource: 'plan_fact', action: 'read', description: 'View plan-fact' },
    { resource: 'plan_fact', action: 'create', description: 'Create plan-fact entries' },
    { resource: 'plan_fact', action: 'update', description: 'Update plan-fact' },
    { resource: 'plan_fact', action: 'approve', description: 'Approve plan-fact' },
    // module
    { resource: 'module', action: 'read', description: 'View modules' },
    { resource: 'module', action: 'create', description: 'Create modules' },
    { resource: 'module', action: 'update', description: 'Update modules' },
    { resource: 'module', action: 'status_change', description: 'Change module status' },
    // gpr
    { resource: 'gpr', action: 'read', description: 'View GPR' },
    { resource: 'gpr', action: 'create', description: 'Create GPR' },
    { resource: 'gpr', action: 'update', description: 'Update GPR' },
    { resource: 'gpr', action: 'approve', description: 'Approve GPR' },
    // defect
    { resource: 'defect', action: 'read', description: 'View defects' },
    { resource: 'defect', action: 'report', description: 'Report defect' },
    { resource: 'defect', action: 'assign', description: 'Assign defect' },
    { resource: 'defect', action: 'verify', description: 'Verify defect fix' },
    // document
    { resource: 'document', action: 'read', description: 'View documents' },
    { resource: 'document', action: 'upload', description: 'Upload documents' },
    { resource: 'document', action: 'approve', description: 'Approve documents' },
    // analytics
    { resource: 'analytics', action: 'read', description: 'View analytics' },
    { resource: 'analytics', action: 'export', description: 'Export analytics' },
    // notification_settings
    { resource: 'notification_settings', action: 'read', description: 'View notification settings' },
    { resource: 'notification_settings', action: 'update', description: 'Update notification settings' },
    // user_management
    { resource: 'user_management', action: 'read', description: 'View users' },
    { resource: 'user_management', action: 'create', description: 'Create users' },
    { resource: 'user_management', action: 'update', description: 'Update users' },
    { resource: 'user_management', action: 'delete', description: 'Delete users' },
    { resource: 'user_management', action: 'assign_role', description: 'Assign roles' },
    // import
    { resource: 'import', action: 'upload', description: 'Upload import files' },
    { resource: 'import', action: 'execute', description: 'Execute import' },
    { resource: 'import', action: 'view_log', description: 'View import logs' },
    // audit_log
    { resource: 'audit_log', action: 'read', description: 'View audit logs' },
  ];

  for (const perm of permissions) {
    await prisma.rbacPermission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      create: perm,
      update: perm,
    });
  }
  console.log(`  Permissions: ${permissions.length}`);

  // --- Role ↔ Permission matrix (section 4.3) ---
  const matrix: Record<string, string[]> = {
    project_director: [
      'project.read', 'project.write', 'project.manage',
      'task.read', 'task.create', 'task.update', 'task.assign', 'task.verify', 'task.delete',
      'plan_fact.read', 'plan_fact.approve',
      'module.read', 'module.create', 'module.update', 'module.status_change',
      'gpr.read', 'gpr.create', 'gpr.update', 'gpr.approve',
      'defect.read', 'defect.report', 'defect.assign',
      'document.read', 'document.upload', 'document.approve',
      'analytics.read', 'analytics.export',
      'notification_settings.read',
      'import.upload',
      'audit_log.read',
    ],
    site_manager: [
      'project.read',
      'task.read', 'task.create', 'task.update', 'task.assign', 'task.verify',
      'plan_fact.read', 'plan_fact.create', 'plan_fact.update', 'plan_fact.approve',
      'module.read', 'module.update', 'module.status_change',
      'gpr.read', 'gpr.create', 'gpr.update',
      'defect.read', 'defect.report', 'defect.assign', 'defect.verify',
      'document.read', 'document.upload', 'document.approve',
      'analytics.read', 'analytics.export',
      'notification_settings.read',
      'import.upload',
      'audit_log.read',
    ],
    foreman: [
      'project.read',
      'task.read', 'task.create', 'task.update', 'task.assign',
      'plan_fact.read', 'plan_fact.create', 'plan_fact.update',
      'module.read',
      'gpr.read',
      'defect.read', 'defect.report',
      'document.read', 'document.upload',
      'analytics.read',
      'notification_settings.read',
    ],
    brigadier: [
      'project.read',
      'task.read', 'task.update',
      'plan_fact.read', 'plan_fact.create', 'plan_fact.update',
      'module.read',
      'gpr.read',
      'defect.read', 'defect.report',
      'notification_settings.read',
    ],
    qc_inspector: [
      'project.read',
      'task.read', 'task.verify',
      'plan_fact.read',
      'module.read', 'module.status_change',
      'gpr.read',
      'defect.read', 'defect.report', 'defect.assign', 'defect.verify',
      'document.read', 'document.upload',
      'analytics.read',
      'notification_settings.read',
    ],
    logistics_manager: [
      'project.read',
      'task.read',
      'module.read', 'module.update', 'module.status_change',
      'document.read',
      'analytics.read',
      'notification_settings.read',
    ],
    production_manager: [
      'project.read',
      'task.read',
      'module.read', 'module.create', 'module.update', 'module.status_change',
      'document.read',
      'analytics.read',
      'notification_settings.read',
    ],
    engineer: [
      'project.read',
      'task.read', 'task.create', 'task.update',
      'plan_fact.read',
      'module.read', 'module.create', 'module.update',
      'gpr.read', 'gpr.create', 'gpr.update',
      'defect.read', 'defect.report',
      'document.read', 'document.upload',
      'analytics.read', 'analytics.export',
      'notification_settings.read',
      'import.upload',
    ],
    admin: [], // admin has bypass in RBAC guard, but we could add all for completeness
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
  };

  let rolePermCount = 0;
  for (const [roleName, perms] of Object.entries(matrix)) {
    const role = await prisma.role.findUnique({ where: { systemName: roleName } });
    if (!role) continue;

    for (const permStr of perms) {
      const [resource, action] = permStr.split('.');
      const perm = await prisma.rbacPermission.findUnique({
        where: { resource_action: { resource, action } },
      });
      if (!perm) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
      rolePermCount++;
    }
  }
  console.log(`  Role-Permission mappings: ${rolePermCount}`);

  // --- Notification Settings (defaults from section 7.2) ---
  const notifSettings = [
    { parameter: 'morning_reminder_time', value: '08:00', description: 'Время утреннего напоминания', appliesTo: 'NS-07', isConfigurable: true, example: '08:00' },
    { parameter: 'fact_reminder_time', value: '19:00', description: 'Время напоминания о вводе факта', appliesTo: 'NS-05', isConfigurable: true, example: '19:00' },
    { parameter: 'fact_escalation_time', value: '21:00', description: 'Время эскалации факта', appliesTo: 'NS-06', isConfigurable: true, example: '21:00' },
    { parameter: 'daily_summary_time', value: '23:00', description: 'Время ежедневной сводки', appliesTo: 'NS-08', isConfigurable: true, example: '23:00' },
    { parameter: 'overdue_check_time', value: '07:00', description: 'Время проверки просрочек', appliesTo: 'NS-02..NS-04', isConfigurable: true, example: '07:00' },
    { parameter: 'escalation_l1_days', value: '1', description: 'Дней до L1 эскалации', appliesTo: 'NS-02', isConfigurable: true, example: '1' },
    { parameter: 'escalation_l2_days', value: '3', description: 'Дней до L2 эскалации', appliesTo: 'NS-03', isConfigurable: true, example: '3' },
    { parameter: 'escalation_l3_days', value: '7', description: 'Дней до L3 эскалации', appliesTo: 'NS-04', isConfigurable: true, example: '7' },
    { parameter: 'deviation_threshold_pct', value: '20', description: '% отклонения для критического уведомления', appliesTo: 'NS-11', isConfigurable: true, example: '20' },
    { parameter: 'task_accept_timeout_min', value: '120', description: 'Минут на принятие задачи', appliesTo: 'NS-01', isConfigurable: true, example: '120' },
  ];

  for (const setting of notifSettings) {
    await prisma.notificationSetting.upsert({
      where: { parameter: setting.parameter },
      create: setting,
      update: setting,
    });
  }
  console.log(`  Notification settings: ${notifSettings.length}`);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
