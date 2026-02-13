import { Controller, Get, Param, Post, Body, UseGuards, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { RbacGuard, RequirePermission } from '../../common/guards/rbac.guard';

@Controller('users')
@UseGuards(RbacGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @RequirePermission('user_management', 'read')
  async findAll(@Query('projectId') projectId?: string) {
    return {
      data: await this.userService.findAll(
        projectId ? Number(projectId) : undefined,
      ),
    };
  }

  @Get(':id')
  @RequirePermission('user_management', 'read')
  async findById(@Param('id') id: string) {
    return { data: await this.userService.findById(Number(id)) };
  }

  @Post(':id/assign-role')
  @RequirePermission('user_management', 'assign_role')
  async assignRole(
    @Param('id') id: string,
    @Body() body: { roleId: number; projectId: number; facadeIds?: number[] },
  ) {
    // TODO: get assignedBy from JWT
    const result = await this.userService.assignRole(
      Number(id),
      body.roleId,
      body.projectId,
      body.facadeIds || [],
      1, // placeholder
    );
    return { data: result };
  }
}
