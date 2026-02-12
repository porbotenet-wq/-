// STSphera — Project Workflow Engine (Supabase Edge Function)
// Handles inter-department interactions when creating/managing a construction object
//
// Workflow: Создание объекта →
//   1. Руководитель проекта создаёт объект
//   2. Инженер ПТО загружает ГПР → генерация TaskTemplates
//   3. Начальник участка настраивает фасады/зоны
//   4. Система генерирует TaskInstances из шаблонов
//   5. Задачи назначаются по отделам/ролям
//   6. Менеджер производства получает план модулей
//   7. Уведомления всем участникам

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==========================================
// Telegram helper
// ==========================================
async function notify(telegramId: number, text: string, buttons?: any[][]) {
  const body: any = {
    chat_id: telegramId,
    text,
    parse_mode: "Markdown",
  };
  if (buttons) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ==========================================
// 1. CREATE PROJECT (Руководитель проекта)
// ==========================================
async function createProject(params: {
  name: string;
  code: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdBy: number; // user_id
}) {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: params.name,
      code: params.code,
      description: params.description || null,
      status: "ACTIVE",
      start_date: params.startDate || null,
      end_date: params.endDate || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Create project: ${error.message}`);

  // AuditLog
  await supabase.from("audit_logs").insert({
    action: "PROJECT_CREATED",
    entity_type: "Project",
    entity_id: project.id,
    user_id: params.createdBy,
    new_value: { name: params.name, code: params.code },
  });

  // Notify all department heads
  await notifyDepartmentHeads(
    project,
    params.createdBy,
    `🏗 *Новый объект создан:*\n📁 ${project.name} (${project.code})\n\nОжидается настройка фасадов и загрузка ГПР.`
  );

  return project;
}

// ==========================================
// 2. ADD FACADES (Начальник участка)
// ==========================================
async function addFacades(params: {
  projectId: number;
  facades: Array<{
    name: string;
    areaM2?: number;
    floors?: string;
    axes?: string;
    priority?: string;
    plannedStart?: string;
    plannedEnd?: string;
  }>;
  createdBy: number;
}) {
  const inserted = [];
  for (const f of params.facades) {
    const { data, error } = await supabase
      .from("facades")
      .insert({
        project_id: params.projectId,
        name: f.name,
        area_m2: f.areaM2 || null,
        floors: f.floors || null,
        axes: f.axes || null,
        priority: f.priority || "MEDIUM",
        planned_start: f.plannedStart || null,
        planned_end: f.plannedEnd || null,
      })
      .select()
      .single();

    if (!error && data) inserted.push(data);
  }

  // AuditLog
  await supabase.from("audit_logs").insert({
    action: "FACADES_ADDED",
    entity_type: "Facade",
    entity_id: params.projectId,
    user_id: params.createdBy,
    new_value: { count: inserted.length, names: inserted.map((f) => f.name) },
  });

  // Notify foremen — they need to know about facades for their zones
  await notifyByRole(params.projectId, "foreman",
    `🏢 *Добавлены фасады (${inserted.length}):*\n${inserted.map((f) => `• ${f.name}`).join("\n")}\n\nОжидайте назначения задач.`
  );

  // Notify engineer — can now create GPR
  await notifyByRole(params.projectId, "engineer",
    `🏢 Фасады добавлены (${inserted.length}). Можно загружать ГПР и создавать задачи.`,
    [[{ text: "📋 Создать задачи", callback_data: `create_tasks:${params.projectId}` }]]
  );

  return inserted;
}

// ==========================================
// 3. CREATE WORK TYPES (Инженер ПТО)
// ==========================================
async function addWorkTypes(params: {
  projectId: number;
  workTypes: Array<{
    code: string;
    name: string;
    unit?: string;
    phase?: string;
    priority?: string;
  }>;
  createdBy: number;
}) {
  const inserted = [];
  for (const wt of params.workTypes) {
    const { data, error } = await supabase
      .from("work_types")
      .upsert(
        {
          project_id: params.projectId,
          code: wt.code,
          name: wt.name,
          unit: wt.unit || null,
          phase: wt.phase || null,
          priority: wt.priority || "MEDIUM",
        },
        { onConflict: "project_id,code" }
      )
      .select()
      .single();

    if (!error && data) inserted.push(data);
  }

  await supabase.from("audit_logs").insert({
    action: "WORK_TYPES_ADDED",
    entity_type: "WorkType",
    entity_id: params.projectId,
    user_id: params.createdBy,
    new_value: { count: inserted.length },
  });

  return inserted;
}

// ==========================================
// 4. CREATE TASK TEMPLATES (from ГПР)
// ==========================================
async function createTaskTemplates(params: {
  projectId: number;
  templates: Array<{
    code: string;
    name: string;
    unit?: string;
    durationDays?: number;
    defaultStart?: string;
    defaultEnd?: string;
    isSectionHeader?: boolean;
    sectionName?: string;
    sortOrder: number;
    defaultResponsibleRole?: string;
    phase?: string;
    priority?: string;
  }>;
  createdBy: number;
}) {
  const inserted = [];
  for (const t of params.templates) {
    const { data, error } = await supabase
      .from("task_templates")
      .insert({
        project_id: params.projectId,
        code: t.code,
        name: t.name,
        unit: t.unit || null,
        duration_days: t.durationDays || null,
        default_start: t.defaultStart || null,
        default_end: t.defaultEnd || null,
        is_section_header: t.isSectionHeader || false,
        section_name: t.sectionName || null,
        sort_order: t.sortOrder,
        default_responsible_role: t.defaultResponsibleRole || null,
        phase: t.phase || null,
        priority: t.priority || "MEDIUM",
      })
      .select()
      .single();

    if (!error && data) inserted.push(data);
  }

  await supabase.from("audit_logs").insert({
    action: "TASK_TEMPLATES_CREATED",
    entity_type: "TaskTemplate",
    entity_id: params.projectId,
    user_id: params.createdBy,
    new_value: { count: inserted.length },
  });

  return inserted;
}

// ==========================================
// 5. GENERATE TASK INSTANCES (system)
// Порождение задач из шаблонов → назначение по отделам
// ==========================================
async function generateTaskInstances(params: {
  projectId: number;
  facadeId?: number;
  createdBy: number;
}) {
  // Get templates (non-headers)
  const { data: templates } = await supabase
    .from("task_templates")
    .select("*")
    .eq("project_id", params.projectId)
    .eq("is_section_header", false)
    .order("sort_order");

  if (!templates || templates.length === 0) {
    return { generated: 0, assigned: 0 };
  }

  // Get facades
  const facadeQuery = supabase
    .from("facades")
    .select("id, name")
    .eq("project_id", params.projectId);

  if (params.facadeId) {
    facadeQuery.eq("id", params.facadeId);
  }

  const { data: facades } = await facadeQuery;
  const facadeList = facades || [{ id: null, name: "Без фасада" }];

  let generated = 0;
  let assigned = 0;
  const assignmentsByRole: Record<string, number> = {};

  for (const facade of facadeList) {
    for (const template of templates) {
      // Check if instance already exists
      const { data: existing } = await supabase
        .from("task_instances")
        .select("id")
        .eq("template_id", template.id)
        .eq("project_id", params.projectId)
        .eq("facade_id", facade.id)
        .maybeSingle();

      if (existing) continue;

      // Find assignee by role
      let assigneeId = null;
      const role = template.default_responsible_role;
      if (role) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("project_id", params.projectId)
          .eq("roles.system_name", role)
          .limit(1)
          .maybeSingle();

        // Fallback: find by role name in roles table
        if (!userRole) {
          const { data: roleData } = await supabase
            .from("roles")
            .select("id")
            .eq("system_name", role)
            .maybeSingle();

          if (roleData) {
            const { data: ur } = await supabase
              .from("user_roles")
              .select("user_id")
              .eq("project_id", params.projectId)
              .eq("role_id", roleData.id)
              .limit(1)
              .maybeSingle();

            if (ur) assigneeId = ur.user_id;
          }
        } else {
          assigneeId = userRole.user_id;
        }
      }

      // Create TaskInstance
      const { data: instance } = await supabase
        .from("task_instances")
        .insert({
          template_id: template.id,
          project_id: params.projectId,
          type: "TASK",
          status: assigneeId ? "ASSIGNED" : "CREATED",
          assignee_id: assigneeId,
          facade_id: facade.id,
          planned_start: template.default_start,
          planned_end: template.default_end,
          planned_volume: null,
          priority: template.priority,
          notes: null,
          created_by: params.createdBy,
        })
        .select()
        .single();

      if (instance) {
        generated++;
        if (assigneeId) {
          assigned++;
          assignmentsByRole[role || "unknown"] =
            (assignmentsByRole[role || "unknown"] || 0) + 1;
        }
      }
    }
  }

  // AuditLog
  await supabase.from("audit_logs").insert({
    action: "TASKS_GENERATED",
    entity_type: "TaskInstance",
    entity_id: params.projectId,
    user_id: params.createdBy,
    new_value: { generated, assigned, byRole: assignmentsByRole },
  });

  // Notify assigned users
  await notifyAssignedUsers(params.projectId);

  // Notify site_manager
  await notifyByRole(params.projectId, "site_manager",
    `📋 *Задачи сгенерированы:*\n\n` +
    `✅ Создано: ${generated}\n` +
    `👤 Назначено: ${assigned}\n` +
    `⚪ Без назначения: ${generated - assigned}\n\n` +
    Object.entries(assignmentsByRole)
      .map(([r, c]) => `• ${r}: ${c} задач`)
      .join("\n"),
    [[{ text: "📋 Смотреть задачи", callback_data: `view_tasks:${params.projectId}` }]]
  );

  // Notify project_director
  await notifyByRole(params.projectId, "project_director",
    `📊 Объект готов к работе!\n\nЗадач: ${generated} | Назначено: ${assigned}`
  );

  return { generated, assigned, assignmentsByRole };
}

// ==========================================
// 6. ADD MODULE PLAN (Менеджер производства)
// ==========================================
async function addModulePlan(params: {
  projectId: number;
  modules: Array<{
    phase?: string;
    moduleType: string;
    code: string;
    sizeMm?: string;
    quantity: number;
    axesFacade?: string;
    facadeId?: number;
    floors?: string;
    productionDate?: string;
    shipmentDate?: string;
    mountDate?: string;
  }>;
  createdBy: number;
}) {
  const inserted = [];
  for (const m of params.modules) {
    const { data, error } = await supabase
      .from("module_plan_items")
      .upsert(
        {
          project_id: params.projectId,
          phase: m.phase || null,
          module_type: m.moduleType,
          code: m.code,
          size_mm: m.sizeMm || null,
          quantity: m.quantity,
          axes_facade: m.axesFacade || null,
          facade_id: m.facadeId || null,
          floors: m.floors || null,
          production_date: m.productionDate || null,
          shipment_date: m.shipmentDate || null,
          mount_date: m.mountDate || null,
          status: "PLANNED",
        },
        { onConflict: "project_id,code" }
      )
      .select()
      .single();

    if (!error && data) inserted.push(data);
  }

  // Notify logistics
  await notifyByRole(params.projectId, "logistics_manager",
    `📦 *План модулей обновлён:*\n${inserted.length} модулей добавлено.\n\nГотовьте логистику отгрузок.`,
    [[{ text: "📦 Смотреть модули", callback_data: `view_modules:${params.projectId}` }]]
  );

  // Notify foremen about upcoming mounts
  await notifyByRole(params.projectId, "foreman",
    `📦 Добавлен план модулей (${inserted.length} шт.). Ожидайте уведомления о доставке на площадку.`
  );

  // Notify QC
  await notifyByRole(params.projectId, "qc_inspector",
    `📦 План модулей: ${inserted.length} шт. Подготовьте чеклисты приёмки.`
  );

  await supabase.from("audit_logs").insert({
    action: "MODULE_PLAN_ADDED",
    entity_type: "ModulePlanItem",
    entity_id: params.projectId,
    user_id: params.createdBy,
    new_value: { count: inserted.length },
  });

  return inserted;
}

// ==========================================
// 7. SETUP DEMO PROJECT (full workflow)
// ==========================================
async function setupDemoProject(userId: number) {
  const projectId = 1; // CITY-4

  // Step 1: Add facades
  const facades = await addFacades({
    projectId,
    facades: [
      { name: "Фасад Ф1", areaM2: 2400, floors: "1-25", axes: "А-Г", priority: "HIGH", plannedStart: "2026-01-15", plannedEnd: "2026-06-30" },
      { name: "Фасад Ф2", areaM2: 1800, floors: "1-25", axes: "Д-Ж", priority: "HIGH", plannedStart: "2026-02-01", plannedEnd: "2026-07-15" },
      { name: "Фасад Ф3", areaM2: 2100, floors: "1-20", axes: "З-К", priority: "MEDIUM", plannedStart: "2026-03-01", plannedEnd: "2026-08-30" },
      { name: "Фасад Ф4", areaM2: 1500, floors: "1-15", axes: "Л-Н", priority: "MEDIUM", plannedStart: "2026-04-01", plannedEnd: "2026-09-30" },
    ],
    createdBy: userId,
  });

  // Step 2: Add work types
  await addWorkTypes({
    projectId,
    workTypes: [
      { code: "СМР-001", name: "Монтаж несущих конструкций", unit: "т", phase: "Каркас", priority: "HIGH" },
      { code: "СМР-002", name: "Монтаж фасадных панелей", unit: "м²", phase: "Фасад", priority: "HIGH" },
      { code: "СМР-003", name: "Устройство кровли", unit: "м²", phase: "Кровля", priority: "MEDIUM" },
      { code: "СМР-004", name: "Остекление", unit: "м²", phase: "Фасад", priority: "MEDIUM" },
      { code: "СМР-005", name: "Гидроизоляция", unit: "м²", phase: "Подготовка", priority: "HIGH" },
      { code: "СМР-006", name: "Утепление фасада", unit: "м²", phase: "Фасад", priority: "MEDIUM" },
      { code: "СМР-007", name: "Монтаж водостоков", unit: "п.м", phase: "Инженерия", priority: "LOW" },
      { code: "СМР-008", name: "Электромонтаж", unit: "точка", phase: "Инженерия", priority: "MEDIUM" },
    ],
    createdBy: userId,
  });

  // Step 3: Create task templates (simulated ГПР)
  await createTaskTemplates({
    projectId,
    templates: [
      { code: "SEC-1", name: "Подготовительные работы", sortOrder: 1, isSectionHeader: true, sectionName: "Подготовительные работы" },
      { code: "T-001", name: "Разбивка осей", sortOrder: 2, durationDays: 3, defaultResponsibleRole: "foreman", phase: "Подготовка", defaultStart: "2026-03-01", defaultEnd: "2026-03-03" },
      { code: "T-002", name: "Гидроизоляция фундамента", sortOrder: 3, durationDays: 5, defaultResponsibleRole: "foreman", phase: "Подготовка", priority: "HIGH", defaultStart: "2026-03-04", defaultEnd: "2026-03-08" },
      { code: "SEC-2", name: "Монтаж каркаса", sortOrder: 10, isSectionHeader: true, sectionName: "Монтаж каркаса" },
      { code: "T-003", name: "Монтаж колонн 1-5 этаж", sortOrder: 11, durationDays: 14, defaultResponsibleRole: "foreman", phase: "Каркас", priority: "HIGH", defaultStart: "2026-03-10", defaultEnd: "2026-03-23" },
      { code: "T-004", name: "Монтаж перекрытий 1-5 этаж", sortOrder: 12, durationDays: 10, defaultResponsibleRole: "foreman", phase: "Каркас", priority: "HIGH", defaultStart: "2026-03-24", defaultEnd: "2026-04-02" },
      { code: "T-005", name: "Монтаж колонн 6-10 этаж", sortOrder: 13, durationDays: 14, defaultResponsibleRole: "foreman", phase: "Каркас", defaultStart: "2026-04-03", defaultEnd: "2026-04-16" },
      { code: "SEC-3", name: "Фасадные работы", sortOrder: 20, isSectionHeader: true, sectionName: "Фасадные работы" },
      { code: "T-006", name: "Монтаж фасадных панелей Ф1", sortOrder: 21, durationDays: 20, defaultResponsibleRole: "foreman", phase: "Фасад", priority: "HIGH", unit: "м²", defaultStart: "2026-04-17", defaultEnd: "2026-05-06" },
      { code: "T-007", name: "Утепление фасада Ф1", sortOrder: 22, durationDays: 15, defaultResponsibleRole: "foreman", phase: "Фасад", unit: "м²", defaultStart: "2026-05-07", defaultEnd: "2026-05-21" },
      { code: "T-008", name: "Остекление Ф1", sortOrder: 23, durationDays: 12, defaultResponsibleRole: "foreman", phase: "Фасад", unit: "м²", defaultStart: "2026-05-22", defaultEnd: "2026-06-02" },
      { code: "SEC-4", name: "Инженерные системы", sortOrder: 30, isSectionHeader: true, sectionName: "Инженерные системы" },
      { code: "T-009", name: "Электромонтаж 1-5 этаж", sortOrder: 31, durationDays: 10, defaultResponsibleRole: "engineer", phase: "Инженерия", defaultStart: "2026-04-10", defaultEnd: "2026-04-19" },
      { code: "T-010", name: "Монтаж водостоков", sortOrder: 32, durationDays: 7, defaultResponsibleRole: "foreman", phase: "Инженерия", defaultStart: "2026-06-03", defaultEnd: "2026-06-09" },
      { code: "SEC-5", name: "Контроль качества", sortOrder: 40, isSectionHeader: true, sectionName: "Контроль качества" },
      { code: "T-011", name: "Приёмка каркаса", sortOrder: 41, durationDays: 2, defaultResponsibleRole: "qc_inspector", phase: "Контроль", defaultStart: "2026-04-03", defaultEnd: "2026-04-04" },
      { code: "T-012", name: "Приёмка фасадов", sortOrder: 42, durationDays: 3, defaultResponsibleRole: "qc_inspector", phase: "Контроль", defaultStart: "2026-06-10", defaultEnd: "2026-06-12" },
    ],
    createdBy: userId,
  });

  // Step 4: Generate task instances (assigns to roles)
  const result = await generateTaskInstances({
    projectId,
    createdBy: userId,
  });

  // Step 5: Add module plan
  await addModulePlan({
    projectId,
    modules: [
      { code: "MOD-001", moduleType: "Фасадная панель", quantity: 120, facadeId: facades[0]?.id, floors: "1-25", productionDate: "2026-03-01", shipmentDate: "2026-04-01", mountDate: "2026-04-17" },
      { code: "MOD-002", moduleType: "Фасадная панель", quantity: 90, facadeId: facades[1]?.id, floors: "1-25", productionDate: "2026-03-15", shipmentDate: "2026-04-15", mountDate: "2026-05-01" },
      { code: "MOD-003", moduleType: "Оконный блок", quantity: 200, facadeId: facades[0]?.id, floors: "1-25", productionDate: "2026-04-01", shipmentDate: "2026-05-01", mountDate: "2026-05-22" },
      { code: "MOD-004", moduleType: "Кровельная панель", quantity: 60, floors: "Кровля", productionDate: "2026-05-01", shipmentDate: "2026-06-01", mountDate: "2026-06-15" },
    ],
    createdBy: userId,
  });

  return result;
}

// ==========================================
// Notification helpers
// ==========================================
async function notifyByRole(
  projectId: number,
  roleName: string,
  text: string,
  buttons?: any[][]
) {
  // Find role ID
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("system_name", roleName)
    .maybeSingle();

  if (!role) return;

  // Find users with this role in project
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, users!user_roles_user_id_fkey(telegram_id)")
    .eq("project_id", projectId)
    .eq("role_id", role.id);

  if (!userRoles) return;

  for (const ur of userRoles) {
    const tgId = (ur as any).users?.telegram_id;
    if (tgId) {
      await notify(Number(tgId), text, buttons);
    }
  }
}

async function notifyDepartmentHeads(project: any, createdBy: number, text: string) {
  // Notify all users in the project (or all active users for new project)
  const { data: users } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("status", "ACTIVE");

  if (!users) return;

  for (const u of users) {
    if (u.telegram_id) {
      await notify(Number(u.telegram_id), text);
    }
  }
}

async function notifyAssignedUsers(projectId: number) {
  // Find newly assigned tasks
  const { data: tasks } = await supabase
    .from("task_instances")
    .select("id, status, planned_start, planned_end, task_templates(name), users!task_instances_assignee_id_fkey(telegram_id, first_name)")
    .eq("project_id", projectId)
    .eq("status", "ASSIGNED");

  if (!tasks) return;

  // Group by user
  const byUser: Record<number, any[]> = {};
  for (const t of tasks) {
    const tgId = (t as any).users?.telegram_id;
    if (tgId) {
      if (!byUser[tgId]) byUser[tgId] = [];
      byUser[tgId].push(t);
    }
  }

  for (const [tgId, userTasks] of Object.entries(byUser)) {
    const lines = userTasks.slice(0, 10).map((t: any, i: number) =>
      `${i + 1}. *${t.task_templates?.name || "Задача"}*\n   📅 ${t.planned_start || "—"} → ${t.planned_end || "—"}`
    );

    await notify(
      Number(tgId),
      `📋 *Вам назначены задачи (${userTasks.length}):*\n\n${lines.join("\n\n")}`,
      [[{ text: "✅ Принять все", callback_data: `accept_all:${userTasks.map((t: any) => t.id).join(",")}` }]]
    );
  }
}

// ==========================================
// HTTP handler
// ==========================================
serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "project-workflow" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    let result;
    switch (action) {
      case "create_project":
        result = await createProject(params);
        break;
      case "add_facades":
        result = await addFacades(params);
        break;
      case "add_work_types":
        result = await addWorkTypes(params);
        break;
      case "create_task_templates":
        result = await createTaskTemplates(params);
        break;
      case "generate_task_instances":
        result = await generateTaskInstances(params);
        break;
      case "add_module_plan":
        result = await addModulePlan(params);
        break;
      case "setup_demo":
        result = await setupDemoProject(params.userId);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Workflow error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
