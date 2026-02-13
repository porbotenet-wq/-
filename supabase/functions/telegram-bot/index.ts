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
// Wizard state (text-input steps)
// ===========================
interface WizardState { step: string; data: Record<string, any>; messageId: number; expiresAt: number; }
const wizardState = new Map<number, WizardState>();
function setWizard(chatId: number, step: string, messageId: number, data: Record<string, any> = {}) {
  wizardState.set(chatId, { step, data, messageId, expiresAt: Date.now() + 5 * 60_000 });
}
function getWizard(chatId: number): WizardState | null {
  const s = wizardState.get(chatId);
  if (!s) return null;
  if (s.expiresAt < Date.now()) { wizardState.delete(chatId); return null; }
  return s;
}
function clearWizard(chatId: number) { wizardState.delete(chatId); }

// ===========================
// Telegram API helpers
// ===========================
async function tgCall(method: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMessage(chatId: number, text: string, opts?: { parse_mode?: string; reply_markup?: any }): Promise<number> {
  const res = await tgCall("sendMessage", { chat_id: chatId, text, parse_mode: opts?.parse_mode || "Markdown", reply_markup: opts?.reply_markup });
  return res?.result?.message_id || 0;
}

async function editMessage(chatId: number, messageId: number, text: string, opts?: { parse_mode?: string; reply_markup?: any }) {
  await tgCall("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: opts?.parse_mode || "Markdown", reply_markup: opts?.reply_markup });
}

async function deleteMessage(chatId: number, messageId: number) {
  await tgCall("deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await tgCall("answerCallbackQuery", { callback_query_id: callbackQueryId, text: text || "" });
}

/** Send new OR edit existing. All screen renderers use this. */
async function render(chatId: number, msgId: number | null, text: string, keyboard?: any[][]): Promise<number> {
  const markup = keyboard && keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;
  if (msgId) { await editMessage(chatId, msgId, text, { reply_markup: markup }); return msgId; }
  return await sendMessage(chatId, text, { reply_markup: markup });
}

async function renderDone(chatId: number, msgId: number | null, text: string) {
  if (msgId) { await editMessage(chatId, msgId, text); } else { await sendMessage(chatId, text); }
}

function getTodayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function getTodayHumanDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
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

function relationItem(value: any): any {
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value || null;
}

function getTaskTemplate(task: any): any {
  return relationItem(task?.task_templates);
}

function getTaskFacade(task: any): any {
  return relationItem(task?.facades);
}

function getTaskName(task: any): string {
  const template = getTaskTemplate(task);
  return template?.name || `Задача #${task?.id || "—"}`;
}

function buildAcceptAllCallback(taskIds: number[]): string | null {
  const uniqueIds = Array.from(
    new Set(taskIds.filter((id) => Number.isInteger(id) && id > 0)),
  );
  if (uniqueIds.length < 2) return null;

  const acceptedIds: number[] = [];
  for (const id of uniqueIds) {
    const candidate = [...acceptedIds, id];
    const callbackData = `accept_all:${candidate.join(",")}`;
    if (callbackData.length > 64) break;
    acceptedIds.push(id);
  }

  if (acceptedIds.length < 2) return null;
  return `accept_all:${acceptedIds.join(",")}`;
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

async function sendMainMenu(chatId: number, user: any, msgId: number | null = null) {
  const resolvedRole = resolveUserRole(user);
  const buttons = roleMenuRows(resolvedRole.systemName, resolvedRole.isAdmin)
    .map((row) => row.map((item) => toInlineKeyboardButton(item)));
  const hint = resolvedRole.hasAssignedRole
    ? "Выберите действие из главного меню:"
    : "⚠️ Роль не назначена или не распознана. Доступно базовое меню.";
  const miniAppHint = MINI_APP_URL
    ? "📱 Mini App доступен по кнопкам меню."
    : "📱 Mini App сейчас недоступен, обратитесь к администратору.";
  const roleLine = resolvedRole.hasAssignedRole
    ? `👤 Роль: ${resolvedRole.displayName}`
    : "👤 Роль: не назначена";

  await render(chatId, msgId,
    `🏠 *Главный экран STSphera*\n${roleLine}\n📁 Проект: СИТИ-4\n📅 Дата: ${getTodayHumanDate()}\n\n${hint}\n${miniAppHint}`,
    buttons,
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
      `👋 Добро пожаловать в STSphera, ${from.first_name || "коллега"}!\n\n` +
        `✅ Ваша заявка зарегистрирована.\n` +
        `⏳ Сейчас статус: *PENDING*.\n` +
        `👤 Администратор назначит вам роль и доступ.\n\n` +
        `После назначения роли снова отправьте /start.`
    );

    // Notify admins
    await notifyAdmins(newUser);
    return;
  }

  const userStatus = String(user.status || "").toUpperCase();

  if (userStatus === "PENDING") {
    await sendMessage(
      chatId,
      `⏳ *Заявка в обработке*\n\n` +
        `Роль пока не назначена.\n` +
        `Как только администратор выдаст доступ, отправьте /start и откроется рабочее меню.`,
    );
    return;
  }

  if (userStatus === "BLOCKED") {
    await sendMessage(
      chatId,
      `🚫 *Доступ ограничен*\n\n` +
        `Ваш аккаунт заблокирован.\n` +
        `Для разблокировки обратитесь к администратору проекта.`,
    );
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
    const contextCode = startContext.startapp || "context";
    await sendMiniAppButton(
      chatId,
      `🎯 Контекст запуска: \`${contextCode}\`\nОткройте Mini App по кнопке ниже:`,
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

// ===========================
// Screen 2: /tasks — full task list
// ===========================
const STATUS_ICON: Record<string, string> = {
  CREATED: "⚪",
  ASSIGNED: "🔵",
  IN_PROGRESS: "🟢",
  DONE: "✅",
  VERIFIED: "✔️",
  BLOCKED: "🔴",
  CANCELLED: "⛔",
};
const STATUS_LABEL: Record<string, string> = {
  CREATED: "Создана",
  ASSIGNED: "Назначена",
  IN_PROGRESS: "В работе",
  DONE: "Выполнена",
  VERIFIED: "Принята",
  BLOCKED: "Блокирована",
  CANCELLED: "Отменена",
};
const PRIORITY_ICON: Record<string, string> = {
  HIGH: "🔴",
  MEDIUM: "🟡",
  LOW: "🟢",
};

type TaskFilter = "all" | "assigned" | "progress" | "overdue" | "done";

async function handleTasks(chatId: number, from: any, filter: TaskFilter = "all", msgId: number | null = null) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const today = getTodayIsoDate();

  // ---- Counts for header ----
  const [
    { count: assignedCount },
    { count: progressCount },
    { count: overdueCount },
    { count: doneCount },
  ] = await Promise.all([
    supabase.from("task_instances").select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id).eq("status", "ASSIGNED"),
    supabase.from("task_instances").select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id).eq("status", "IN_PROGRESS"),
    supabase.from("task_instances").select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id).in("status", ["ASSIGNED", "IN_PROGRESS"]).lt("planned_end", today),
    supabase.from("task_instances").select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id).in("status", ["DONE", "VERIFIED"]),
  ]);

  const ac = assignedCount || 0;
  const pc = progressCount || 0;
  const oc = overdueCount || 0;
  const dc = doneCount || 0;
  const totalActive = ac + pc;

  // ---- Build status header ----
  const headerLines = [
    `📋 *Экран задач — ${getTodayHumanDate()}*`,
    ``,
    `🔵 Назначено: ${ac}  🟢 В работе: ${pc}`,
  ];
  if (oc > 0) headerLines.push(`🔴 Просрочено: ${oc}`);
  headerLines.push(`✅ Завершено: ${dc}`);

  // ---- Filter row ----
  const filterLabels: Record<TaskFilter, string> = {
    all: "Все активные",
    assigned: `Назначенные (${ac})`,
    progress: `В работе (${pc})`,
    overdue: `Просроченные (${oc})`,
    done: `Завершённые (${dc})`,
  };
  const activeFilter = filter;

  // ---- Fetch task list ----
  let query = supabase
    .from("task_instances")
    .select("id, status, planned_start, planned_end, priority, completion_pct, type, notes, facade_id, task_templates(name, code, phase, unit), facades(name)")
    .eq("assignee_id", user.id)
    .order("priority", { ascending: true })
    .order("planned_end", { ascending: true })
    .limit(15);

  if (activeFilter === "assigned") {
    query = query.eq("status", "ASSIGNED");
  } else if (activeFilter === "progress") {
    query = query.eq("status", "IN_PROGRESS");
  } else if (activeFilter === "overdue") {
    query = query.in("status", ["ASSIGNED", "IN_PROGRESS"]).lt("planned_end", today);
  } else if (activeFilter === "done") {
    query = query.in("status", ["DONE", "VERIFIED"]);
  } else {
    query = query.in("status", ["ASSIGNED", "IN_PROGRESS"]);
  }

  const { data: tasks } = await query;

  // ---- Compose message body ----
  if (!tasks || tasks.length === 0) {
    const emptyHint: Record<TaskFilter, string> = {
      all: "Нет активных задач. Хорошая работа!",
      assigned: "Нет назначенных задач.",
      progress: "Нет задач в работе.",
      overdue: "Просроченных задач нет — отлично!",
      done: "Завершённых задач пока нет.",
    };
    await render(chatId, msgId,
      headerLines.join("\n") + `\n\n📎 Фильтр: *${filterLabels[activeFilter]}*\n\n${emptyHint[activeFilter]}`,
      buildTaskFilterButtons(activeFilter, ac, pc, oc),
    );
    return;
  }

  const taskLines = tasks.map((t: any, i: number) => {
    const template = getTaskTemplate(t);
    const facadeRow = getTaskFacade(t);
    const name = template?.name || `Задача #${t.id}`;
    const code = template?.code ? `\`${template.code}\` ` : "";
    const icon = STATUS_ICON[t.status] || "⚪";
    const pi = PRIORITY_ICON[t.priority] || "";
    const pct = Number(t.completion_pct || 0).toFixed(0);
    const facade = facadeRow?.name ? ` | ${facadeRow.name}` : "";
    const isOverdue = t.planned_end && t.planned_end < today && !["DONE", "VERIFIED", "CANCELLED"].includes(t.status);
    const deadlineStr = t.planned_end || "—";
    const overdueTag = isOverdue ? " ⚠️" : "";
    const isDefect = t.type === "DEFECT";

    return `${icon} *${i + 1}. ${isDefect ? "🔴 " : ""}${name}*\n   ${code}${pi} Срок: ${deadlineStr}${overdueTag} | ${pct}%${facade}`;
  });

  const bodyText = headerLines.join("\n") +
    `\n\n📎 Фильтр: *${filterLabels[activeFilter]}* (${tasks.length})\n\n` +
    taskLines.join("\n\n");

  // ---- Per-task action buttons ----
  const taskButtons: any[][] = [];
  for (const t of tasks.slice(0, 8)) {
    const shortName = (getTaskName(t) || `#${t.id}`).substring(0, 25);
    const row: any[] = [];

    row.push({ text: `🔎 ${shortName}`, callback_data: `task_detail:${t.id}` });

    if (t.status === "ASSIGNED") {
      row.push({ text: "▶ Принять", callback_data: `accept:task:${t.id}` });
    } else if (t.status === "IN_PROGRESS") {
      row.push({ text: "✅ Готово", callback_data: `task_done:${t.id}` });
    }

    taskButtons.push(row);
  }

  // Accept-all shortcut
  const assignedTasks = tasks.filter((t: any) => t.status === "ASSIGNED");
  const acceptAllCallback = buildAcceptAllCallback(
    assignedTasks.map((t: any) => Number(t.id)),
  );
  if (acceptAllCallback) {
    taskButtons.push([{
      text: `✅ Принять все назначенные (${assignedTasks.length})`,
      callback_data: acceptAllCallback,
    }]);
  }

  // ---- Filter + nav buttons ----
  const filterRow = buildTaskFilterButtons(activeFilter, ac, pc, oc);
  const navRow = [
    [{ text: "🔙 Меню", callback_data: "main_menu" }],
  ];

  const miniAppBtn = createMiniAppButton("📱 Задачи в Mini App", { screen: "tasks", startapp: "tasks" });
  if (miniAppBtn) {
    navRow[0].push(miniAppBtn);
  }

  const keyboard = [...taskButtons, ...filterRow, ...navRow];

  await render(chatId, msgId, bodyText, keyboard);
}

function buildTaskFilterButtons(active: TaskFilter, ac: number, pc: number, oc: number): any[][] {
  const filters: Array<{ label: string; key: TaskFilter }> = [
    { label: "Все", key: "all" },
    { label: `🔵${ac}`, key: "assigned" },
    { label: `🟢${pc}`, key: "progress" },
  ];
  if (oc > 0) filters.push({ label: `⚠️${oc}`, key: "overdue" });
  filters.push({ label: "✅", key: "done" });

  return [filters.map((f) => ({
    text: f.key === active ? `[${f.label}]` : f.label,
    callback_data: `my_tasks:${f.key}`,
  }))];
}

// ===========================
// Task detail card
// ===========================
async function handleTaskDetail(chatId: number, from: any, taskId: number, msgId: number | null = null) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const { data: task } = await supabase
    .from("task_instances")
    .select("*, task_templates(name, code, phase, unit, duration_days), facades(name), users!task_instances_assignee_id_fkey(first_name, last_name)")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    await sendMessage(chatId, "❌ Задача не найдена.");
    return;
  }

  const today = getTodayIsoDate();
  const template = getTaskTemplate(task);
  const facadeRow = getTaskFacade(task);
  const name = template?.name || `Задача #${task.id}`;
  const code = template?.code || "—";
  const phase = template?.phase || "—";
  const unit = template?.unit || "ед.";
  const facade = facadeRow?.name || "—";
  const assignee = task.users
    ? `${task.users.first_name || ""} ${task.users.last_name || ""}`.trim() || "—"
    : "не назначен";
  const pct = Number(task.completion_pct || 0).toFixed(0);
  const statusIcon = STATUS_ICON[task.status] || "⚪";
  const statusLabel = STATUS_LABEL[task.status] || task.status;
  const pi = PRIORITY_ICON[task.priority] || "";
  const isOverdue = task.planned_end && task.planned_end < today && !["DONE", "VERIFIED", "CANCELLED"].includes(task.status);
  const isDefect = task.type === "DEFECT";
  const daysOverdue = isOverdue ? Math.ceil((Date.now() - new Date(task.planned_end).getTime()) / 86400000) : 0;

  // Progress bar (10 chars)
  const filledBlocks = Math.round(Number(pct) / 10);
  const progressBar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

  let text = `${statusIcon} *${isDefect ? "ДЕФЕКТ: " : ""}${name}*\n\n`;
  text += `📌 Код: \`${code}\`\n`;
  text += `📊 Статус: ${statusLabel}\n`;
  text += `${pi} Приоритет: ${task.priority}\n`;
  text += `📁 Фаза: ${phase}\n`;
  text += `🏢 Фасад: ${facade}\n`;
  text += `👤 Исполнитель: ${assignee}\n`;
  text += `\n📅 План: ${task.planned_start || "—"} → ${task.planned_end || "—"}\n`;
  if (task.actual_start) text += `📅 Факт начало: ${task.actual_start}\n`;
  if (task.actual_end) text += `📅 Факт конец: ${task.actual_end}\n`;
  text += `\n📈 Прогресс: ${pct}%\n\`${progressBar}\`\n`;
  if (task.actual_volume || task.planned_volume) {
    text += `📦 Объём: ${Number(task.actual_volume || 0).toFixed(1)} / ${Number(task.planned_volume || 0).toFixed(1)} ${unit}\n`;
  }
  if (isOverdue) {
    text += `\n⚠️ *Просрочка: ${daysOverdue} дн.*\n`;
  }
  if (task.notes) {
    text += `\n📝 Примечание: ${task.notes.substring(0, 200)}\n`;
  }

  // ---- Action buttons ----
  const buttons: any[][] = [];
  const isMyTask = task.assignee_id === user.id;

  if (task.status === "ASSIGNED" && isMyTask) {
    buttons.push([{ text: "▶ Принять в работу", callback_data: `accept:task:${task.id}` }]);
  }
  if (task.status === "IN_PROGRESS" && isMyTask) {
    buttons.push([
      { text: "✅ Завершить", callback_data: `task_done:${task.id}` },
      { text: "🔴 Блокировать", callback_data: `task_block:${task.id}` },
    ]);
    buttons.push([{ text: "📝 Ввести факт", callback_data: `fact_select:${task.id}` }]);
  }
  if (task.status === "DONE") {
    const resolved = resolveUserRole(user);
    if (resolved.isAdmin || resolved.systemName === "site_manager") {
      buttons.push([{ text: "✔️ Верифицировать", callback_data: `task_verify:${task.id}` }]);
    }
  }
  if (task.status === "BLOCKED" && isMyTask) {
    buttons.push([{ text: "🔓 Разблокировать", callback_data: `task_unblock:${task.id}` }]);
  }

  const miniAppBtn = createMiniAppButton("📱 В Mini App", { screen: "tasks", taskId: task.id, startapp: `task_${task.id}` });
  const backRow: any[] = [{ text: "🔙 К списку", callback_data: "my_tasks" }];
  if (miniAppBtn) backRow.push(miniAppBtn);
  buttons.push(backRow);

  await render(chatId, msgId, text, buttons);
}

// ===========================
// Task state transitions with guards
// ===========================
async function handleTaskDone(chatId: number, from: any, taskId: number, msgId: number | null = null) {
  const user = await getUser(from.id);
  if (!user) return;

  const { data: task } = await supabase
    .from("task_instances")
    .select("id, status, assignee_id, task_templates(name)")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    await sendMessage(chatId, "❌ Задача не найдена.");
    return;
  }
  if (task.status !== "IN_PROGRESS") {
    await sendMessage(chatId, `⚠️ Задача в статусе *${STATUS_LABEL[task.status] || task.status}* — завершить можно только из статуса «В работе».`);
    return;
  }
  if (task.assignee_id !== user.id) {
    await sendMessage(chatId, "⚠️ Можно завершить только свою задачу.");
    return;
  }

  await supabase.from("task_instances").update({
    status: "DONE",
    actual_end: getTodayIsoDate(),
    updated_at: new Date().toISOString(),
  }).eq("id", taskId);

  await supabase.from("audit_logs").insert({
    action: "TASK_STATUS_CHANGED",
    entity_type: "TaskInstance",
    entity_id: taskId,
    user_id: user.id,
    old_value: { status: "IN_PROGRESS" },
    new_value: { status: "DONE" },
  });

  const taskName = getTaskName(task) || `#${taskId}`;
  await render(chatId, msgId, `✅ Задача «${taskName}» завершена.\nОжидает верификации.`,
    [[{ text: "🔵 Задачи", callback_data: "my_tasks" }, { text: "🔵 Меню", callback_data: "main_menu" }]]);
}

async function handleTaskVerify(chatId: number, from: any, taskId: number, msgId: number | null = null) {
  const user = await getUser(from.id);
  if (!user) return;

  const resolved = resolveUserRole(user);
  if (!resolved.isAdmin && resolved.systemName !== "site_manager") {
    await sendMessage(chatId, "⚠️ Верификация доступна только начальнику участка или руководителю.");
    return;
  }

  const { data: task } = await supabase
    .from("task_instances")
    .select("id, status, task_templates(name)")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) { await sendMessage(chatId, "❌ Задача не найдена."); return; }
  if (task.status !== "DONE") {
    await sendMessage(chatId, `⚠️ Задача в статусе «${STATUS_LABEL[task.status] || task.status}» — верифицировать можно только завершённые.`);
    return;
  }

  await supabase.from("task_instances").update({
    status: "VERIFIED",
    reviewer_id: user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", taskId);

  await supabase.from("audit_logs").insert({
    action: "TASK_STATUS_CHANGED",
    entity_type: "TaskInstance",
    entity_id: taskId,
    user_id: user.id,
    old_value: { status: "DONE" },
    new_value: { status: "VERIFIED" },
  });

  const taskName = getTaskName(task) || `#${taskId}`;
  await renderDone(chatId, msgId, `✔️ Задача «${taskName}» верифицирована.`);
}

async function handleTaskBlock(chatId: number, from: any, taskId: number, msgId: number | null = null) {
  const user = await getUser(from.id);
  if (!user) return;

  const { data: task } = await supabase
    .from("task_instances")
    .select("id, status, assignee_id, task_templates(name)")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) { await sendMessage(chatId, "❌ Задача не найдена."); return; }
  if (!["ASSIGNED", "IN_PROGRESS"].includes(task.status)) {
    await sendMessage(chatId, "⚠️ Блокировка доступна только для назначенных/активных задач.");
    return;
  }

  const prevStatus = task.status;
  await supabase.from("task_instances").update({
    status: "BLOCKED",
    updated_at: new Date().toISOString(),
  }).eq("id", taskId);

  await supabase.from("audit_logs").insert({
    action: "TASK_STATUS_CHANGED",
    entity_type: "TaskInstance",
    entity_id: taskId,
    user_id: user.id,
    old_value: { status: prevStatus },
    new_value: { status: "BLOCKED" },
  });

  const taskName = getTaskName(task) || `#${taskId}`;
  await render(chatId, msgId, `🔴 Задача «${taskName}» заблокирована.`,
    [[{ text: "🟢 Разблокировать", callback_data: `task_unblock:${taskId}` }, { text: "🔵 Задачи", callback_data: "my_tasks" }]]);
}

async function handleTaskUnblock(chatId: number, from: any, taskId: number, msgId: number | null = null) {
  const user = await getUser(from.id);
  if (!user) return;

  const { data: task } = await supabase
    .from("task_instances")
    .select("id, status, task_templates(name)")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) { await sendMessage(chatId, "❌ Задача не найдена."); return; }
  if (task.status !== "BLOCKED") {
    await sendMessage(chatId, "⚠️ Задача не заблокирована.");
    return;
  }

  await supabase.from("task_instances").update({
    status: "IN_PROGRESS",
    updated_at: new Date().toISOString(),
  }).eq("id", taskId);

  await supabase.from("audit_logs").insert({
    action: "TASK_STATUS_CHANGED",
    entity_type: "TaskInstance",
    entity_id: taskId,
    user_id: user.id,
    old_value: { status: "BLOCKED" },
    new_value: { status: "IN_PROGRESS" },
  });

  const taskName = getTaskName(task) || `#${taskId}`;
  await renderDone(chatId, msgId, `🔓 Задача «${taskName}» разблокирована → В работе.`);
}

// ===========================
// Screen 3: /fact — Fact Entry Wizard
// ===========================
async function handleFact(chatId: number, from: any, msgId: number | null = null) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const { data: tasks } = await supabase
    .from("task_instances")
    .select("id, completion_pct, task_templates(name, unit), facades(name)")
    .eq("assignee_id", user.id)
    .eq("status", "IN_PROGRESS")
    .order("planned_end", { ascending: true })
    .limit(5);

  if (!tasks || tasks.length === 0) {
    await render(chatId, msgId,
      `📝 *Ввод факта — ${getTodayHumanDate()}*\n\nНет задач в статусе «В работе».`,
      [[{ text: "🔵 Задачи", callback_data: "my_tasks" }, { text: "🔵 Меню", callback_data: "main_menu" }]]);
    return;
  }

  const buttons: any[][] = tasks.map((t: any) => [{
    text: `🔵 ${getTaskName(t).substring(0, 32)}`,
    callback_data: `fact_select:${t.id}`,
  }]);
  buttons.push([{ text: "🔴 Отмена", callback_data: "main_menu" }]);

  await render(chatId, msgId,
    `📝 *Ввод факта — Шаг 1/3*\n📅 ${getTodayHumanDate()}\n\nВыберите задачу:`,
    buttons);
}

/** Fact wizard step 2: show task info, ask for numeric value (text input) */
async function factWizardStep2(chatId: number, from: any, taskId: number, msgId: number) {
  const user = await getUser(from.id);
  if (!user) return;

  const { data: task } = await supabase
    .from("task_instances")
    .select("id, completion_pct, actual_volume, planned_volume, task_templates(name, unit), facades(name)")
    .eq("id", taskId).maybeSingle();

  if (!task) { await editMessage(chatId, msgId, "❌ Задача не найдена."); return; }

  const name = getTaskName(task);
  const unit = task.task_templates?.unit || "ед.";
  const pct = Number(task.completion_pct || 0).toFixed(0);
  const facade = task.facades?.name || "—";

  setWizard(chatId, "fact_await_value", msgId, { taskId, taskName: name, unit, userId: user.id });

  await editMessage(chatId, msgId,
    `📝 *Ввод факта — Шаг 2/3*\n\n📋 *${name}*\n🏢 ${facade} | 📈 ${pct}%\n\n✏️ Введите значение (${unit}):`,
    { reply_markup: { inline_keyboard: [[{ text: "🔴 Отмена", callback_data: "fact_cancel" }]] } });
}

/** Fact wizard step 3: confirm value */
async function factWizardStep3(chatId: number, msgId: number, taskId: number, taskName: string, unit: string, value: number) {
  const valEnc = Math.round(value * 100);
  await editMessage(chatId, msgId,
    `📝 *Ввод факта — Шаг 3/3*\n\n📋 *${taskName}*\n📊 Значение: *${value}* ${unit}\n📅 ${getTodayHumanDate()}\n\nПодтвердить?`,
    { reply_markup: { inline_keyboard: [
      [{ text: "🟢 Подтвердить", callback_data: `fact_confirm:${taskId}:${valEnc}` }],
      [{ text: "🔴 Отмена", callback_data: "fact_cancel" }],
    ]} });
}

/** Fact wizard step 4: save + final status */
async function factWizardSave(chatId: number, from: any, taskId: number, value: number, msgId: number) {
  const user = await getUser(from.id);
  if (!user) return;
  const today = getTodayIsoDate();

  const { data: task } = await supabase
    .from("task_instances").select("id, task_templates(name, unit)").eq("id", taskId).maybeSingle();
  const taskName = getTaskName(task);
  const unit = task?.task_templates?.unit || "ед.";

  // Upsert DailyWorkLog
  const { data: existing } = await supabase
    .from("daily_work_logs").select("id, plan_day").eq("task_instance_id", taskId).eq("date", today).maybeSingle();

  if (existing) {
    const plan = Number(existing.plan_day || 0);
    await supabase.from("daily_work_logs").update({
      fact_day: value, deviation: value - plan, pct_day: plan > 0 ? (value / plan) * 100 : null, updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabase.from("daily_work_logs").insert({
      task_instance_id: taskId, date: today,
      day_of_week: ["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"][new Date().getDay()],
      fact_day: value, plan_day: 0, deviation: value, status: "DRAFT", created_by: user.id,
    });
  }

  // Recalculate accumulations
  const { data: allLogs } = await supabase
    .from("daily_work_logs").select("fact_day, plan_day").eq("task_instance_id", taskId).lte("date", today);
  let accFact = value;
  if (allLogs) {
    accFact = allLogs.reduce((s: number, l: any) => s + Number(l.fact_day || 0), 0);
    const accPlan = allLogs.reduce((s: number, l: any) => s + Number(l.plan_day || 0), 0);
    await supabase.from("task_instances").update({
      actual_volume: accFact, completion_pct: accPlan > 0 ? Math.min((accFact / accPlan) * 100, 100) : 0,
    }).eq("id", taskId);
  }

  await supabase.from("audit_logs").insert({
    action: "FACT_ENTERED", entity_type: "DailyWorkLog", user_id: user.id,
    new_value: { task_id: taskId, date: today, fact_day: value, acc_fact: accFact },
  });

  clearWizard(chatId);

  // Final status — clean, no keyboard
  await editMessage(chatId, msgId,
    `✔️ *Факт записан*\n\n📋 ${taskName}\n📊 ${value} ${unit}\n📈 Накопл.: ${accFact.toFixed(1)} ${unit}\n📅 ${getTodayHumanDate()}`);
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
  const msgId = callbackQuery.message?.message_id;
  const data = callbackQuery.data;
  const from = callbackQuery.from;

  await answerCallback(callbackQuery.id);

  if (!chatId || !data) return;

  // Clear wizard if user navigates away from fact flow
  const parsedAction = parseCallbackAction(data);
  if (!["fact_select", "fact_confirm", "fact_cancel"].includes(parsedAction.type)) {
    clearWizard(chatId);
  }

  switch (parsedAction.type) {
    case "my_tasks":
      await handleTasks(chatId, from, "all", msgId);
      break;
    case "my_tasks_filter":
      await handleTasks(chatId, from, parsedAction.filter, msgId);
      break;
    case "main_menu": {
      const user = await getUser(from.id);
      if (user && user.status === "ACTIVE") await sendMainMenu(chatId, user, msgId);
      break;
    }
    case "enter_fact":
      await handleFact(chatId, from, msgId);
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
    case "task_detail":
      await handleTaskDetail(chatId, from, parsedAction.taskId, msgId);
      break;
    case "task_done":
      await handleTaskDone(chatId, from, parsedAction.taskId, msgId);
      break;
    case "task_verify":
      await handleTaskVerify(chatId, from, parsedAction.taskId, msgId);
      break;
    case "task_block":
      await handleTaskBlock(chatId, from, parsedAction.taskId, msgId);
      break;
    case "task_unblock":
      await handleTaskUnblock(chatId, from, parsedAction.taskId, msgId);
      break;
    case "fact_select":
      await factWizardStep2(chatId, from, parsedAction.taskId, msgId);
      break;
    case "fact_confirm":
      await factWizardSave(chatId, from, parsedAction.taskId, parsedAction.value, msgId);
      break;
    case "fact_cancel":
      clearWizard(chatId);
      await renderDone(chatId, msgId, "🔴 Ввод факта отменён.");
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
      if (!user || user.status !== "ACTIVE") {
        await sendMessage(chatId, "Используйте /start для авторизации.");
        return;
      }

      const { data: taskToAccept, error: taskError } = await supabase
        .from("task_instances")
        .select("id, status, assignee_id, task_templates(name)")
        .eq("id", parsedAction.taskId)
        .maybeSingle();

      if (taskError || !taskToAccept) {
        await sendMessage(chatId, "❌ Задача не найдена.");
        return;
      }
      if (taskToAccept.status !== "ASSIGNED") {
        await sendMessage(chatId, `⚠️ Задача уже в статусе «${STATUS_LABEL[taskToAccept.status] || taskToAccept.status}».`);
        return;
      }
      if (taskToAccept.assignee_id !== user.id) {
        await sendMessage(chatId, "⚠️ Эта задача назначена другому пользователю.");
        return;
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from("task_instances")
        .update({
          status: "IN_PROGRESS",
          actual_start: getTodayIsoDate(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", parsedAction.taskId)
        .eq("assignee_id", user.id)
        .eq("status", "ASSIGNED")
        .select("id")
        .maybeSingle();

      if (updateError || !updatedTask) {
        await sendMessage(chatId, "⚠️ Не удалось принять задачу. Обновите экран /tasks.");
        return;
      }

      await supabase.from("audit_logs").insert({
        action: "TASK_STATUS_CHANGED",
        entity_type: "TaskInstance",
        entity_id: parsedAction.taskId,
        user_id: user.id,
        old_value: { status: "ASSIGNED" },
        new_value: { status: "IN_PROGRESS" },
      });

      const acceptedName = getTaskName(taskToAccept) || `#${parsedAction.taskId}`;
      await render(chatId, msgId, `🟢 Задача «${acceptedName}» принята в работу.`,
        [[{ text: "🔵 Ввести факт", callback_data: `fact_select:${parsedAction.taskId}` }, { text: "🔵 Задачи", callback_data: "my_tasks" }]]);
      break;
    }
    case "accept_all": {
      const user = await getUser(from.id);
      if (!user || user.status !== "ACTIVE") {
        await sendMessage(chatId, "Используйте /start для авторизации.");
        return;
      }

      const uniqueTaskIds = Array.from(
        new Set(
          parsedAction.taskIds
            .map((taskId) => Number(taskId))
            .filter((taskId) => Number.isInteger(taskId) && taskId > 0),
        ),
      );

      if (uniqueTaskIds.length === 0) {
        await sendMessage(chatId, "ℹ️ Нет задач для пакетного принятия.");
        return;
      }

      const { data: acceptedTasks, error: bulkAcceptError } = await supabase
        .from("task_instances")
        .update({
          status: "IN_PROGRESS",
          actual_start: getTodayIsoDate(),
          updated_at: new Date().toISOString(),
        })
        .in("id", uniqueTaskIds)
        .eq("assignee_id", user.id)
        .eq("status", "ASSIGNED")
        .select("id");

      if (bulkAcceptError) {
        console.error("Bulk accept failed:", bulkAcceptError);
        await sendMessage(chatId, "❌ Ошибка пакетного принятия. Попробуйте ещё раз.");
        return;
      }

      const acceptedCount = acceptedTasks?.length || 0;
      const skippedCount = uniqueTaskIds.length - acceptedCount;

      await supabase.from("audit_logs").insert({
        action: "TASKS_ACCEPTED_BULK",
        entity_type: "TaskInstance",
        user_id: user.id,
        new_value: {
          requested_task_ids: uniqueTaskIds,
          accepted_count: acceptedCount,
          skipped_count: skippedCount,
        },
      });

      await render(chatId, msgId, `🟢 Принято: ${acceptedCount} | Пропущено: ${skippedCount}`,
        [[{ text: "🔵 Задачи", callback_data: "my_tasks" }, { text: "🔵 Меню", callback_data: "main_menu" }]]);
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

    // Handle text messages (commands + wizard text input)
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const from = update.message.from;
      const userMsgId = update.message.message_id;
      const [command, startArg] = text.trim().split(/\s+/, 2);

      // Check active wizard (text input for fact value)
      const wiz = getWizard(chatId);
      if (wiz && wiz.step === "fact_await_value" && !text.startsWith("/")) {
        const value = parseFloat(text.replace(",", "."));
        if (isNaN(value) || value < 0) {
          await editMessage(chatId, wiz.messageId,
            `📝 *Ввод факта — Шаг 2/3*\n\n⚠️ Введите число >= 0\nПолучено: «${text}»`,
            { reply_markup: { inline_keyboard: [[{ text: "🔴 Отмена", callback_data: "fact_cancel" }]] } });
          await deleteMessage(chatId, userMsgId);
        } else {
          const { taskId, taskName, unit } = wiz.data;
          clearWizard(chatId);
          await deleteMessage(chatId, userMsgId);
          await factWizardStep3(chatId, wiz.messageId, taskId, taskName, unit, value);
        }
        return new Response("OK", { status: 200 });
      }

      // Slash commands
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
