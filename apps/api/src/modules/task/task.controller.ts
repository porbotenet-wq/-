import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { RbacGuard, RequirePermission } from '../../common/guards/rbac.guard';

@Controller('tasks')
@UseGuards(RbacGuard)
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Get()
  @RequirePermission('task', 'read')
  async findAll(
    @Query('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('facadeId') facadeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.taskService.findAll({
      projectId: Number(projectId),
      status,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
      facadeId: facadeId ? Number(facadeId) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    return {
      data: result.tasks,
      meta: { total: result.total, page: result.page, limit: result.limit },
    };
  }

  @Get(':id')
  @RequirePermission('task', 'read')
  async findById(@Param('id') id: string) {
    return { data: await this.taskService.findById(Number(id)) };
  }

  @Patch(':id/status')
  @RequirePermission('task', 'update')
  async changeStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || 1;
    return {
      data: await this.taskService.changeStatus(
        Number(id),
        body.status,
        userId,
      ),
    };
  }

  @Post(':id/assign')
  @RequirePermission('task', 'assign')
  async assign(
    @Param('id') id: string,
    @Body() body: { assigneeId: number },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || 1;
    return {
      data: await this.taskService.assign(
        Number(id),
        body.assigneeId,
        userId,
      ),
    };
  }
}
