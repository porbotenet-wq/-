// STSphera — Telegram Bot Webhook (Supabase Edge Function)
// Handles: /start, /help, /app, /tasks, /fact, /defect, callbacks

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

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
// Command handlers
// ===========================
function parseStartContext(startParam?: string): MiniAppContext | null {
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

  if (user.status === "PENDING") {
    await sendMessage(chatId, "Ваша заявка на рассмотрении. Ожидайте назначения роли. ⏳");
    return;
  }

  if (user.status === "BLOCKED") {
    await sendMessage(chatId, "Ваш аккаунт заблокирован. Обратитесь к администратору. 🚫");
    return;
  }

  // Active user — main menu
  const role = user.user_roles?.[0]?.roles;
  const roleName = role?.display_name || "Пользователь";
  const isAdmin = role?.system_name === "admin" || role?.system_name === "project_director";

  const buttons: any[][] = [
    [
      { text: "📋 Мои задачи", callback_data: "my_tasks" },
      { text: "📝 Ввести факт", callback_data: "enter_fact" },
    ],
    [
      { text: "🔴 Дефект", callback_data: "report_defect" },
      { text: "📊 Сводка", callback_data: "summary" },
    ],
  ];

  const miniAppButton = createMiniAppButton("📱 Приложение", { screen: "dashboard" });
  if (miniAppButton) {
    buttons.push([miniAppButton]);
  } else {
    buttons.push([{ text: "📱 Приложение", callback_data: "open_app" }]);
  }

  // Admin gets extra buttons
  if (isAdmin) {
    buttons.push([
      { text: "🏗 Настроить демо-объект", callback_data: "setup_demo" },
    ]);
  }

  await sendMessage(
    chatId,
    `🏗 *STSphera — ${roleName}*\n📁 Проект: СИТИ-4\n\nВыберите действие:`,
    {
      reply_markup: { inline_keyboard: buttons },
    }
  );

  const startContext = parseStartContext(startParam);
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

// ===========================
// Callback handlers
// ===========================
async function handleCallback(callbackQuery: any) {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;
  const from = callbackQuery.from;

  await answerCallback(callbackQuery.id);

  if (!chatId || !data) return;

  if (data === "my_tasks") {
    await handleTasks(chatId, from);
  } else if (data === "enter_fact") {
    await handleFact(chatId, from);
  } else if (data === "report_defect") {
    await handleDefect(chatId, from);
  } else if (data === "open_app") {
    await handleApp(chatId, from, { screen: "dashboard" });
  } else if (data.startsWith("fact_select:")) {
    const taskId = Number(data.split(":")[1]);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      await sendMessage(chatId, "Некорректный ID задачи.");
      return;
    }

    await sendMiniAppButton(
      chatId,
      `📝 Переход к вводу факта по задаче #${taskId}:`,
      {
        screen: "plan-fact",
        taskId,
        date: getTodayIsoDate(),
        startapp: `task_${taskId}`,
      },
    );
  } else if (data.startsWith("defect_facade:")) {
    const facadeId = Number(data.split(":")[1]);
    if (!Number.isFinite(facadeId) || facadeId <= 0) {
      await sendMessage(chatId, "Некорректный ID фасада.");
      return;
    }

    await sendMiniAppButton(
      chatId,
      `🔴 Переход к фиксации дефекта по фасаду #${facadeId}:`,
      {
        screen: "tasks",
        facadeId,
        mode: "defect",
        startapp: `defect_facade_${facadeId}`,
      },
    );
  } else if (data === "summary") {
    const { count: taskCount } = await supabase.from("task_instances").select("id", { count: "exact", head: true });
    const { count: userCount } = await supabase.from("users").select("id", { count: "exact", head: true });
    const { count: rolePermCount } = await supabase.from("role_permissions").select("id", { count: "exact", head: true });
    const { count: facadeCount } = await supabase.from("facades").select("id", { count: "exact", head: true });

    await sendMessage(
      chatId,
      `📊 *Сводка СИТИ-4:*\n\n` +
        `👥 Пользователей: ${userCount}\n` +
        `📋 Задач: ${taskCount || 0}\n` +
        `🏢 Фасадов: ${facadeCount || 0}\n` +
        `🔐 RBAC маппингов: ${rolePermCount}\n` +
        `✅ БД: 24 таблицы`
    );
    await sendMiniAppButton(chatId, "Откройте Mini App для детальной аналитики:", {
      screen: "dashboard",
    });
  } else if (data.startsWith("accept:task:")) {
    const taskId = Number(data.split(":")[2]);
    const user = await getUser(from.id);
    if (!user) return;

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

    await sendMessage(chatId, "✅ Задача принята в работу!");
  } else if (data.startsWith("accept_all:")) {
    const taskIds = data.replace("accept_all:", "").split(",").map(Number);
    const user = await getUser(from.id);
    if (!user) return;

    for (const taskId of taskIds) {
      await supabase
        .from("task_instances")
        .update({ status: "IN_PROGRESS", actual_start: new Date().toISOString().split("T")[0] })
        .eq("id", taskId)
        .eq("assignee_id", user.id);
    }

    await supabase.from("audit_logs").insert({
      action: "TASKS_ACCEPTED_BULK",
      entity_type: "TaskInstance",
      user_id: user.id,
      new_value: { task_ids: taskIds, count: taskIds.length },
    });

    await sendMessage(chatId, `✅ Принято задач: ${taskIds.length}. Все в работе!`);
  } else if (data === "setup_demo") {
    await sendMessage(chatId, "⏳ Настраиваю демо-объект СИТИ-4...\nФасады, задачи, модули...");

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
              [{ text: "📋 Мои задачи", callback_data: "my_tasks" },
               { text: "📊 Сводка", callback_data: "summary" }],
            ],
          },
        }
      );
    } else {
      await sendMessage(chatId, "❌ Ошибка настройки: " + (result.error || "неизвестная"));
    }
  } else if (data.startsWith("view_tasks:")) {
    await sendMiniAppButton(chatId, "📋 Откройте задачи в Mini App:", {
      screen: "tasks",
      startapp: "tasks",
    });
  } else if (data.startsWith("create_tasks:")) {
    await sendMiniAppButton(chatId, "📋 Откройте Mini App для управления задачами:", {
      screen: "tasks",
      startapp: "tasks",
    });
  } else if (data.startsWith("view_modules:")) {
    await sendMiniAppButton(chatId, "📦 Откройте модули в Mini App:", {
      screen: "modules",
      startapp: "modules",
    });
  }
}

// ===========================
// Notify admins
// ===========================
async function notifyAdmins(newUser: any) {
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id, users!user_roles_user_id_fkey(telegram_id)")
    .eq("role_id", 9); // admin role id

  if (!adminRoles) return;

  for (const ar of adminRoles) {
    const tgId = (ar as any).users?.telegram_id;
    if (!tgId) continue;

    await sendMessage(
      Number(tgId),
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
      }
    );
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
