// STSphera — Telegram Bot Webhook (Supabase Edge Function)
// Handles: /start, /help, /app, /tasks, /fact, /defect, callbacks

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { parseCallbackAction } from "./callback-map.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") || "";

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type MiniAppContext = {
  screen?: "dashboard" | "tasks" | "plan-fact" | "modules" | "project";
  taskId?: number;
  facadeId?: number;
  date?: string;
  mode?: string;
  startapp?: string;
};

type RoleMenuItem = {
  text: string;
  callbackData?: string;
  miniAppContext?: MiniAppContext;
};

type RoleActionConfig = {
  message: string;
  context?: MiniAppContext;
  handler?: "tasks" | "fact" | "defect" | "summary";
};

type ResolvedRole = {
  systemName: string;
  displayName: string;
  hasAssignedRole: boolean;
  isAdmin: boolean;
};

const START_PARAM_ALLOWED = /^[a-zA-Z0-9_-]{1,64}$/;
const ROLE_PRIORITY: Record<string, number> = {
  admin: 0,
  ceo: 1,
  direction_director: 2,
  project_director: 3,
  contract_manager: 4,
  design_manager: 5,
  procurement_manager: 6,
  pto_manager: 7,
  site_manager: 8,
  foreman: 9,
  viewer: 100,
};
const ADMIN_ROLE_SYSTEM_NAMES = new Set(["admin", "project_director"]);

// ===========================
// Telegram API helpers
// ===========================
async function sendMessage(
  chatId: number,
  text: string,
  opts?: {
    parse_mode?: string;
    reply_markup?: any;
  }
) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode || "Markdown",
      reply_markup: opts?.reply_markup,
    }),
  });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await fetch(`${TG_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || "",
    }),
  });
}

function getTodayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function buildMiniAppUrl(context?: MiniAppContext): string | null {
  if (!MINI_APP_URL) {
    return null;
  }

  try {
    const url = new URL(MINI_APP_URL);

    if (context?.screen) url.searchParams.set("screen", context.screen);
    if (context?.taskId) url.searchParams.set("task_id", String(context.taskId));
    if (context?.facadeId) url.searchParams.set("facade_id", String(context.facadeId));
    if (context?.date) url.searchParams.set("date", context.date);
    if (context?.mode) url.searchParams.set("mode", context.mode);
    if (context?.startapp) url.searchParams.set("startapp", context.startapp);

    return url.toString();
  } catch (error) {
    console.error("Invalid MINI_APP_URL:", error);
    return null;
  }
}

function createMiniAppButton(text: string, context?: MiniAppContext) {
  const url = buildMiniAppUrl(context);
  if (!url) return null;

  return {
    text,
    web_app: { url },
  };
}

async function sendMiniAppButton(
  chatId: number,
  text: string,
  context?: MiniAppContext,
) {
  const button = createMiniAppButton("📱 Открыть Mini App", context);
  if (!button) {
    await sendMessage(
      chatId,
      `${text}\n\n📱 Приложение временно недоступно. Обратитесь к администратору.`,
    );
    return;
  }

  await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [[button]],
    },
  });
}

function menuCallbackButton(text: string, callbackData: string): RoleMenuItem {
  return { text, callbackData };
}

function menuAppButton(text: string, miniAppContext: MiniAppContext): RoleMenuItem {
  return { text, miniAppContext };
}

function toInlineKeyboardButton(item: RoleMenuItem) {
  if (item.miniAppContext) {
    const appButton = createMiniAppButton(item.text, item.miniAppContext);
    if (appButton) {
      return appButton;
    }
  }

  return {
    text: item.text,
    callback_data: item.callbackData || "open_app",
  };
}

function normalizeRoleSystemName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function rolePriorityIndex(roleSystemName: string): number {
  return ROLE_PRIORITY[roleSystemName] ?? 1000;
}

function normalizeStartParam(rawStartParam?: string): string | null {
  if (!rawStartParam) return null;

  const trimmed = rawStartParam.trim();
  if (!trimmed) return null;

  if (!START_PARAM_ALLOWED.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function roleMenuRows(roleSystemName: string, isAdmin: boolean): RoleMenuItem[][] {
  const rowsByRole: Record<string, RoleMenuItem[][]> = {
    ceo: [
      [
        menuCallbackButton("📊 Портфель", "role:portfolio"),
        menuCallbackButton("⚠️ Риски", "role:risks"),
      ],
      [
        menuCallbackButton("⏳ Просрочки", "role:overdue"),
        menuCallbackButton("💰 Финансы", "role:finance"),
      ],
      [menuCallbackButton("📈 KPI", "role:kpi")],
    ],
    direction_director: [
      [
        menuCallbackButton("📁 Объекты направления", "role:objects"),
        menuCallbackButton("📊 План-факт", "role:plan_fact"),
      ],
      [
        menuCallbackButton("📦 Поставка", "role:supply"),
        menuCallbackButton("👷 Производительность", "role:productivity"),
      ],
      [menuCallbackButton("⚠️ Блокеры", "role:blockers")],
    ],
    project_director: [
      [
        menuCallbackButton("📍 Мой объект", "role:project"),
        menuCallbackButton("🗓 График", "role:schedule"),
      ],
      [
        menuCallbackButton("📋 Задачи", "my_tasks"),
        menuCallbackButton("📦 Поставка", "role:delivery"),
      ],
      [
        menuCallbackButton("📝 Акты", "role:acts"),
        menuCallbackButton("🚨 Проблемы", "role:problems"),
      ],
    ],
    contract_manager: [
      [
        menuCallbackButton("📄 Договоры", "role:contracts"),
        menuCallbackButton("✍️ На подписании", "role:signing"),
      ],
      [
        menuCallbackButton("💰 Этапы оплат", "role:payments"),
        menuCallbackButton("⚠️ Просрочка контракта", "role:contract_overdue"),
      ],
    ],
    design_manager: [
      [
        menuCallbackButton("📐 Проекты", "role:designs"),
        menuCallbackButton("🔄 На согласовании", "role:on_review"),
      ],
      [
        menuCallbackButton("🧾 Замечания", "role:remarks"),
        menuCallbackButton("📤 Выдано в работу", "role:issue_work"),
      ],
    ],
    procurement_manager: [
      [
        menuCallbackButton("📦 Закупки", "role:procurements"),
        menuCallbackButton("🚚 В пути", "role:transit"),
      ],
      [
        menuCallbackButton("🏗 Дефицит", "role:deficit"),
        menuCallbackButton("💰 Согласование счета", "role:invoice"),
      ],
    ],
    foreman: [
      [
        menuCallbackButton("📅 План на завтра", "role:plan_tomorrow"),
        menuCallbackButton("📊 Факт за сегодня", "enter_fact"),
      ],
      [
        menuCallbackButton("👷 Люди", "role:workforce"),
        menuCallbackButton("📸 Фото", "role:photo"),
      ],
      [
        menuCallbackButton("⚠️ Проблема", "report_defect"),
        menuCallbackButton("📋 Мои задачи", "my_tasks"),
      ],
    ],
    site_manager: [
      [
        menuCallbackButton("👥 Бригады", "role:brigades"),
        menuCallbackButton("📊 Сводка выработки", "role:output"),
      ],
      [
        menuCallbackButton("⚠️ Отклонения", "role:deviations"),
        menuCallbackButton("🧭 Перераспределение", "role:reallocate"),
      ],
      [menuCallbackButton("📋 Задачи участка", "my_tasks")],
    ],
    pto_manager: [
      [
        menuCallbackButton("📑 Акты", "role:pto_acts"),
        menuCallbackButton("📊 Закрытие объемов", "role:pto_close"),
      ],
      [
        menuCallbackButton("🗂 Документы", "role:pto_docs"),
        menuCallbackButton("⚠️ Несоответствия", "role:pto_mismatch"),
      ],
    ],
  };

  const defaultRows: RoleMenuItem[][] = [
    [
      menuCallbackButton("📋 Мои задачи", "my_tasks"),
      menuCallbackButton("📝 Ввести факт", "enter_fact"),
    ],
    [
      menuCallbackButton("🔴 Дефект", "report_defect"),
      menuCallbackButton("📊 Сводка", "summary"),
    ],
    [
      menuAppButton("📱 Приложение", {
        screen: "dashboard",
        startapp: "dashboard",
      }),
    ],
  ];

  const rows = rowsByRole[roleSystemName]
    ? rowsByRole[roleSystemName].map((row) => [...row])
    : defaultRows.map((row) => [...row]);

  if (!rows.flat().some((item) => item.miniAppContext)) {
    rows.push([
      menuAppButton("📱 Приложение", {
        screen: "dashboard",
        startapp: "dashboard",
      }),
    ]);
  }

  if (isAdmin) {
    rows.push([menuCallbackButton("🏗 Настроить демо-объект", "setup_demo")]);
  }

  return rows;
}

const ROLE_ACTION_MAP: Record<string, RoleActionConfig> = {
  portfolio: {
    message: "📊 Портфель проектов:",
    context: { screen: "dashboard", mode: "portfolio" },
    handler: "summary",
  },
  risks: {
    message: "⚠️ Риски и блокеры:",
    context: { screen: "tasks", mode: "risks" },
  },
  overdue: {
    message: "⏳ Просроченные задачи:",
    context: { screen: "tasks", mode: "overdue" },
    handler: "summary",
  },
  finance: {
    message: "💰 Финансовая сводка:",
    context: { screen: "dashboard", mode: "finance" },
  },
  kpi: {
    message: "📈 KPI направлений:",
    context: { screen: "dashboard", mode: "kpi" },
  },
  objects: {
    message: "📁 Объекты направления:",
    context: { screen: "project", mode: "objects" },
  },
  plan_fact: {
    message: "📊 План-факт по объемам:",
    context: { screen: "plan-fact", mode: "plan_fact" },
  },
  supply: {
    message: "📦 Статус поставок:",
    context: { screen: "modules", mode: "supply" },
  },
  productivity: {
    message: "👷 Производительность бригад:",
    context: { screen: "plan-fact", mode: "productivity" },
  },
  blockers: {
    message: "⚠️ Активные блокеры:",
    context: { screen: "tasks", mode: "blockers" },
  },
  project: {
    message: "📍 Карточка объекта:",
    context: { screen: "project", mode: "project_card" },
  },
  schedule: {
    message: "🗓 График и зависимости:",
    context: { screen: "tasks", mode: "schedule" },
  },
  delivery: {
    message: "📦 Поставка по объекту:",
    context: { screen: "modules", mode: "delivery" },
  },
  acts: {
    message: "📝 Акты и закрытие этапов:",
    context: { screen: "project", mode: "acts" },
  },
  problems: {
    message: "🚨 Проблемы и дефекты:",
    context: { screen: "tasks", mode: "problems" },
    handler: "defect",
  },
  contracts: {
    message: "📄 Карточки договоров:",
    context: { screen: "project", mode: "contracts" },
  },
  signing: {
    message: "✍️ Документы на подписании:",
    context: { screen: "project", mode: "contract_signing" },
  },
  payments: {
    message: "💰 Этапы оплат:",
    context: { screen: "dashboard", mode: "payments" },
  },
  contract_overdue: {
    message: "⚠️ Просрочка согласования контрактов:",
    context: { screen: "project", mode: "contract_overdue" },
  },
  designs: {
    message: "📐 Проектная документация:",
    context: { screen: "project", mode: "designs" },
  },
  on_review: {
    message: "🔄 Документы на согласовании:",
    context: { screen: "project", mode: "on_review" },
  },
  remarks: {
    message: "🧾 Замечания и комментарии:",
    context: { screen: "project", mode: "remarks" },
  },
  issue_work: {
    message: "📤 Выдача в работу:",
    context: { screen: "tasks", mode: "issue_work" },
  },
  procurements: {
    message: "📦 Закупки:",
    context: { screen: "modules", mode: "procurements" },
  },
  transit: {
    message: "🚚 Поставки в пути:",
    context: { screen: "modules", mode: "in_transit" },
  },
  deficit: {
    message: "🏗 Дефицит материалов:",
    context: { screen: "modules", mode: "deficit" },
  },
  invoice: {
    message: "💰 Счета на согласовании:",
    context: { screen: "dashboard", mode: "invoice" },
  },
  plan_tomorrow: {
    message: "📅 План на завтра:",
    context: { screen: "plan-fact", mode: "plan_tomorrow" },
  },
  workforce: {
    message: "👷 Загрузка людей:",
    context: { screen: "tasks", mode: "workforce" },
  },
  photo: {
    message: "📸 Фотофиксация:",
    context: { screen: "project", mode: "photo" },
  },
  brigades: {
    message: "👥 Бригады и участки:",
    context: { screen: "tasks", mode: "brigades" },
  },
  output: {
    message: "📊 Сводка по выработке:",
    context: { screen: "plan-fact", mode: "output" },
  },
  deviations: {
    message: "⚠️ Отклонения план-факт:",
    context: { screen: "plan-fact", mode: "deviations" },
  },
  reallocate: {
    message: "🧭 Перераспределение ресурсов:",
    context: { screen: "tasks", mode: "reallocate" },
  },
  pto_acts: {
    message: "📑 Акты и согласование:",
    context: { screen: "project", mode: "pto_acts" },
  },
  pto_close: {
    message: "📊 Закрытие объемов:",
    context: { screen: "plan-fact", mode: "pto_close" },
  },
  pto_docs: {
    message: "🗂 Исполнительная документация:",
    context: { screen: "project", mode: "pto_docs" },
  },
  pto_mismatch: {
    message: "⚠️ Несоответствия и возвраты:",
    context: { screen: "tasks", mode: "pto_mismatch" },
  },
};

// ===========================
// Get or create user
// ===========================
async function getUser(telegramId: number) {
  const { data } = await supabase
    .from("users")
    .select("*, user_roles!user_roles_user_id_fkey(*, roles(*))")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  return data;
}

async function createUser(from: any) {
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      telegram_id: from.id,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
      username: from.username || null,
      status: "PENDING",
    })
    .select()
    .single();

  if (error) {
    console.error("Create user error:", error);
    return null;
  }

  // AuditLog
  await supabase.from("audit_logs").insert({
    action: "USER_REGISTERED",
    entity_type: "User",
    entity_id: newUser.id,
    user_id: newUser.id,
    new_value: {
      telegram_id: from.id,
      first_name: from.first_name,
      username: from.username,
    },
  });

  return newUser;
}

function resolveUserRole(user: any): ResolvedRole {
  const userRoles = Array.isArray(user?.user_roles) ? user.user_roles : [];
  const availableRoles = userRoles
    .map((userRole: any) => {
      const role = userRole?.roles;
      const systemName = normalizeRoleSystemName(role?.system_name);
      if (!systemName) return null;

      return {
        systemName,
        displayName: role?.display_name || "Пользователь",
      };
    })
    .filter(
      (value): value is { systemName: string; displayName: string } =>
        value !== null,
    );

  if (availableRoles.length === 0) {
    return {
      systemName: "viewer",
      displayName: "Пользователь",
      hasAssignedRole: false,
      isAdmin: false,
    };
  }

  availableRoles.sort(
    (left, right) =>
      rolePriorityIndex(left.systemName) - rolePriorityIndex(right.systemName),
  );

  return {
    systemName: availableRoles[0].systemName,
    displayName: availableRoles[0].displayName,
    hasAssignedRole: true,
    isAdmin: availableRoles.some((role) =>
      ADMIN_ROLE_SYSTEM_NAMES.has(role.systemName)
    ),
  };
}

async function sendMainMenu(chatId: number, user: any) {
  const resolvedRole = resolveUserRole(user);
  const buttons = roleMenuRows(resolvedRole.systemName, resolvedRole.isAdmin)
    .map((row) => row.map((item) => toInlineKeyboardButton(item)));
  const hint = resolvedRole.hasAssignedRole
    ? "Выберите действие:"
    : "⚠️ Роль не назначена или не распознана. Доступно базовое меню.";

  await sendMessage(
    chatId,
    `🏗 *STSphera — ${resolvedRole.displayName}*\n📁 Проект: СИТИ-4\n\n${hint}`,
    {
      reply_markup: { inline_keyboard: buttons },
    },
  );
}

// ===========================
// Command handlers
// ===========================
function parseStartContext(rawStartParam?: string): MiniAppContext | null {
  const startParam = normalizeStartParam(rawStartParam);
  if (!startParam) return null;

  const taskMatch = startParam.match(/^task_(\d+)$/);
  if (taskMatch) {
    return {
      screen: "tasks",
      taskId: Number(taskMatch[1]),
      startapp: startParam,
    };
  }

  const planFactMatch = startParam.match(/^plan_fact_(\d{4}-\d{2}-\d{2})$/);
  if (planFactMatch) {
    return {
      screen: "plan-fact",
      date: planFactMatch[1],
      startapp: startParam,
    };
  }

  const defectMatch = startParam.match(/^defect_facade_(\d+)$/);
  if (defectMatch) {
    return {
      screen: "tasks",
      facadeId: Number(defectMatch[1]),
      mode: "defect",
      startapp: startParam,
    };
  }

  if (startParam === "modules") return { screen: "modules", startapp: startParam };
  if (startParam === "project") return { screen: "project", startapp: startParam };
  if (startParam === "tasks") return { screen: "tasks", startapp: startParam };
  if (startParam === "plan_fact") {
    return { screen: "plan-fact", date: getTodayIsoDate(), startapp: startParam };
  }

  return { screen: "dashboard", startapp: startParam };
}

async function handleStart(chatId: number, from: any, startParam?: string) {
  const normalizedStartParam = normalizeStartParam(startParam);
  if (startParam && !normalizedStartParam) {
    console.warn("Invalid /start parameter ignored:", startParam);
  }

  const user = await getUser(from.id);

  if (!user) {
    const newUser = await createUser(from);
    if (!newUser) {
      await sendMessage(chatId, "Ошибка регистрации. Попробуйте позже.");
      return;
    }

    await sendMessage(
      chatId,
      `Добро пожаловать в STSphera, ${from.first_name}! 🏗\n\nВаша заявка на рассмотрении. Администратор назначит вам роль.`
    );

    // Notify admins
    await notifyAdmins(newUser);
    return;
  }

  const userStatus = String(user.status || "").toUpperCase();

  if (userStatus === "PENDING") {
    await sendMessage(chatId, "Ваша заявка на рассмотрении. Ожидайте назначения роли. ⏳");
    return;
  }

  if (userStatus === "BLOCKED") {
    await sendMessage(chatId, "Ваш аккаунт заблокирован. Обратитесь к администратору. 🚫");
    return;
  }

  if (userStatus !== "ACTIVE") {
    await sendMessage(
      chatId,
      "Не удалось определить статус пользователя. Используйте /start позже или обратитесь к администратору.",
    );
    return;
  }

  await sendMainMenu(chatId, user);

  const startContext = parseStartContext(normalizedStartParam || undefined);
  if (startContext) {
    await sendMiniAppButton(
      chatId,
      "Откройте Mini App с переданным контекстом:",
      startContext,
    );
  }
}

async function handleHelp(chatId: number) {
  await sendMessage(
    chatId,
    "📋 *Команды STSphera Bot:*\n\n" +
      "/start — Главное меню\n" +
      "/app — Открыть Mini App\n" +
      "/tasks — Мои задачи\n" +
      "/fact — Ввод факта\n" +
      "/defect — Фиксация дефекта\n" +
      "/help — Список команд"
  );
}

async function handleApp(chatId: number, from: any, context?: MiniAppContext) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  await sendMiniAppButton(chatId, "📱 Откройте Mini App STSphera:", context || { screen: "dashboard" });
}

async function handleTasks(chatId: number, from: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const { data: tasks } = await supabase
    .from("task_instances")
    .select("id, status, planned_end, priority, completion_pct, task_templates(name)")
    .eq("assignee_id", user.id)
    .in("status", ["ASSIGNED", "IN_PROGRESS"])
    .order("planned_end", { ascending: true })
    .limit(10);

  if (!tasks || tasks.length === 0) {
    await sendMessage(chatId, "📋 У вас нет активных задач. ✅");
    return;
  }

  const icons: Record<string, string> = { ASSIGNED: "🔵", IN_PROGRESS: "🟢" };
  const lines = tasks.map((t: any, i: number) => {
    const name = t.task_templates?.name || `Задача #${t.id}`;
    return `${icons[t.status] || "⚪"} ${i + 1}. *${name}*\n   Срок: ${t.planned_end || "—"} | ${Number(t.completion_pct || 0).toFixed(0)}%`;
  });

  await sendMessage(chatId, `📋 *Ваши задачи (${tasks.length}):*\n\n${lines.join("\n\n")}`);
  await sendMiniAppButton(chatId, "Для полного просмотра откройте задачи в Mini App:", {
    screen: "tasks",
  });
}

async function handleFact(chatId: number, from: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const { data: tasks } = await supabase
    .from("task_instances")
    .select("id, task_templates(name)")
    .eq("assignee_id", user.id)
    .eq("status", "IN_PROGRESS")
    .limit(10);

  if (!tasks || tasks.length === 0) {
    await sendMessage(chatId, "📝 Нет активных задач для ввода факта.");
    await sendMiniAppButton(chatId, "Откройте Plan/Fact в Mini App:", {
      screen: "plan-fact",
      date: getTodayIsoDate(),
      startapp: "plan_fact",
    });
    return;
  }

  const buttons = tasks.map((t: any) => [{
    text: (t.task_templates?.name || `Задача #${t.id}`).substring(0, 40),
    callback_data: `fact_select:${t.id}`,
  }]);

  await sendMessage(chatId, "Выберите задачу для ввода факта:", {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleDefect(chatId: number, from: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("project_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!userRole) {
    await sendMessage(chatId, "Вам не назначен проект.");
    return;
  }

  const { data: facades } = await supabase
    .from("facades")
    .select("id, name")
    .eq("project_id", userRole.project_id)
    .order("name");

  if (!facades || facades.length === 0) {
    await sendMessage(chatId, "🔴 В проекте нет фасадов. Добавьте через импорт.");
    await sendMiniAppButton(chatId, "Откройте Mini App для настройки проекта:", {
      screen: "project",
      startapp: "project",
    });
    return;
  }

  const buttons = facades.map((f: any) => [{
    text: f.name,
    callback_data: `defect_facade:${f.id}`,
  }]);

  await sendMessage(chatId, "🔴 Фиксация дефекта. Выберите фасад/зону:", {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function sendProjectSummary(chatId: number) {
  const { count: taskCount } = await supabase
    .from("task_instances")
    .select("id", { count: "exact", head: true });
  const { count: overdueCount } = await supabase
    .from("task_instances")
    .select("id", { count: "exact", head: true })
    .in("status", ["ASSIGNED", "IN_PROGRESS"])
    .lt("planned_end", getTodayIsoDate());
  const { count: blockedCount } = await supabase
    .from("task_instances")
    .select("id", { count: "exact", head: true })
    .eq("status", "BLOCKED");
  const { count: facadeCount } = await supabase
    .from("facades")
    .select("id", { count: "exact", head: true });
  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE");

  await sendMessage(
    chatId,
    `📊 *Сводка STSphera:*\n\n` +
      `🏗 Активных объектов: ${projectCount || 0}\n` +
      `📋 Всего задач: ${taskCount || 0}\n` +
      `⏳ Просрочено: ${overdueCount || 0}\n` +
      `⚠️ Блокировано: ${blockedCount || 0}\n` +
      `🏢 Фасадов: ${facadeCount || 0}\n` +
      `✅ БД: 24 таблицы`,
  );
}

function withRoleStartapp(context: MiniAppContext, action: string): MiniAppContext {
  return {
    ...context,
    startapp: context.startapp || `role_${action}`,
  };
}

async function handleRoleAction(chatId: number, from: any, action: string) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const config = ROLE_ACTION_MAP[action];
  if (!config) {
    await sendMessage(chatId, "Действие не найдено. Используйте /start.");
    return;
  }

  if (config.handler === "tasks") {
    await handleTasks(chatId, from);
  } else if (config.handler === "fact") {
    await handleFact(chatId, from);
  } else if (config.handler === "defect") {
    await handleDefect(chatId, from);
  } else if (config.handler === "summary") {
    await sendProjectSummary(chatId);
  }

  if (config.context) {
    await sendMiniAppButton(
      chatId,
      config.message,
      withRoleStartapp(config.context, action),
    );
  } else if (!config.handler) {
    await sendMessage(chatId, config.message);
  }
}

// ===========================
// Callback handlers
// ===========================
async function handleCallback(callbackQuery: any) {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;
  const from = callbackQuery.from;

  await answerCallback(callbackQuery.id);

  if (!chatId || !data) return;
  const parsedAction = parseCallbackAction(data);

  switch (parsedAction.type) {
    case "my_tasks":
      await handleTasks(chatId, from);
      break;
    case "enter_fact":
      await handleFact(chatId, from);
      break;
    case "report_defect":
      await handleDefect(chatId, from);
      break;
    case "open_app":
      await handleApp(chatId, from, { screen: "dashboard" });
      break;
    case "role_action":
      await handleRoleAction(chatId, from, parsedAction.action);
      break;
    case "fact_select":
      await sendMiniAppButton(
        chatId,
        `📝 Переход к вводу факта по задаче #${parsedAction.taskId}:`,
        {
          screen: "plan-fact",
          taskId: parsedAction.taskId,
          date: getTodayIsoDate(),
          startapp: `task_${parsedAction.taskId}`,
        },
      );
      break;
    case "defect_facade":
      await sendMiniAppButton(
        chatId,
        `🔴 Переход к фиксации дефекта по фасаду #${parsedAction.facadeId}:`,
        {
          screen: "tasks",
          facadeId: parsedAction.facadeId,
          mode: "defect",
          startapp: `defect_facade_${parsedAction.facadeId}`,
        },
      );
      break;
    case "summary": {
      await sendProjectSummary(chatId);
      await sendMiniAppButton(chatId, "Откройте Mini App для детальной аналитики:", {
        screen: "dashboard",
      });
      break;
    }
    case "accept_task": {
      const user = await getUser(from.id);
      if (!user) return;

      await supabase
        .from("task_instances")
        .update({
          status: "IN_PROGRESS",
          actual_start: new Date().toISOString().split("T")[0],
        })
        .eq("id", parsedAction.taskId);

      await supabase.from("audit_logs").insert({
        action: "TASK_STATUS_CHANGED",
        entity_type: "TaskInstance",
        entity_id: parsedAction.taskId,
        user_id: user.id,
        old_value: { status: "ASSIGNED" },
        new_value: { status: "IN_PROGRESS" },
      });

      await sendMessage(chatId, "✅ Задача принята в работу!");
      break;
    }
    case "accept_all": {
      const user = await getUser(from.id);
      if (!user) return;

      for (const taskId of parsedAction.taskIds) {
        await supabase
          .from("task_instances")
          .update({
            status: "IN_PROGRESS",
            actual_start: new Date().toISOString().split("T")[0],
          })
          .eq("id", taskId)
          .eq("assignee_id", user.id);
      }

      await supabase.from("audit_logs").insert({
        action: "TASKS_ACCEPTED_BULK",
        entity_type: "TaskInstance",
        user_id: user.id,
        new_value: {
          task_ids: parsedAction.taskIds,
          count: parsedAction.taskIds.length,
        },
      });

      await sendMessage(
        chatId,
        `✅ Принято задач: ${parsedAction.taskIds.length}. Все в работе!`,
      );
      break;
    }
    case "setup_demo": {
      await sendMessage(
        chatId,
        "⏳ Настраиваю демо-объект СИТИ-4...\nФасады, задачи, модули...",
      );

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/project-workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ action: "setup_demo", userId: from.id }),
      });

      const result = await resp.json();

      if (result.data) {
        await sendMessage(
          chatId,
          `✅ *Демо-объект СИТИ-4 настроен!*\n\n` +
            `🏢 Фасады: 4\n` +
            `🔧 Типы работ: 8\n` +
            `📋 Задач создано: ${result.data.generated || 0}\n` +
            `👤 Назначено: ${result.data.assigned || 0}\n` +
            `📦 Модулей: 4\n\n` +
            `Все отделы уведомлены.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📋 Мои задачи", callback_data: "my_tasks" },
                  { text: "📊 Сводка", callback_data: "summary" },
                ],
              ],
            },
          },
        );
      } else {
        await sendMessage(
          chatId,
          "❌ Ошибка настройки: " + (result.error || "неизвестная"),
        );
      }
      break;
    }
    case "view_tasks":
    case "create_tasks":
      await sendMiniAppButton(chatId, "📋 Откройте задачи в Mini App:", {
        screen: "tasks",
        startapp: "tasks",
      });
      break;
    case "view_modules":
      await sendMiniAppButton(chatId, "📦 Откройте модули в Mini App:", {
        screen: "modules",
        startapp: "modules",
      });
      break;
    case "unknown":
      await sendMessage(chatId, "Неизвестное действие. Используйте /start.");
      break;
  }
}

// ===========================
// Notify admins
// ===========================
async function notifyAdmins(newUser: any) {
  const { data: adminRoleRows, error: adminRoleError } = await supabase
    .from("roles")
    .select("id")
    .in("system_name", Array.from(ADMIN_ROLE_SYSTEM_NAMES));

  if (adminRoleError) {
    console.error("Failed to resolve admin roles:", adminRoleError);
    return;
  }

  const roleIds = (adminRoleRows || [])
    .map((role: any) => Number(role.id))
    .filter((roleId: number) => Number.isInteger(roleId) && roleId > 0);

  if (roleIds.length === 0) return;

  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id, users!user_roles_user_id_fkey(telegram_id)")
    .in("role_id", roleIds);

  if (!adminRoles) return;

  const adminTelegramIds = new Set<number>();
  for (const ar of adminRoles) {
    const tgId = Number((ar as any).users?.telegram_id);
    if (!Number.isInteger(tgId) || tgId <= 0) continue;
    adminTelegramIds.add(tgId);
  }

  for (const tgId of adminTelegramIds) {
    try {
      await sendMessage(
        tgId,
        `👤 *Новый пользователь:*\n` +
          `Имя: ${newUser.first_name || ""} ${newUser.last_name || ""}\n` +
          `Username: @${newUser.username || "—"}\n` +
          `TG ID: \`${newUser.telegram_id}\`\n\n` +
          `Требуется назначение роли.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 Назначить роль", callback_data: `assign_role:${newUser.id}` }],
            ],
          },
        },
      );
    } catch (error) {
      console.error(`Failed to notify admin ${tgId}:`, error);
    }
  }
}

// ===========================
// Main handler
// ===========================
serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("STSphera Bot Webhook OK", { status: 200 });
  }

  try {
    const update = await req.json();

    // Handle commands
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const from = update.message.from;
      const [command, startArg] = text.trim().split(/\s+/, 2);

      if (command === "/start") {
        await handleStart(chatId, from, startArg);
      } else if (command === "/help") {
        await handleHelp(chatId);
      } else if (command === "/app") {
        const context = parseStartContext(startArg);
        await handleApp(chatId, from, context || { screen: "dashboard" });
      } else if (command === "/tasks") {
        await handleTasks(chatId, from);
      } else if (command === "/fact") {
        await handleFact(chatId, from);
      } else if (command === "/defect") {
        await handleDefect(chatId, from);
      }
    }

    // Handle callbacks
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 200 }); // Return 200 so Telegram doesn't retry
  }
});
