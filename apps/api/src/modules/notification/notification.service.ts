import { Injectable } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { AuditService } from '../audit/audit.service';

type TriggerScenarioInput = {
  code: string;
  payload?: Record<string, string | number | null | undefined>;
  projectId?: number;
  entityType?: string;
  entityId?: number;
  taskInstanceId?: number;
  actorUserId?: number;
  recipientUserIds?: number[];
};

type TriggerScenarioResult = {
  code: string;
  sent: number;
  failed: number;
  skipped: number;
  recipients: number;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function getRoleList(recipientsConfig: unknown): string[] {
  if (!recipientsConfig || typeof recipientsConfig !== 'object') {
    return [];
  }
  return toStringArray((recipientsConfig as Record<string, unknown>).roles);
}

function getEscalateRole(escalationConfig: unknown): string | null {
  if (!escalationConfig || typeof escalationConfig !== 'object') {
    return null;
  }

  const value = (escalationConfig as Record<string, unknown>).escalateToRole;
  return typeof value === 'string' && value ? value : null;
}

function getButtonPatterns(buttonsConfig: unknown): string[] {
  if (!buttonsConfig || typeof buttonsConfig !== 'object') {
    return [];
  }
  return toStringArray((buttonsConfig as Record<string, unknown>).buttons);
}

function isSameDate(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private botService: BotService,
    private auditService: AuditService,
  ) {}

  async listScenarios() {
    return this.prisma.notificationScenario.findMany({
      include: { messageTemplate: true },
      orderBy: { code: 'asc' },
    });
  }

  async triggerScenario(input: TriggerScenarioInput): Promise<TriggerScenarioResult> {
    const scenario = await this.prisma.notificationScenario.findUnique({
      where: { code: input.code },
      include: { messageTemplate: true },
    });

    if (!scenario || !scenario.isActive) {
      return { code: input.code, sent: 0, failed: 0, skipped: 1, recipients: 0 };
    }

    const recipients = await this.resolveRecipients({
      roles: getRoleList(scenario.recipientsConfig),
      projectId: input.projectId,
      recipientUserIds: input.recipientUserIds,
    });

    if (recipients.length === 0) {
      return { code: input.code, sent: 0, failed: 0, skipped: 1, recipients: 0 };
    }

    const payload = input.payload || {};
    const templateText = scenario.messageTemplate?.templateText || scenario.taskName;
    const messageText = this.renderTemplate(templateText, payload);
    const keyboard = this.buildKeyboard(scenario.buttonsConfig, payload);

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const messageId = await this.botService.sendNotification(
        Number(recipient.telegramId),
        messageText,
        keyboard || undefined,
      );

      const status = messageId ? 'SENT' : 'FAILED';
      if (messageId) sent += 1;
      else failed += 1;

      await this.prisma.notificationLog.create({
        data: {
          scenarioId: scenario.id,
          userId: recipient.id,
          entityType: input.entityType,
          entityId: input.entityId,
          taskInstanceId: input.taskInstanceId,
          messageText,
          buttonsJson: scenario.buttonsConfig || undefined,
          status,
          telegramMessageId: messageId ? BigInt(messageId) : undefined,
          sentAt: messageId ? new Date() : undefined,
        },
      });
    }

    await this.auditService.log({
      action: 'NOTIFICATION_DISPATCHED',
      entityType: input.entityType || 'NotificationScenario',
      entityId: input.entityId,
      userId: input.actorUserId,
      newValue: {
        scenario: input.code,
        recipients: recipients.length,
        sent,
        failed,
      },
    });

    return {
      code: input.code,
      sent,
      failed,
      skipped: 0,
      recipients: recipients.length,
    };
  }

  async triggerCriticalDeviation(params: {
    projectId: number;
    taskInstanceId: number;
    userId: number;
    date: string;
    planDay: number;
    factDay: number;
    taskName: string;
    facadeName?: string | null;
  }) {
    const setting = await this.prisma.notificationSetting.findUnique({
      where: { parameter: "deviation_threshold_pct" },
    });
    const threshold = Number(setting?.value || '20');

    if (!Number.isFinite(threshold) || params.planDay <= 0) {
      return null;
    }

    const deviationPct = ((params.factDay - params.planDay) / params.planDay) * 100;
    if (Math.abs(deviationPct) < threshold) {
      return null;
    }

    return this.triggerScenario({
      code: 'NS-11',
      projectId: params.projectId,
      entityType: 'TaskInstance',
      entityId: params.taskInstanceId,
      taskInstanceId: params.taskInstanceId,
      actorUserId: params.userId,
      payload: {
        date: params.date,
        task_name: params.taskName,
        facade: params.facadeName || '—',
        plan: params.planDay.toFixed(2),
        fact: params.factDay.toFixed(2),
        deviation_pct: deviationPct.toFixed(2),
      },
    });
  }

  async runOverdueEscalation(actorUserId?: number) {
    const [l1, l2, l3] = await Promise.all([
      this.getSettingNumber('escalation_l1_days', 1),
      this.getSettingNumber('escalation_l2_days', 3),
      this.getSettingNumber('escalation_l3_days', 7),
    ]);

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.taskInstance.findMany({
      where: {
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        plannedEnd: { lt: today },
      },
      include: {
        template: true,
        assignee: true,
        facade: true,
      },
    });

    let triggered = 0;
    let skipped = 0;

    for (const task of tasks) {
      if (!task.plannedEnd) {
        skipped += 1;
        continue;
      }

      const overdueDays = Math.ceil(
        (today.getTime() - task.plannedEnd.getTime()) / (1000 * 60 * 60 * 24),
      );

      let scenarioCode: string | null = null;
      if (overdueDays >= l3) scenarioCode = 'NS-04';
      else if (overdueDays >= l2) scenarioCode = 'NS-03';
      else if (overdueDays >= l1) scenarioCode = 'NS-02';
      else {
        skipped += 1;
        continue;
      }

      const scenario = await this.prisma.notificationScenario.findUnique({
        where: { code: scenarioCode },
      });

      if (!scenario) {
        skipped += 1;
        continue;
      }

      const duplicateToday = await this.prisma.notificationLog.findFirst({
        where: {
          scenarioId: scenario.id,
          entityType: 'TaskInstance',
          entityId: task.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (duplicateToday && isSameDate(duplicateToday.createdAt, now)) {
        skipped += 1;
        continue;
      }

      const assigneeName = task.assignee
        ? [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ')
        : '—';
      const payload = {
        level: scenarioCode === 'NS-04' ? 'L3' : scenarioCode === 'NS-03' ? 'L2' : 'L1',
        days: overdueDays,
        task_name: task.template?.name || `Задача #${task.id}`,
        assignee_name: assigneeName || '—',
        deadline: task.plannedEnd.toISOString().slice(0, 10),
        site: task.facade?.name || '—',
      };

      await this.triggerScenario({
        code: scenarioCode,
        projectId: task.projectId,
        entityType: 'TaskInstance',
        entityId: task.id,
        taskInstanceId: task.id,
        actorUserId,
        recipientUserIds: scenarioCode === 'NS-02' && task.assigneeId ? [task.assigneeId] : undefined,
        payload,
      });

      triggered += 1;
    }

    return {
      checked: tasks.length,
      triggered,
      skipped,
      thresholds: { l1, l2, l3 },
    };
  }

  private async getSettingNumber(parameter: string, fallback: number): Promise<number> {
    const setting = await this.prisma.notificationSetting.findUnique({
      where: { parameter },
    });
    const parsed = Number(setting?.value || fallback);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private async resolveRecipients(params: {
    roles: string[];
    projectId?: number;
    recipientUserIds?: number[];
  }) {
    if (params.recipientUserIds && params.recipientUserIds.length > 0) {
      return this.prisma.user.findMany({
        where: {
          id: { in: params.recipientUserIds },
          status: 'ACTIVE',
          telegramId: { not: null },
        },
      });
    }

    if (params.roles.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        telegramId: { not: null },
        userRoles: {
          some: {
            role: { systemName: { in: params.roles } },
            ...(params.projectId ? { projectId: params.projectId } : {}),
          },
        },
      },
    });
  }

  private renderTemplate(
    templateText: string,
    payload: Record<string, string | number | null | undefined>,
  ) {
    return templateText.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
      const value = payload[key];
      if (value === undefined || value === null) return '—';
      return String(value);
    });
  }

  private buildKeyboard(
    buttonsConfig: unknown,
    payload: Record<string, string | number | null | undefined>,
  ): InlineKeyboard | null {
    const patterns = getButtonPatterns(buttonsConfig);
    if (patterns.length === 0) return null;

    const keyboard = new InlineKeyboard();
    for (const pattern of patterns) {
      const callbackData = this.renderTemplate(pattern, payload);
      keyboard.text(this.resolveButtonLabel(pattern), callbackData).row();
    }

    return keyboard;
  }

  private resolveButtonLabel(pattern: string): string {
    if (pattern.startsWith('accept:')) return '✅ Принять';
    if (pattern.startsWith('detail:')) return 'ℹ️ Подробнее';
    if (pattern.startsWith('update:')) return '✏️ Обновить';
    if (pattern.startsWith('reschedule:')) return '📅 Перенести срок';
    if (pattern.startsWith('enter_fact:')) return '📝 Ввести факт';
    if (pattern.startsWith('contact:')) return '📞 Связаться';
    if (pattern.startsWith('approve:')) return '✅ Утвердить';
    if (pattern.startsWith('reject:')) return '↩️ Отклонить';
    if (pattern.startsWith('dashboard:')) return '📊 Дашборд';
    if (pattern.startsWith('gpr:')) return '🗓 ГПР';
    if (pattern.startsWith('import_log:')) return '📥 Лог импорта';
    if (pattern.startsWith('rework:')) return '🔁 На доработку';
    if (pattern.startsWith('plan_fact:')) return '📝 План-Факт';
    if (pattern.startsWith('blocker_raise:')) return '🚨 Эскалация';
    return '▶️ Открыть';
  }
}
