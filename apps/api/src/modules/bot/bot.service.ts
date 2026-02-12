import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard, Context } from 'grammy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class BotService implements OnModuleInit {
  public bot: Bot;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private authService: AuthService,
  ) {
    const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Bot(token);
  }

  async onModuleInit() {
    this.registerHandlers();
    console.log('[Bot] Handlers registered');
  }

  private registerHandlers() {
    // --- /start ---
    this.bot.command('start', async (ctx) => {
      await this.handleStart(ctx);
    });

    // --- /fact ---
    this.bot.command('fact', async (ctx) => {
      await this.handleFactCommand(ctx);
    });

    // --- /defect ---
    this.bot.command('defect', async (ctx) => {
      await this.handleDefectCommand(ctx);
    });

    // --- /help ---
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '📋 *Команды STSphera Bot*\n\n' +
          '/start — Регистрация / главное меню\n' +
          '/fact — Быстрый ввод факта\n' +
          '/defect — Фиксация дефекта\n' +
          '/help — Список команд',
        { parse_mode: 'Markdown' },
      );
    });

    // --- Callback queries (inline buttons) ---
    this.bot.on('callback_query:data', async (ctx) => {
      await this.handleCallback(ctx);
    });

    // --- Error handler ---
    this.bot.catch((err) => {
      console.error('[Bot] Error:', err);
    });
  }

  /**
   * /start — REQ-BOT-001
   */
  private async handleStart(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const { user, isNew } = await this.authService.findOrCreateByTelegramId(
      from.id,
      from.first_name,
      from.last_name,
      from.username,
    );

    if (isNew) {
      // Notify user
      await ctx.reply(
        `Добро пожаловать в *STSphera*, ${from.first_name}! 🏗\n\n` +
          'Ваша заявка на рассмотрении. Администратор назначит вам роль.',
        { parse_mode: 'Markdown' },
      );

      // Notify admins
      await this.notifyAdminsNewUser(user);

      // AuditLog
      await this.prisma.auditLog.create({
        data: {
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: user.id,
          userId: user.id,
          newValue: {
            telegramId: Number(user.telegramId),
            firstName: user.firstName,
            username: user.username,
          },
        },
      });
    } else if (user.status === 'PENDING') {
      await ctx.reply(
        'Ваша заявка ещё на рассмотрении. Ожидайте назначения роли.',
      );
    } else if (user.status === 'BLOCKED') {
      await ctx.reply('Ваш аккаунт заблокирован. Обратитесь к администратору.');
    } else {
      // Active user — show main menu
      await this.showMainMenu(ctx, user);
    }
  }

  /**
   * Main menu — inline keyboard
   */
  private async showMainMenu(ctx: Context, user: any) {
    const roleName = user.userRoles?.[0]?.role?.displayName || 'Пользователь';
    const miniAppUrl = this.config.get('MINI_APP_URL', 'https://t.me/STSpheraBot/app');

    const keyboard = new InlineKeyboard()
      .text('📋 Мои задачи', 'my_tasks')
      .text('📝 Ввести факт', 'enter_fact')
      .row()
      .text('🔴 Дефект', 'report_defect')
      .url('📱 Приложение', miniAppUrl);

    await ctx.reply(
      `*STSphera* — ${roleName}\n\nВыберите действие:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    );
  }

  /**
   * /fact — REQ-BOT-002 (start dialog)
   */
  private async handleFactCommand(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user || user.status !== 'ACTIVE') {
      await ctx.reply('Вы не авторизованы. Используйте /start');
      return;
    }

    // Find active tasks assigned to user
    const tasks = await this.prisma.taskInstance.findMany({
      where: {
        assigneeId: user.id,
        status: 'IN_PROGRESS',
      },
      take: 10,
      orderBy: { plannedEnd: 'asc' },
      include: { template: true },
    });

    if (tasks.length === 0) {
      await ctx.reply('У вас нет активных задач.');
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const task of tasks) {
      const name = task.template?.name || `Задача #${task.id}`;
      keyboard.text(
        name.length > 40 ? name.substring(0, 37) + '...' : name,
        `enter_fact:task:${task.id}`,
      );
      keyboard.row();
    }

    await ctx.reply('Выберите задачу для ввода факта:', {
      reply_markup: keyboard,
    });
  }

  /**
   * /defect — REQ-BOT-004 (start dialog)
   */
  private async handleDefectCommand(ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user || user.status !== 'ACTIVE') {
      await ctx.reply('Вы не авторизованы. Используйте /start');
      return;
    }

    // Get facades for the user's project
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId: user.id },
    });

    if (!userRole) {
      await ctx.reply('Вам не назначен проект.');
      return;
    }

    const facades = await this.prisma.facade.findMany({
      where: { projectId: userRole.projectId },
      orderBy: { name: 'asc' },
    });

    if (facades.length === 0) {
      await ctx.reply('В проекте нет фасадов.');
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const facade of facades) {
      keyboard.text(facade.name, `defect_facade:${facade.id}`);
      keyboard.row();
    }

    await ctx.reply('Фиксация дефекта. Выберите фасад/зону:', {
      reply_markup: keyboard,
    });
  }

  /**
   * Handle callback queries — REQ-BOT-005
   */
  private async handleCallback(ctx: Context) {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const from = ctx.from;
    if (!from) return;

    const [action, entityType, entityId] = data.split(':');

    try {
      switch (action) {
        case 'accept': {
          await this.handleAcceptTask(ctx, Number(entityId), from.id);
          break;
        }
        case 'my_tasks': {
          await this.handleMyTasks(ctx, from.id);
          break;
        }
        case 'enter_fact': {
          if (entityType === 'task') {
            await ctx.answerCallbackQuery({
              text: 'Введите числовое значение факта в ответном сообщении',
            });
            // TODO: set conversation state for fact entry
          } else {
            await this.handleFactCommand(ctx);
          }
          break;
        }
        case 'report_defect': {
          await this.handleDefectCommand(ctx);
          break;
        }
        default: {
          await ctx.answerCallbackQuery({ text: 'Действие обработано' });
        }
      }
    } catch (error) {
      console.error('[Bot] Callback error:', error);
      await ctx.answerCallbackQuery({
        text: 'Произошла ошибка. Попробуйте позже.',
      });
    }
  }

  /**
   * Accept task — callback handler
   */
  private async handleAcceptTask(
    ctx: Context,
    taskId: number,
    telegramId: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
      return;
    }

    const task = await this.prisma.taskInstance.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      await ctx.answerCallbackQuery({ text: 'Задача не найдена' });
      return;
    }

    if (task.status !== 'ASSIGNED') {
      await ctx.answerCallbackQuery({ text: 'Задача уже в работе' });
      return;
    }

    await this.prisma.taskInstance.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'TASK_STATUS_CHANGED',
        entityType: 'TaskInstance',
        entityId: taskId,
        userId: user.id,
        oldValue: { status: 'ASSIGNED' },
        newValue: { status: 'IN_PROGRESS' },
      },
    });

    await ctx.answerCallbackQuery({ text: '✅ Задача принята в работу' });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  }

  /**
   * Show user's tasks
   */
  private async handleMyTasks(ctx: Context, telegramId: number) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
      return;
    }

    const tasks = await this.prisma.taskInstance.findMany({
      where: {
        assigneeId: user.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      take: 10,
      orderBy: { plannedEnd: 'asc' },
      include: { template: true },
    });

    if (tasks.length === 0) {
      await ctx.answerCallbackQuery({ text: 'Нет активных задач' });
      return;
    }

    const lines = tasks.map((t, i) => {
      const name = t.template?.name || `Задача #${t.id}`;
      const status = t.status === 'ASSIGNED' ? '🔵' : '🟢';
      const deadline = t.plannedEnd
        ? t.plannedEnd.toISOString().split('T')[0]
        : '—';
      return `${status} ${i + 1}. ${name}\n   Срок: ${deadline}`;
    });

    await ctx.answerCallbackQuery();
    await ctx.reply(`📋 *Ваши задачи:*\n\n${lines.join('\n\n')}`, {
      parse_mode: 'Markdown',
    });
  }

  /**
   * Notify admins about new user registration
   */
  private async notifyAdminsNewUser(user: any) {
    const admins = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: { role: { systemName: 'admin' } },
        },
      },
    });

    const keyboard = new InlineKeyboard().text(
      'Назначить роль',
      `assign_role:user:${user.id}`,
    );

    const text =
      `👤 Новый пользователь:\n` +
      `Имя: ${user.firstName || ''} ${user.lastName || ''}\n` +
      `Username: @${user.username || '—'}\n` +
      `TG ID: ${user.telegramId}\n\n` +
      `Требуется назначение роли.`;

    for (const admin of admins) {
      try {
        await this.bot.api.sendMessage(Number(admin.telegramId), text, {
          reply_markup: keyboard,
        });
      } catch (err) {
        console.error(
          `[Bot] Failed to notify admin ${admin.telegramId}:`,
          err,
        );
      }
    }
  }

  /**
   * Send notification message to a user (used by NotificationService)
   */
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
}
