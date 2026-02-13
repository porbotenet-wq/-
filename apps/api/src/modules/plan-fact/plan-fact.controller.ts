import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { PlanFactService } from './plan-fact.service';
import { RbacGuard, RequirePermission } from '../../common/guards/rbac.guard';

@Controller('plan-fact')
@UseGuards(RbacGuard)
export class PlanFactController {
  constructor(private planFactService: PlanFactService) {}

  @Get()
  @RequirePermission('plan_fact', 'read')
  async getByDate(
    @Query('date') date: string,
    @Query('projectId') projectId: string,
    @Query('facadeId') facadeId?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return {
      data: await this.planFactService.getByDate({
        date,
        projectId: Number(projectId),
        facadeId: facadeId ? Number(facadeId) : undefined,
        assigneeId: assigneeId ? Number(assigneeId) : undefined,
      }),
    };
  }

  @Post()
  @RequirePermission('plan_fact', 'create')
  async upsertFact(
    @Body()
    body: {
      taskInstanceId: number;
      date: string;
      factDay: number;
      brigade?: string;
      notes?: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || 1;
    return {
      data: await this.planFactService.upsertFact({
        ...body,
        userId,
      }),
    };
  }
}
