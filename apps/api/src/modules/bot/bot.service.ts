import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard, Context, webhookCallback } from 'grammy';
import { SupabaseService } from '../../common/supabase/supabase.service';

@Injectable()
export class BotService implements OnModuleInit {
  public bot: Bot;
  private supabase;

  constructor(
    private config: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Bot(token);
    this.supabase = this.supabaseService.getAdminClient();
  }

  async onModuleInit() {
    this.registerHandlers();

    // Use polling in development (no webhook needed)
    if (this.config.get('NODE_ENV') !== 'production') {
      try {
        await this.bot.api.deleteWebhook();
        this.bot.start({
          onStart: () => console.log('[Bot] Started with long polling'),
        });
      } catch (err) {
        console.error('[Bot] Failed to start polling:', (err as Error).message);
      }
    }
  }

  private registerHandlers() {
    // --- /start --- REQ-BOT-001
    this.bot.command('start', (ctx) => this.handleStart(ctx));

    // --- /fact --- REQ-BOT-002
    this.bot.command('fact', (ctx) => this.handleFactCommand(ctx));

    // --- /defect --- REQ-BOT-004
    this.bot.command('defect', (ctx) => this.handleDefectCommand(ctx));

    // --- /help ---
    this.bot.command('help', (ctx) =>
      ctx.reply(
        '📋 *Команды STSphera Bot*\n\n' +
          '/start — Регистрация / главное меню\n' +
          '/fact — Быстрый ввод факта\n' +
          '/defect — Фиксация дефекта\n' +
          '/tasks — Мои задачи\n' +
          '/help — Список команд',
        { parse_mode: 'Markdown' },
      ),
    );

    // --- /tasks ---
    this.bot.command('tasks', (ctx) => this.handleMyTasks(ctx));

    // --- Callback queries (inline buttons) --- REQ-BOT-005
    this.bot.on('callback_query:data', (ctx) => this.handleCallback(ctx));

    // --- Error handler ---
    this.bot.catch((err) => {
      console.error('[Bot] Error:', err.message || err);
    });

    console.log('[Bot] Handlers registered');
  }

  // =========================================
  // /start — REQ-BOT-001
  // =========================================
  private async handleStart(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    try {
      // Check if user exists
      const { data: existing } = await this.supabase
        .from('users')
        .select('*, user_roles!user_roles_user_id_fkey(*, roles(*))')
        .eq('telegram_id', from.id)
        .maybeSingle();

      if (!existing) {
        // Create new user
        const { data: newUser, error } = await this.supabase
          .from('users')
          .insert({
            telegram_id: from.id,
            first_name: from.first_name || null,
            last_name: from.last_name || null,
            username: from.username || null,
            status: 'PENDING',
          })
          .select()
          .single();

        if (error) {
          console.error('[Bot] Create user error:', error);
          await ctx.reply('Ошибка регистрации. Попробуйте позже.');
          return;
        }

        // Welcome message
        await ctx.reply(
          `Добро пожаловать в *STSphera*, ${from.first_name}! 🏗\n\n` +
            'Ваша заявка на рассмотрении. Администратор назначит вам роль.',
          { parse_mode: 'Markdown' },
        );

        // Notify admins
        await this.notifyAdminsNewUser(newUser);

        // AuditLog
        await this.supabase.from('audit_logs').insert({
          action: 'USER_REGISTERED',
          entity_type: 'User',
          entity_id: newUser.id,
          user_id: newUser.id,
          new_value: {
            telegram_id: from.id,
            first_name: from.first_name,
            username: from.username,
          },
        });

        return;
      }

      // Existing user
      if (existing.status === 'PENDING') {
        await ctx.reply(
          'Ваша заявка ещё на рассмотрении. Ожидайте назначения роли. ⏳',
        );
      } else if (existing.status === 'BLOCKED') {
        await ctx.reply(
          'Ваш аккаунт заблокирован. Обратитесь к администратору. 🚫',
        );
      } else {
        // Active user — show main menu
        await this.showMainMenu(ctx, existing);
      }
    } catch (err) {
      console.error('[Bot] /start error:', err);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  }

  // =========================================
  // Main menu
  // =========================================
  private async showMainMenu(ctx: Context, user: any) {
    const role = user.user_roles?.[0]?.roles;
    const roleName = role?.display_name || 'Пользователь';
    const miniAppUrl = this.config.get(
      'MINI_APP_URL',
      'https://t.me/STSpheraBot/app',
    );

    const keyboard = new InlineKeyboard()
      .text('📋 Мои задачи', 'my_tasks')
      .text('📝 Ввести факт', 'enter_fact')
      .row()
      .text('🔴 Дефект', 'report_defect')
      .url('📱 Приложение', miniAppUrl);

    await ctx.reply(`*STSphera* — ${roleName}\n\nВыберите действие:`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // =========================================
  // /fact — REQ-BOT-002
  // =========================================
  private async handleFactCommand(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const user = await this.getActiveUser(from.id);
    if (!user) {
      await ctx.reply('Вы не авторизованы. Используйте /start');
      return;
    }

    // Find active tasks assigned to user
    const { data: tasks } = await this.supabase
      .from('task_instances')
      .select('id, status, planned_end, task_templates(name)')
      .eq('assignee_id', user.id)
      .eq('status', 'IN_PROGRESS')
      .order('planned_end', { ascending: true })
      .limit(10);

    if (!tasks || tasks.length === 0) {
      await ctx.reply('У вас нет активных задач.');
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const task of tasks) {
      const name =
        task.task_templates?.name || `Задача #${task.id}`;
      keyboard.text(
        name.length > 40 ? name.substring(0, 37) + '...' : name,
        `fact_select:${task.id}`,
      );
      keyboard.row();
    }

    await ctx.reply('Выберите задачу для ввода факта:', {
      reply_markup: keyboard,
    });
  }

  // =========================================
  // /defect — REQ-BOT-004
  // =========================================
  private async handleDefectCommand(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const user = await this.getActiveUser(from.id);
    if (!user) {
      await ctx.reply('Вы не авторизованы. Используйте /start');
      return;
    }

    // Get user's project
    const { data: userRole } = await this.supabase
      .from('user_roles')
      .select('project_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!userRole) {
      await ctx.reply('Вам не назначен проект.');
      return;
    }

    // Get facades
    const { data: facades } = await this.supabase
      .from('facades')
      .select('id, name')
      .eq('project_id', userRole.project_id)
      .order('name');

    if (!facades || facades.length === 0) {
      await ctx.reply(
        'В проекте нет фасадов. Добавьте фасады через импорт или Mini App.',
      );
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const facade of facades) {
      keyboard.text(facade.name, `defect_facade:${facade.id}`);
      keyboard.row();
    }

    await ctx.reply('🔴 Фиксация дефекта. Выберите фасад/зону:', {
      reply_markup: keyboard,
    });
  }

  // =========================================
  // /tasks
  // =========================================
  private async handleMyTasks(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const user = await this.getActiveUser(from.id);
    if (!user) {
      await ctx.reply('Вы не авторизованы. Используйте /start');
      return;
    }

    const { data: tasks } = await this.supabase
      .from('task_instances')
      .select('id, status, planned_end, priority, completion_pct, task_templates(name)')
      .eq('assignee_id', user.id)
      .in('status', ['ASSIGNED', 'IN_PROGRESS'])
      .order('planned_end', { ascending: true })
      .limit(10);

    if (!tasks || tasks.length === 0) {
      await ctx.reply('У вас нет активных задач. ✅');
      return;
    }

    const statusIcon: Record<string, string> = {
      ASSIGNED: '🔵',
      IN_PROGRESS: '🟢',
    };

    const lines = tasks.map((t: any, i: number) => {
      const name = t.task_templates?.name || `Задача #${t.id}`;
      const icon = statusIcon[t.status] || '⚪';
      const deadline = t.planned_end || '—';
      const pct = Number(t.completion_pct || 0).toFixed(0);
      return `${icon} ${i + 1}. *${name}*\n   Срок: ${deadline} | ${pct}%`;
    });

    const keyboard = new InlineKeyboard()
      .text('📝 Ввести факт', 'enter_fact')
      .text('📱 Открыть в приложении', 'open_app');

    await ctx.reply(`📋 *Ваши задачи (${tasks.length}):*\n\n${lines.join('\n\n')}`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // =========================================
  // Callback handler — REQ-BOT-005
  // =========================================
  private async handleCallback(ctx: Context) {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    const from = ctx.from;
    if (!from) return;

    try {
      const parts = data.split(':');
      const action = parts[0];

      switch (action) {
        case 'accept': {
          const taskId = Number(parts[2]);
          await this.handleAcceptTask(ctx, taskId, from.id);
          break;
        }
        case 'my_tasks': {
          await ctx.answerCallbackQuery();
          await this.handleMyTasks(ctx);
          break;
        }
        case 'enter_fact': {
          await ctx.answerCallbackQuery();
          await this.handleFactCommand(ctx);
          break;
        }
        case 'fact_select': {
          const taskId = Number(parts[1]);
          await ctx.answerCallbackQuery({
            text: `Введите числовое значение факта в ответном сообщении`,
          });
          // Store state for next message
          // TODO: implement conversation state via Redis
          break;
        }
        case 'report_defect': {
          await ctx.answerCallbackQuery();
          await this.handleDefectCommand(ctx);
          break;
        }
        case 'open_app': {
          const miniAppUrl = this.config.get('MINI_APP_URL', 'https://t.me/STSpheraBot/app');
          await ctx.answerCallbackQuery({ url: miniAppUrl });
          break;
        }
        default: {
          await ctx.answerCallbackQuery({ text: '✅ Действие обработано' });
        }
      }
    } catch (error) {
      console.error('[Bot] Callback error:', error);
      await ctx.answerCallbackQuery({
        text: 'Произошла ошибка. Попробуйте позже.',
      });
    }
  }

  // =========================================
  // Accept task callback
  // =========================================
  private async handleAcceptTask(
    ctx: Context,
    taskId: number,
    telegramId: number,
  ) {
    const user = await this.getActiveUser(telegramId);
    if (!user) {
      await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
      return;
    }

    const { data: task } = await this.supabase
      .from('task_instances')
      .select('id, status')
      .eq('id', taskId)
      .single();

    if (!task) {
      await ctx.answerCallbackQuery({ text: 'Задача не найдена' });
      return;
    }

    if (task.status !== 'ASSIGNED') {
      await ctx.answerCallbackQuery({ text: 'Задача уже в работе или завершена' });
      return;
    }

    await this.supabase
      .from('task_instances')
      .update({ status: 'IN_PROGRESS', actual_start: new Date().toISOString().split('T')[0] })
      .eq('id', taskId);

    await this.supabase.from('audit_logs').insert({
      action: 'TASK_STATUS_CHANGED',
      entity_type: 'TaskInstance',
      entity_id: taskId,
      user_id: user.id,
      old_value: { status: 'ASSIGNED' },
      new_value: { status: 'IN_PROGRESS' },
    });

    await ctx.answerCallbackQuery({ text: '✅ Задача принята в работу' });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  }

  // =========================================
  // Notify admins about new user
  // =========================================
  private async notifyAdminsNewUser(user: any) {
    // Find admin users
    const { data: adminRoles } = await this.supabase
      .from('user_roles')
      .select('user_id, users(telegram_id)')
      .eq('roles.system_name', 'admin');

    // Also find direct admin users
    const { data: admins } = await this.supabase
      .from('users')
      .select('telegram_id')
      .eq('status', 'ACTIVE')
      .not('telegram_id', 'is', null);

    // For MVP: notify all active users who are admins
    // Since we don't have admins yet, just log
    console.log(
      `[Bot] New user registered: ${user.first_name} (@${user.username}) TG:${user.telegram_id}`,
    );

    const keyboard = new InlineKeyboard().text(
      '👤 Назначить роль',
      `assign_role:user:${user.id}`,
    );

    const text =
      `👤 *Новый пользователь:*\n` +
      `Имя: ${user.first_name || ''} ${user.last_name || ''}\n` +
      `Username: @${user.username || '—'}\n` +
      `TG ID: \`${user.telegram_id}\`\n\n` +
      `Требуется назначение роли.`;

    // Try to notify admins (if any exist)
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        try {
          await this.bot.api.sendMessage(
            Number(admin.telegram_id),
            text,
            { parse_mode: 'Markdown', reply_markup: keyboard },
          );
        } catch (err) {
          // Admin might not have started the bot yet
        }
      }
    }
  }

  // =========================================
  // Send notification to user (for NotificationService)
  // =========================================
  async sendNotification(
    telegramId: number,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<number | null> {
    try {
      const msg = await this.bot.api.sendMessage(telegramId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return msg.message_id;
    } catch (err) {
      console.error(`[Bot] Failed to send to ${telegramId}:`, err);
      return null;
    }
  }

  // =========================================
  // Helpers
  // =========================================
  private async getActiveUser(telegramId: number) {
    const { data } = await this.supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    return data;
  }
}
