import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { RbacGuard, RequirePermission } from '../../common/guards/rbac.guard';

@Controller('notifications')
@UseGuards(RbacGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get('scenarios')
  @RequirePermission('notification_settings', 'read')
  async listScenarios() {
    return { data: await this.notificationService.listScenarios() };
  }

  @Post('trigger')
  @RequirePermission('notification_settings', 'update')
  async trigger(
    @Body()
    body: {
      code: string;
      payload?: Record<string, string | number | null | undefined>;
      projectId?: number;
      entityType?: string;
      entityId?: number;
      taskInstanceId?: number;
      recipientUserIds?: number[];
    },
    @Req() req: any,
  ) {
    const actorUserId = req.user?.sub || 1;
    const result = await this.notificationService.triggerScenario({
      code: body.code,
      payload: body.payload,
      projectId: body.projectId,
      entityType: body.entityType,
      entityId: body.entityId,
      taskInstanceId: body.taskInstanceId,
      recipientUserIds: body.recipientUserIds,
      actorUserId,
    });

    return { data: result };
  }

  @Post('run-overdue-escalation')
  @RequirePermission('notification_settings', 'update')
  async runOverdueEscalation(@Req() req: any) {
    const actorUserId = req.user?.sub || 1;
    return {
      data: await this.notificationService.runOverdueEscalation(actorUserId),
    };
  }
}
