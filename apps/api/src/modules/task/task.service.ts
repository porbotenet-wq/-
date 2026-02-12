import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TASK_STATUS_TRANSITIONS } from '@stsphera/shared';

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    projectId: number;
    status?: string;
    assigneeId?: number;
    facadeId?: number;
    page?: number;
    limit?: number;
  }) {
    const { projectId, status, assigneeId, facadeId, page = 1, limit = 50 } = params;

    const where: any = { projectId };
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (facadeId) where.facadeId = facadeId;

    const [tasks, total] = await Promise.all([
      this.prisma.taskInstance.findMany({
        where,
        include: {
          template: true,
          assignee: true,
          facade: true,
          predecessors: true,
          successors: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { plannedEnd: 'asc' },
      }),
      this.prisma.taskInstance.count({ where }),
    ]);

    return { tasks, total, page, limit };
  }

  async findById(id: number) {
    const task = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        template: true,
        assignee: true,
        reviewer: true,
        facade: true,
        modulePlanItem: true,
        predecessors: { include: { predecessor: true } },
        successors: { include: { successor: true } },
        dailyWorkLogs: { orderBy: { date: 'desc' }, take: 10 },
      },
    });
    if (!task) throw new NotFoundException(`Task #${id} not found`);
    return task;
  }

  /**
   * Change task status with state machine validation (WF-02)
   */
  async changeStatus(id: number, newStatus: string, userId: number) {
    const task = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: { predecessors: { include: { predecessor: true } } },
    });

    if (!task) throw new NotFoundException(`Task #${id} not found`);

    // Validate transition
    const allowed = TASK_STATUS_TRANSITIONS[task.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${task.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`,
      );
    }

    // Guard: IN_PROGRESS → DONE requires all predecessors done
    if (newStatus === 'DONE') {
      const unfinishedPredecessors = task.predecessors.filter(
        (dep) =>
          !['DONE', 'VERIFIED', 'CANCELLED'].includes(
            dep.predecessor.status,
          ),
      );
      if (unfinishedPredecessors.length > 0) {
        throw new BadRequestException(
          'Cannot complete: predecessor tasks not finished',
        );
      }
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'IN_PROGRESS' && !task.actualStart) {
      updateData.actualStart = new Date();
    }
    if (newStatus === 'DONE' && !task.actualEnd) {
      updateData.actualEnd = new Date();
    }

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: updateData,
    });

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        action: 'TASK_STATUS_CHANGED',
        entityType: 'TaskInstance',
        entityId: id,
        userId,
        oldValue: { status: task.status },
        newValue: { status: newStatus },
      },
    });

    return updated;
  }

  /**
   * Assign task to user
   */
  async assign(id: number, assigneeId: number, userId: number) {
    const task = await this.prisma.taskInstance.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task #${id} not found`);

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: {
        assigneeId,
        status: task.status === 'CREATED' ? 'ASSIGNED' : task.status,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'TASK_ASSIGNED',
        entityType: 'TaskInstance',
        entityId: id,
        userId,
        oldValue: { assigneeId: task.assigneeId },
        newValue: { assigneeId },
      },
    });

    return updated;
  }
}
