// STSphera — Telegram Bot Webhook (Supabase Edge Function)
// Handles: /start, /help, /tasks, /fact, /defect, /menu, callbacks, text input, photos
// Conversation state management for multi-step flows

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") || "https://t.me/STSpheraBot/app";

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ===========================
// In-memory conversation state
// (keyed by chat_id)
// ===========================
interface ConversationState {
  step: string;
  data: Record<string, any>;
  expiresAt: number;
}

const conversations = new Map<number, ConversationState>();

function getConversation(chatId: number): ConversationState | undefined {
  const state = conversations.get(chatId);
  if (state && state.expiresAt < Date.now()) {
    conversations.delete(chatId);
    return undefined;
  }
  return state;
}

function setConversation(chatId: number, step: string, data: Record<string, any> = {}) {
  conversations.set(chatId, {
    step,
    data,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min TTL
  });
}

function clearConversation(chatId: number) {
  conversations.delete(chatId);
}

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
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode || "Markdown",
      reply_markup: opts?.reply_markup,
    }),
  });
  return res.json();
}

async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  opts?: { parse_mode?: string; reply_markup?: any }
) {
  await fetch(`${TG_API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
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

async function getFile(fileId: string): Promise<string | null> {
  const res = await fetch(`${TG_API}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const data = await res.json();
  if (data.ok && data.result?.file_path) {
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
  }
  return null;
}

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

// ===========================
// Helper: get user role info
// ===========================
function getUserRole(user: any) {
  const role = user?.user_roles?.[0]?.roles;
  return {
    role,
    roleName: role?.display_name || "Пользователь",
    isAdmin: role?.system_name === "admin" || role?.system_name === "project_director",
    isSiteManager: role?.system_name === "site_manager",
    systemName: role?.system_name || "",
  };
}

// ===========================
// Command handlers
// ===========================
async function handleStart(chatId: number, from: any, startParam?: string) {
  const user = await getUser(from.id);

  if (!user) {
    const newUser = await createUser(from);
    if (!newUser) {
      await sendMessage(chatId, "Ошибка регистрации. Попробуйте позже.");
      return;
    }

    await sendMessage(
      chatId,
      `Добро пожаловать в *STSphera*, ${from.first_name}!\n\nВаша заявка на рассмотрении. Администратор назначит вам роль.`,
    );

    // Notify admins
    await notifyAdmins(newUser);
    return;
  }

  if (user.status === "PENDING") {
    await sendMessage(chatId, "Ваша заявка на рассмотрении. Ожидайте назначения роли.");
    return;
  }

  if (user.status === "BLOCKED") {
    await sendMessage(chatId, "Ваш аккаунт заблокирован. Обратитесь к администратору.");
    return;
  }

  // Handle deep-link start params
  if (startParam) {
    if (startParam.startsWith("task_")) {
      const taskId = startParam.replace("task_", "");
      await handleTaskDetail(chatId, user, Number(taskId));
      return;
    }
    if (startParam === "plan_fact") {
      await handleFact(chatId, from);
      return;
    }
    if (startParam === "defect") {
      await handleDefect(chatId, from);
      return;
    }
  }

  // Active user — main menu
  await showMainMenu(chatId, user);
}

async function showMainMenu(chatId: number, user: any) {
  const { roleName, isAdmin } = getUserRole(user);

  const buttons: any[][] = [
    [
      { text: "📋 Мои задачи", callback_data: "my_tasks" },
      { text: "📝 Ввести факт", callback_data: "enter_fact" },
    ],
    [
      { text: "🔴 Дефект", callback_data: "report_defect" },
      { text: "📊 Сводка", callback_data: "summary" },
    ],
    [
      { text: "📱 Открыть Mini App", web_app: { url: MINI_APP_URL } },
    ],
  ];

  // Admin gets extra buttons
  if (isAdmin) {
    buttons.push([
      { text: "👤 Управление пользователями", callback_data: "manage_users" },
      { text: "🏗 Настроить демо", callback_data: "setup_demo" },
    ]);
  }

  await sendMessage(
    chatId,
    `*STSphera — ${roleName}*\nПроект: СИТИ-4\n\nВыберите действие:`,
    {
      reply_markup: { inline_keyboard: buttons },
    }
  );
}

async function handleMenu(chatId: number, from: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }
  await showMainMenu(chatId, user);
}

async function handleHelp(chatId: number) {
  await sendMessage(
    chatId,
    "*Команды STSphera Bot:*\n\n" +
      "/start — Главное меню\n" +
      "/menu — Показать меню\n" +
      "/tasks — Мои задачи\n" +
      "/fact — Ввод факта\n" +
      "/defect — Фиксация дефекта\n" +
      "/help — Список команд\n\n" +
      "_Используйте кнопку «Открыть Mini App» для расширенного доступа к проекту._"
  );
}

async function handleTasks(chatId: number, from: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const { data: tasks } = await supabase
    .from("task_instances")
    .select("id, status, planned_start, planned_end, priority, completion_pct, task_templates(name, code), facades(name)")
    .eq("assignee_id", user.id)
    .in("status", ["ASSIGNED", "IN_PROGRESS"])
    .order("planned_end", { ascending: true })
    .limit(15);

  if (!tasks || tasks.length === 0) {
    await sendMessage(chatId, "У вас нет активных задач.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 Все задачи в Mini App", web_app: { url: `${MINI_APP_URL}?startapp=tasks` } }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  const icons: Record<string, string> = {
    ASSIGNED: "🔵",
    IN_PROGRESS: "🟢",
  };

  const priorityIcons: Record<string, string> = {
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  const lines = tasks.map((t: any, i: number) => {
    const name = t.task_templates?.name || `Задача #${t.id}`;
    const facade = t.facades?.name || "";
    const pct = Number(t.completion_pct || 0).toFixed(0);
    const pi = priorityIcons[t.priority] || "";
    return `${icons[t.status] || "⚪"} *${i + 1}. ${name}*\n   ${pi} Срок: ${t.planned_end || "—"} | ${pct}%${facade ? ` | ${facade}` : ""}`;
  });

  const assignedCount = tasks.filter((t: any) => t.status === "ASSIGNED").length;
  const inProgressCount = tasks.filter((t: any) => t.status === "IN_PROGRESS").length;

  const buttons: any[][] = [];

  // Show accept all button if there are assigned tasks
  if (assignedCount > 0) {
    const assignedIds = tasks.filter((t: any) => t.status === "ASSIGNED").map((t: any) => t.id);
    buttons.push([{
      text: `✅ Принять все новые (${assignedCount})`,
      callback_data: `accept_all:${assignedIds.join(",")}`,
    }]);
  }

  buttons.push([
    { text: "📱 Подробнее в Mini App", web_app: { url: `${MINI_APP_URL}?startapp=tasks` } },
    { text: "🔙 Меню", callback_data: "main_menu" },
  ]);

  await sendMessage(
    chatId,
    `*Ваши задачи (${tasks.length}):*\n🔵 Назначено: ${assignedCount} | 🟢 В работе: ${inProgressCount}\n\n${lines.join("\n\n")}`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

async function handleTaskDetail(chatId: number, user: any, taskId: number) {
  const { data: task } = await supabase
    .from("task_instances")
    .select("*, task_templates(name, code, phase, unit), facades(name), users!task_instances_assignee_id_fkey(first_name, last_name)")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    await sendMessage(chatId, "Задача не найдена.");
    return;
  }

  const name = task.task_templates?.name || `Задача #${task.id}`;
  const code = task.task_templates?.code || "";
  const facade = task.facades?.name || "—";
  const assignee = task.users ? `${task.users.first_name || ""} ${task.users.last_name || ""}`.trim() : "—";
  const pct = Number(task.completion_pct || 0).toFixed(0);

  const statusLabels: Record<string, string> = {
    CREATED: "⚪ Создана",
    ASSIGNED: "🔵 Назначена",
    IN_PROGRESS: "🟢 В работе",
    DONE: "✅ Выполнена",
    VERIFIED: "✔️ Принята",
    BLOCKED: "🔴 Заблокирована",
    CANCELLED: "⛔ Отменена",
  };

  let text = `*${name}*\n`;
  if (code) text += `Код: \`${code}\`\n`;
  text += `Статус: ${statusLabels[task.status] || task.status}\n`;
  text += `Фасад: ${facade}\n`;
  text += `Ответственный: ${assignee}\n`;
  text += `Приоритет: ${task.priority}\n`;
  text += `Прогресс: ${pct}%\n`;
  text += `Даты: ${task.planned_start || "—"} → ${task.planned_end || "—"}\n`;
  if (task.notes) text += `\nПримечание: ${task.notes}`;

  const buttons: any[][] = [];
  if (task.status === "ASSIGNED" && task.assignee_id === user.id) {
    buttons.push([{ text: "▶ Принять в работу", callback_data: `accept:task:${task.id}` }]);
  }
  if (task.status === "IN_PROGRESS" && task.assignee_id === user.id) {
    buttons.push([
      { text: "📝 Ввести факт", callback_data: `fact_select:${task.id}` },
      { text: "✅ Завершить", callback_data: `complete:task:${task.id}` },
    ]);
  }
  buttons.push([
    { text: "📱 В Mini App", web_app: { url: `${MINI_APP_URL}?startapp=task_${task.id}` } },
    { text: "🔙 Меню", callback_data: "main_menu" },
  ]);

  await sendMessage(chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

async function handleFact(chatId: number, from: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const { data: tasks } = await supabase
    .from("task_instances")
    .select("id, task_templates(name, code, unit), facades(name)")
    .eq("assignee_id", user.id)
    .eq("status", "IN_PROGRESS")
    .limit(10);

  if (!tasks || tasks.length === 0) {
    await sendMessage(chatId, "Нет активных задач для ввода факта.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 План-Факт в Mini App", web_app: { url: `${MINI_APP_URL}?startapp=plan_fact` } }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  const buttons = tasks.map((t: any) => [{
    text: `${(t.task_templates?.name || `#${t.id}`).substring(0, 38)}${t.facades?.name ? ` (${t.facades.name})` : ""}`,
    callback_data: `fact_select:${t.id}`,
  }]);

  buttons.push([{ text: "🔙 Меню", callback_data: "main_menu" }]);

  await sendMessage(chatId, "*Ввод факта* — выберите задачу:", {
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
    await sendMessage(chatId, "В проекте нет фасадов. Добавьте через настройку проекта.");
    return;
  }

  // Store project_id in conversation state
  setConversation(chatId, "defect_select_facade", { projectId: userRole.project_id, userId: user.id });

  const buttons = facades.map((f: any) => [{
    text: f.name,
    callback_data: `defect_facade:${f.id}`,
  }]);

  buttons.push([{ text: "❌ Отмена", callback_data: "cancel_flow" }]);

  await sendMessage(chatId, "*Фиксация дефекта*\n\nШаг 1/3: Выберите фасад/зону:", {
    reply_markup: { inline_keyboard: buttons },
  });
}

// ===========================
// Callback handlers
// ===========================
async function handleCallback(callbackQuery: any) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data;
  const from = callbackQuery.from;

  await answerCallback(callbackQuery.id);

  if (!chatId || !data) return;

  // ---- Main menu ----
  if (data === "main_menu") {
    clearConversation(chatId);
    const user = await getUser(from.id);
    if (user && user.status === "ACTIVE") {
      await showMainMenu(chatId, user);
    }
    return;
  }

  // ---- Cancel any flow ----
  if (data === "cancel_flow") {
    clearConversation(chatId);
    await sendMessage(chatId, "Действие отменено.", {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Меню", callback_data: "main_menu" }]],
      },
    });
    return;
  }

  // ---- My tasks ----
  if (data === "my_tasks") {
    await handleTasks(chatId, from);
    return;
  }

  // ---- Enter fact ----
  if (data === "enter_fact") {
    await handleFact(chatId, from);
    return;
  }

  // ---- Report defect ----
  if (data === "report_defect") {
    await handleDefect(chatId, from);
    return;
  }

  // ---- Summary / stats ----
  if (data === "summary") {
    await handleSummary(chatId, from);
    return;
  }

  // ---- Accept task ----
  if (data.startsWith("accept:task:")) {
    const taskId = Number(data.split(":")[2]);
    const user = await getUser(from.id);
    if (!user) return;

    const { data: task } = await supabase
      .from("task_instances")
      .select("status, assignee_id")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) {
      await sendMessage(chatId, "Задача не найдена.");
      return;
    }

    if (task.status !== "ASSIGNED") {
      await sendMessage(chatId, "Задача уже принята или в другом статусе.");
      return;
    }

    await supabase
      .from("task_instances")
      .update({ status: "IN_PROGRESS", actual_start: new Date().toISOString().split("T")[0] })
      .eq("id", taskId);

    await supabase.from("audit_logs").insert({
      action: "TASK_STATUS_CHANGED",
      entity_type: "TaskInstance",
      entity_id: taskId,
      user_id: user.id,
      old_value: { status: "ASSIGNED" },
      new_value: { status: "IN_PROGRESS" },
    });

    await sendMessage(chatId, "Задача принята в работу!", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📝 Ввести факт", callback_data: `fact_select:${taskId}` },
            { text: "📋 Мои задачи", callback_data: "my_tasks" },
          ],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  // ---- Complete task ----
  if (data.startsWith("complete:task:")) {
    const taskId = Number(data.split(":")[2]);
    const user = await getUser(from.id);
    if (!user) return;

    await supabase
      .from("task_instances")
      .update({ status: "DONE", actual_end: new Date().toISOString().split("T")[0] })
      .eq("id", taskId)
      .eq("assignee_id", user.id);

    await supabase.from("audit_logs").insert({
      action: "TASK_STATUS_CHANGED",
      entity_type: "TaskInstance",
      entity_id: taskId,
      user_id: user.id,
      old_value: { status: "IN_PROGRESS" },
      new_value: { status: "DONE" },
    });

    // Notify site_manager about completed task
    const { data: task } = await supabase
      .from("task_instances")
      .select("project_id, task_templates(name)")
      .eq("id", taskId)
      .maybeSingle();

    if (task) {
      await notifyByRole(
        task.project_id,
        "site_manager",
        `*Задача завершена:*\n${task.task_templates?.name || `#${taskId}`}\nИсполнитель: ${user.first_name || ""} ${user.last_name || ""}`,
        [[{ text: "✔️ Принять", callback_data: `verify:task:${taskId}` }]]
      );
    }

    await sendMessage(chatId, "Задача отмечена как выполненная! Ожидает проверки.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Мои задачи", callback_data: "my_tasks" }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  // ---- Verify task (site_manager / reviewer) ----
  if (data.startsWith("verify:task:")) {
    const taskId = Number(data.split(":")[2]);
    const user = await getUser(from.id);
    if (!user) return;

    await supabase
      .from("task_instances")
      .update({ status: "VERIFIED", reviewer_id: user.id })
      .eq("id", taskId)
      .eq("status", "DONE");

    await supabase.from("audit_logs").insert({
      action: "TASK_STATUS_CHANGED",
      entity_type: "TaskInstance",
      entity_id: taskId,
      user_id: user.id,
      old_value: { status: "DONE" },
      new_value: { status: "VERIFIED" },
    });

    // Notify assignee
    const { data: task } = await supabase
      .from("task_instances")
      .select("assignee_id, task_templates(name), users!task_instances_assignee_id_fkey(telegram_id)")
      .eq("id", taskId)
      .maybeSingle();

    if (task?.users?.telegram_id) {
      await sendMessage(
        Number(task.users.telegram_id),
        `*Задача принята!*\n${task.task_templates?.name || `#${taskId}`}\nПроверил: ${user.first_name || ""}`
      );
    }

    await sendMessage(chatId, "Задача принята и верифицирована!");
    return;
  }

  // ---- Accept all tasks ----
  if (data.startsWith("accept_all:")) {
    const taskIds = data.replace("accept_all:", "").split(",").map(Number);
    const user = await getUser(from.id);
    if (!user) return;

    let accepted = 0;
    for (const taskId of taskIds) {
      const { error } = await supabase
        .from("task_instances")
        .update({ status: "IN_PROGRESS", actual_start: new Date().toISOString().split("T")[0] })
        .eq("id", taskId)
        .eq("assignee_id", user.id)
        .eq("status", "ASSIGNED");

      if (!error) accepted++;
    }

    await supabase.from("audit_logs").insert({
      action: "TASKS_ACCEPTED_BULK",
      entity_type: "TaskInstance",
      user_id: user.id,
      new_value: { task_ids: taskIds, count: accepted },
    });

    await sendMessage(chatId, `Принято задач: ${accepted}. Все в работе!`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Мои задачи", callback_data: "my_tasks" }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  // ---- Fact select: start number input flow ----
  if (data.startsWith("fact_select:")) {
    const taskId = Number(data.replace("fact_select:", ""));
    const user = await getUser(from.id);
    if (!user) return;

    const { data: task } = await supabase
      .from("task_instances")
      .select("id, task_templates(name, unit)")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) {
      await sendMessage(chatId, "Задача не найдена.");
      return;
    }

    const name = task.task_templates?.name || `Задача #${task.id}`;
    const unit = task.task_templates?.unit || "ед.";

    // Set conversation state to await number
    setConversation(chatId, "awaiting_fact_value", {
      taskId: task.id,
      taskName: name,
      unit,
      userId: user.id,
    });

    await sendMessage(
      chatId,
      `*Ввод факта:*\n📋 ${name}\n\nВведите числовое значение факта за сегодня (${unit}):`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Отмена", callback_data: "cancel_flow" }]],
        },
      }
    );
    return;
  }

  // ---- Defect: facade selected ----
  if (data.startsWith("defect_facade:")) {
    const facadeId = Number(data.replace("defect_facade:", ""));
    const conv = getConversation(chatId);

    if (!conv || conv.step !== "defect_select_facade") {
      // Start fresh defect flow
      const user = await getUser(from.id);
      if (!user || user.status !== "ACTIVE") return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("project_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      setConversation(chatId, "defect_select_severity", {
        projectId: userRole?.project_id || 1,
        userId: user.id,
        facadeId,
      });
    } else {
      setConversation(chatId, "defect_select_severity", {
        ...conv.data,
        facadeId,
      });
    }

    await sendMessage(chatId, "*Фиксация дефекта*\n\nШаг 2/3: Выберите критичность:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔴 Критический", callback_data: "defect_severity:HIGH" },
            { text: "🟡 Обычный", callback_data: "defect_severity:MEDIUM" },
          ],
          [
            { text: "🟢 Незначительный", callback_data: "defect_severity:LOW" },
          ],
          [{ text: "❌ Отмена", callback_data: "cancel_flow" }],
        ],
      },
    });
    return;
  }

  // ---- Defect: severity selected ----
  if (data.startsWith("defect_severity:")) {
    const severity = data.replace("defect_severity:", "");
    const conv = getConversation(chatId);

    if (!conv || conv.step !== "defect_select_severity") {
      await sendMessage(chatId, "Начните заново: /defect");
      return;
    }

    setConversation(chatId, "defect_enter_description", {
      ...conv.data,
      severity,
    });

    await sendMessage(
      chatId,
      `*Фиксация дефекта*\n\nШаг 3/3: Опишите дефект (текстом).\nМожете также приложить фото.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Отмена", callback_data: "cancel_flow" }]],
        },
      }
    );
    return;
  }

  // ---- Assign role: show role list ----
  if (data.startsWith("assign_role:")) {
    const targetUserId = Number(data.replace("assign_role:", ""));
    const admin = await getUser(from.id);
    if (!admin) return;

    const { isAdmin } = getUserRole(admin);
    if (!isAdmin) {
      await sendMessage(chatId, "У вас нет прав для назначения ролей.");
      return;
    }

    const { data: roles } = await supabase
      .from("roles")
      .select("id, system_name, display_name")
      .order("id");

    if (!roles || roles.length === 0) {
      await sendMessage(chatId, "Нет доступных ролей в системе.");
      return;
    }

    const buttons = roles.map((r: any) => [{
      text: r.display_name,
      callback_data: `role_set:${targetUserId}:${r.id}`,
    }]);

    buttons.push([{ text: "❌ Отмена", callback_data: "cancel_flow" }]);

    // Get target user info
    const { data: targetUser } = await supabase.from("users").select("first_name, username").eq("id", targetUserId).maybeSingle();

    await sendMessage(
      chatId,
      `*Назначение роли*\nПользователь: ${targetUser?.first_name || ""} (@${targetUser?.username || "—"})\n\nВыберите роль:`,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  // ---- Role set: assign role to user ----
  if (data.startsWith("role_set:")) {
    const parts = data.replace("role_set:", "").split(":");
    const targetUserId = Number(parts[0]);
    const roleId = Number(parts[1]);
    const admin = await getUser(from.id);
    if (!admin) return;

    const { isAdmin } = getUserRole(admin);
    if (!isAdmin) {
      await sendMessage(chatId, "У вас нет прав для назначения ролей.");
      return;
    }

    // Get project (use first active project)
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();

    const projectId = project?.id || 1;

    // Upsert user_role
    await supabase
      .from("user_roles")
      .upsert(
        {
          user_id: targetUserId,
          role_id: roleId,
          project_id: projectId,
          assigned_by: admin.id,
        },
        { onConflict: "user_id,role_id,project_id" }
      );

    // Activate user
    await supabase
      .from("users")
      .update({ status: "ACTIVE" })
      .eq("id", targetUserId);

    // Get role name
    const { data: role } = await supabase.from("roles").select("display_name").eq("id", roleId).maybeSingle();

    // AuditLog
    await supabase.from("audit_logs").insert({
      action: "ROLE_ASSIGNED",
      entity_type: "UserRole",
      entity_id: targetUserId,
      user_id: admin.id,
      new_value: { role_id: roleId, role_name: role?.display_name },
    });

    // Notify the user
    const { data: targetUser } = await supabase.from("users").select("telegram_id, first_name").eq("id", targetUserId).maybeSingle();
    if (targetUser?.telegram_id) {
      await sendMessage(
        Number(targetUser.telegram_id),
        `Вам назначена роль: *${role?.display_name || ""}*\n\nТеперь вы можете пользоваться ботом. Нажмите /start`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚀 Начать", callback_data: "main_menu" }],
            ],
          },
        }
      );
    }

    await sendMessage(
      chatId,
      `Роль *${role?.display_name || ""}* назначена пользователю ${targetUser?.first_name || ""}. Пользователь активирован.`
    );
    return;
  }

  // ---- Manage users ----
  if (data === "manage_users") {
    const admin = await getUser(from.id);
    if (!admin) return;

    const { isAdmin } = getUserRole(admin);
    if (!isAdmin) {
      await sendMessage(chatId, "У вас нет прав для управления пользователями.");
      return;
    }

    const { data: pendingUsers } = await supabase
      .from("users")
      .select("id, first_name, last_name, username, status")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!pendingUsers || pendingUsers.length === 0) {
      await sendMessage(chatId, "Нет новых заявок на рассмотрении.", {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Меню", callback_data: "main_menu" }]],
        },
      });
      return;
    }

    let text = `*Заявки на рассмотрении (${pendingUsers.length}):*\n\n`;
    const buttons: any[][] = [];

    for (const u of pendingUsers) {
      text += `👤 ${u.first_name || ""} ${u.last_name || ""} (@${u.username || "—"})\n`;
      buttons.push([{ text: `Назначить роль: ${u.first_name || u.username || `#${u.id}`}`, callback_data: `assign_role:${u.id}` }]);
    }

    buttons.push([{ text: "🔙 Меню", callback_data: "main_menu" }]);

    await sendMessage(chatId, text, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  // ---- Setup demo ----
  if (data === "setup_demo") {
    const admin = await getUser(from.id);
    if (!admin) return;

    const { isAdmin } = getUserRole(admin);
    if (!isAdmin) {
      await sendMessage(chatId, "У вас нет прав.");
      return;
    }

    await sendMessage(chatId, "Настраиваю демо-объект СИТИ-4...\nФасады, задачи, модули...");

    // Call project-workflow function
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
      await sendMessage(chatId,
        `*Демо-объект СИТИ-4 настроен!*\n\n` +
        `Фасады: 4\n` +
        `Типы работ: 8\n` +
        `Задач создано: ${result.data.generated || 0}\n` +
        `Назначено: ${result.data.assigned || 0}\n` +
        `Модулей: 4\n\n` +
        `Все отделы уведомлены.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📋 Мои задачи", callback_data: "my_tasks" },
                { text: "📊 Сводка", callback_data: "summary" },
              ],
              [{ text: "📱 Mini App", web_app: { url: MINI_APP_URL } }],
              [{ text: "🔙 Меню", callback_data: "main_menu" }],
            ],
          },
        }
      );
    } else {
      await sendMessage(chatId, "Ошибка настройки: " + (result.error || "неизвестная"), {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Меню", callback_data: "main_menu" }]],
        },
      });
    }
    return;
  }

  // ---- Mini app redirect stubs ----
  if (data.startsWith("open_miniapp:")) {
    const route = data.replace("open_miniapp:", "");
    await sendMessage(chatId, `Откройте Mini App для этой функции:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 Открыть", web_app: { url: `${MINI_APP_URL}?startapp=${route}` } }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  // Legacy fallback for view_tasks / create_tasks / view_modules
  if (data.startsWith("view_tasks:") || data.startsWith("create_tasks:") || data.startsWith("view_modules:")) {
    await sendMessage(chatId, "Эта функция доступна в Mini App:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 Открыть Mini App", web_app: { url: MINI_APP_URL } }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }
}

// ===========================
// Summary handler
// ===========================
async function handleSummary(chatId: number, from: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const [
    { count: taskCount },
    { count: inProgressCount },
    { count: doneCount },
    { count: overdueCount },
    { count: userCount },
    { count: facadeCount },
    { count: moduleCount },
    { count: todayLogsCount },
  ] = await Promise.all([
    supabase.from("task_instances").select("id", { count: "exact", head: true }),
    supabase.from("task_instances").select("id", { count: "exact", head: true }).eq("status", "IN_PROGRESS"),
    supabase.from("task_instances").select("id", { count: "exact", head: true }).in("status", ["DONE", "VERIFIED"]),
    supabase.from("task_instances").select("id", { count: "exact", head: true }).lt("planned_end", today).in("status", ["CREATED", "ASSIGNED", "IN_PROGRESS"]),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("facades").select("id", { count: "exact", head: true }),
    supabase.from("module_plan_items").select("id", { count: "exact", head: true }),
    supabase.from("daily_work_logs").select("id", { count: "exact", head: true }).eq("date", today),
  ]);

  const total = taskCount || 0;
  const done = doneCount || 0;
  const progressPct = total > 0 ? ((done / total) * 100).toFixed(1) : "0";

  await sendMessage(
    chatId,
    `*Сводка СИТИ-4:*\n\n` +
      `*Общий прогресс: ${progressPct}%*\n\n` +
      `📋 Всего задач: ${total}\n` +
      `🟢 В работе: ${inProgressCount || 0}\n` +
      `✅ Завершено: ${done}\n` +
      `🔴 Просрочено: ${overdueCount || 0}\n\n` +
      `👥 Пользователей: ${userCount || 0}\n` +
      `🏢 Фасадов: ${facadeCount || 0}\n` +
      `📦 Модулей: ${moduleCount || 0}\n` +
      `📝 Записей план-факт сегодня: ${todayLogsCount || 0}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 Дашборд в Mini App", web_app: { url: MINI_APP_URL } }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    }
  );
}

// ===========================
// Text input handler (conversational flows)
// ===========================
async function handleTextInput(chatId: number, from: any, text: string) {
  const conv = getConversation(chatId);
  if (!conv) return false; // no active conversation

  // ---- Fact value input ----
  if (conv.step === "awaiting_fact_value") {
    const value = parseFloat(text.replace(",", "."));

    if (isNaN(value) || value < 0) {
      await sendMessage(chatId, "Введите корректное числовое значение (>= 0):", {
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Отмена", callback_data: "cancel_flow" }]],
        },
      });
      return true;
    }

    const { taskId, taskName, unit, userId } = conv.data;
    const today = new Date().toISOString().split("T")[0];

    // Check if log exists for today
    const { data: existingLog } = await supabase
      .from("daily_work_logs")
      .select("id, plan_day, fact_day")
      .eq("task_instance_id", taskId)
      .eq("date", today)
      .maybeSingle();

    let logId: number;
    let accFact = value;

    if (existingLog) {
      // Update existing
      await supabase
        .from("daily_work_logs")
        .update({
          fact_day: value,
          deviation: value - Number(existingLog.plan_day || 0),
          pct_day: Number(existingLog.plan_day) > 0
            ? (value / Number(existingLog.plan_day) * 100)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLog.id);
      logId = existingLog.id;
    } else {
      // Create new
      const { data: newLog } = await supabase
        .from("daily_work_logs")
        .insert({
          task_instance_id: taskId,
          date: today,
          day_of_week: ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"][new Date().getDay()],
          fact_day: value,
          plan_day: 0,
          deviation: value,
          status: "DRAFT",
          created_by: userId,
        })
        .select()
        .single();
      logId = newLog?.id || 0;
    }

    // Recalculate accumulation
    const { data: allLogs } = await supabase
      .from("daily_work_logs")
      .select("fact_day, plan_day")
      .eq("task_instance_id", taskId)
      .lte("date", today);

    if (allLogs) {
      accFact = allLogs.reduce((s: number, l: any) => s + Number(l.fact_day || 0), 0);
      const accPlan = allLogs.reduce((s: number, l: any) => s + Number(l.plan_day || 0), 0);

      // Update TaskInstance
      await supabase
        .from("task_instances")
        .update({
          actual_volume: accFact,
          completion_pct: accPlan > 0 ? Math.min((accFact / accPlan) * 100, 100) : 0,
        })
        .eq("id", taskId);
    }

    // AuditLog
    await supabase.from("audit_logs").insert({
      action: "FACT_ENTERED",
      entity_type: "DailyWorkLog",
      entity_id: logId,
      user_id: userId,
      new_value: { task_id: taskId, date: today, fact_day: value },
    });

    clearConversation(chatId);

    await sendMessage(
      chatId,
      `*Факт записан!*\n\n📋 ${taskName}\n📊 Значение: ${value} ${unit}\n📈 Накопительный факт: ${accFact.toFixed(1)} ${unit}\n📅 Дата: ${today}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📝 Ещё факт", callback_data: "enter_fact" },
              { text: "📋 Мои задачи", callback_data: "my_tasks" },
            ],
            [{ text: "🔙 Меню", callback_data: "main_menu" }],
          ],
        },
      }
    );
    return true;
  }

  // ---- Defect description input ----
  if (conv.step === "defect_enter_description") {
    const { projectId, userId, facadeId, severity } = conv.data;

    // Create defect task instance
    const { data: defect, error } = await supabase
      .from("task_instances")
      .insert({
        project_id: projectId,
        type: "DEFECT",
        status: "CREATED",
        facade_id: facadeId,
        priority: severity,
        notes: text,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      await sendMessage(chatId, "Ошибка создания дефекта. Попробуйте позже.");
      clearConversation(chatId);
      return true;
    }

    // AuditLog
    await supabase.from("audit_logs").insert({
      action: "DEFECT_REPORTED",
      entity_type: "TaskInstance",
      entity_id: defect.id,
      user_id: userId,
      new_value: { type: "DEFECT", facade_id: facadeId, priority: severity, notes: text },
    });

    // Notify site_manager
    const { data: facade } = await supabase.from("facades").select("name").eq("id", facadeId).maybeSingle();
    const severityLabels: Record<string, string> = { HIGH: "КРИТИЧЕСКИЙ", MEDIUM: "Обычный", LOW: "Незначительный" };

    await notifyByRole(
      projectId,
      "site_manager",
      `*Новый дефект зафиксирован!*\n\n` +
        `Фасад: ${facade?.name || "—"}\n` +
        `Критичность: ${severityLabels[severity] || severity}\n` +
        `Описание: ${text.substring(0, 200)}\n\n` +
        `Создал: ${(await supabase.from("users").select("first_name").eq("id", userId).maybeSingle()).data?.first_name || "—"}`,
      [
        [
          { text: "✅ Принять", callback_data: `accept:task:${defect.id}` },
          { text: "📱 Подробнее", web_app: { url: `${MINI_APP_URL}?startapp=task_${defect.id}` } },
        ],
      ]
    );

    if (severity === "HIGH") {
      await notifyByRole(
        projectId,
        "project_director",
        `*КРИТИЧЕСКИЙ ДЕФЕКТ:*\nФасад: ${facade?.name || "—"}\n${text.substring(0, 200)}`
      );
    }

    clearConversation(chatId);

    // Ask if user wants to attach a photo
    setConversation(chatId, "defect_optional_photo", { defectId: defect.id, projectId });

    await sendMessage(
      chatId,
      `*Дефект зафиксирован!* (#${defect.id})\n\nХотите приложить фото?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📷 Приложить фото", callback_data: `defect_photo:${defect.id}` }],
            [
              { text: "📋 Мои задачи", callback_data: "my_tasks" },
              { text: "🔙 Меню", callback_data: "main_menu" },
            ],
          ],
        },
      }
    );
    return true;
  }

  return false;
}

// ===========================
// Photo handler
// ===========================
async function handlePhoto(chatId: number, from: any, message: any) {
  const user = await getUser(from.id);
  if (!user || user.status !== "ACTIVE") {
    await sendMessage(chatId, "Используйте /start для авторизации.");
    return;
  }

  const conv = getConversation(chatId);
  const photos = message.photo;
  if (!photos || photos.length === 0) return;

  // Get the largest photo
  const photo = photos[photos.length - 1];
  const fileUrl = await getFile(photo.file_id);
  if (!fileUrl) {
    await sendMessage(chatId, "Не удалось загрузить фото. Попробуйте ещё раз.");
    return;
  }

  // Determine context
  let entityType = "TaskInstance";
  let entityId: number | null = null;
  let projectId = 1;

  if (conv?.step === "defect_optional_photo" || conv?.step === "defect_enter_description") {
    entityId = conv.data.defectId || null;
    projectId = conv.data.projectId || 1;
  } else if (conv?.step === "awaiting_photo_for_task") {
    entityId = conv.data.taskId || null;
    projectId = conv.data.projectId || 1;
  } else {
    // Photo without context — ask what it's for
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("project_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    projectId = userRole?.project_id || 1;
  }

  // Save document record
  const caption = message.caption || "";
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      project_id: projectId,
      name: `photo_${Date.now()}.jpg`,
      type: "PHOTO",
      url: fileUrl,
      size_bytes: photo.file_size || 0,
      status: "DRAFT",
      entity_type: entityType,
      entity_id: entityId,
      task_instance_id: entityId,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Photo save error:", error);
    await sendMessage(chatId, "Ошибка сохранения фото.");
    return;
  }

  // AuditLog
  await supabase.from("audit_logs").insert({
    action: "PHOTO_UPLOADED",
    entity_type: "Document",
    entity_id: doc.id,
    user_id: user.id,
    new_value: {
      file_id: photo.file_id,
      entity_type: entityType,
      entity_id: entityId,
      caption,
    },
  });

  clearConversation(chatId);

  await sendMessage(
    chatId,
    `Фото сохранено!${entityId ? `\nПривязано к задаче #${entityId}` : ""}${caption ? `\nПодпись: ${caption}` : ""}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Мои задачи", callback_data: "my_tasks" }],
          [{ text: "🔙 Меню", callback_data: "main_menu" }],
        ],
      },
    }
  );
}

// ===========================
// Notify helpers
// ===========================
async function notifyAdmins(newUser: any) {
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id, users!user_roles_user_id_fkey(telegram_id)")
    .eq("role_id", 9); // admin role id

  if (!adminRoles || adminRoles.length === 0) {
    // No admins found — try project_director (role_id = 1)
    const { data: directors } = await supabase
      .from("user_roles")
      .select("user_id, users!user_roles_user_id_fkey(telegram_id)")
      .eq("role_id", 1);

    if (directors) {
      for (const d of directors) {
        const tgId = (d as any).users?.telegram_id;
        if (!tgId) continue;
        await sendNewUserNotification(Number(tgId), newUser);
      }
    }
    return;
  }

  for (const ar of adminRoles) {
    const tgId = (ar as any).users?.telegram_id;
    if (!tgId) continue;
    await sendNewUserNotification(Number(tgId), newUser);
  }
}

async function sendNewUserNotification(tgId: number, newUser: any) {
  await sendMessage(
    tgId,
    `*Новый пользователь:*\n` +
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
    }
  );
}

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
      await sendMessage(Number(tgId), text, buttons ? { reply_markup: { inline_keyboard: buttons } } : undefined);
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

    // Handle commands and text
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const from = update.message.from;

      // Handle photos
      if (update.message.photo) {
        await handlePhoto(chatId, from, update.message);
        return new Response("OK", { status: 200 });
      }

      // Handle text
      if (text) {
        // Commands
        if (text === "/start" || text.startsWith("/start ")) {
          clearConversation(chatId);
          const startParam = text.split(" ")[1] || undefined;
          await handleStart(chatId, from, startParam);
        } else if (text === "/help") {
          await handleHelp(chatId);
        } else if (text === "/tasks") {
          await handleTasks(chatId, from);
        } else if (text === "/fact") {
          await handleFact(chatId, from);
        } else if (text === "/defect") {
          await handleDefect(chatId, from);
        } else if (text === "/menu") {
          await handleMenu(chatId, from);
        } else {
          // Try conversational input
          const handled = await handleTextInput(chatId, from, text);
          if (!handled) {
            // Unknown text — suggest help
            await sendMessage(
              chatId,
              "Не понял команду. Используйте /help для списка команд или /menu для главного меню."
            );
          }
        }
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
