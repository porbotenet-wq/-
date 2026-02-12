import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PlanFactService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Get daily work logs for a date and optional filters
   */
  async getByDate(params: {
    date: string;
    projectId: number;
    facadeId?: number;
    assigneeId?: number;
  }) {
    const { date, projectId, facadeId, assigneeId } = params;

    const where: any = {
      date: new Date(date),
      taskInstance: { projectId },
    };
    if (facadeId) where.facadeId = facadeId;
    if (assigneeId) where.taskInstance = { ...where.taskInstance, assigneeId };

    return this.prisma.dailyWorkLog.findMany({
      where,
      include: {
        taskInstance: {
          include: { template: true, facade: true },
        },
      },
      orderBy: { taskInstance: { template: { sortOrder: 'asc' } } },
    });
  }

  /**
   * Create or update daily fact — REQ-BE-003
   */
  async upsertFact(params: {
    taskInstanceId: number;
    date: string;
    factDay: number;
    brigade?: string;
    notes?: string;
    userId: number;
  }) {
    const { taskInstanceId, date, factDay, brigade, notes, userId } = params;

    if (factDay < 0) {
      throw new BadRequestException('Fact value cannot be negative');
    }

    const task = await this.prisma.taskInstance.findUnique({
      where: { id: taskInstanceId },
      include: {
        template: true,
        facade: true,
      },
    });
    if (!task) throw new NotFoundException(`Task #${taskInstanceId} not found`);

    // Upsert daily work log
    const dateObj = new Date(date);
    const log = await this.prisma.dailyWorkLog.upsert({
      where: {
        taskInstanceId_date: { taskInstanceId, date: dateObj },
      },
      create: {
        taskInstanceId,
        date: dateObj,
        factDay,
        brigade,
        notes,
        createdBy: userId,
        status: 'DRAFT',
      },
      update: {
        factDay,
        brigade,
        notes,
      },
    });

    // Recalculate accumulations
    await this.recalculate(taskInstanceId, dateObj);

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        action: 'FACT_ENTERED',
        entityType: 'DailyWorkLog',
        entityId: log.id,
        userId,
        newValue: { factDay, date, taskInstanceId },
      },
    });

    const refreshedLog = await this.prisma.dailyWorkLog.findUnique({
      where: { id: log.id },
      select: {
        planDay: true,
        factDay: true,
      },
    });

    if (task && refreshedLog) {
      try {
        await this.notificationService.triggerCriticalDeviation({
          projectId: task.projectId,
          taskInstanceId,
          userId,
          date,
          planDay: Number(refreshedLog.planDay),
          factDay: Number(refreshedLog.factDay),
          taskName: task.template?.name || `Задача #${task.id}`,
          facadeName: task.facade?.name,
        });
      } catch (error) {
        console.warn(
          `[PlanFactService] NS-11 notification failed for task #${taskInstanceId}:`,
          error,
        );
      }
    }

    return log;
  }

  /**
   * Recalculate accumulations for a task instance — REQ-BE-003
   * deviation = fact_day - plan_day
   * pct_day = fact_day / plan_day * 100 (if plan_day > 0)
   * acc_plan = SUM(plan_day) up to date
   * acc_fact = SUM(fact_day) up to date
   */
  private async recalculate(taskInstanceId: number, upToDate: Date) {
    // Get all logs for this task up to date
    const logs = await this.prisma.dailyWorkLog.findMany({
      where: { taskInstanceId, date: { lte: upToDate } },
      orderBy: { date: 'asc' },
    });

    let accPlan = new Decimal(0);
    let accFact = new Decimal(0);

    for (const log of logs) {
      accPlan = accPlan.add(log.planDay);
      accFact = accFact.add(log.factDay);

      const deviation = new Decimal(log.factDay).sub(log.planDay);
      const pctDay = new Decimal(log.planDay).gt(0)
        ? new Decimal(log.factDay).div(log.planDay).mul(100)
        : null;

      await this.prisma.dailyWorkLog.update({
        where: { id: log.id },
        data: {
          deviation,
          pctDay,
          accPlan,
          accFact,
        },
      });
    }

    // Update TaskInstance.actual_volume and completion_pct
    const totalFact = await this.prisma.dailyWorkLog.aggregate({
      where: { taskInstanceId },
      _sum: { factDay: true },
    });

    const actualVolume = totalFact._sum.factDay || new Decimal(0);
    const task = await this.prisma.taskInstance.findUnique({
      where: { id: taskInstanceId },
    });

    const completionPct =
      task?.plannedVolume && new Decimal(task.plannedVolume).gt(0)
        ? new Decimal(actualVolume).div(task.plannedVolume).mul(100)
        : new Decimal(0);

    await this.prisma.taskInstance.update({
      where: { id: taskInstanceId },
      data: {
        actualVolume,
        completionPct,
      },
    });
  }
}
