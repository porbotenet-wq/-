import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId?: number) {
    return this.prisma.user.findMany({
      where: projectId
        ? { userRoles: { some: { projectId } } }
        : undefined,
      include: {
        department: true,
        userRoles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        userRoles: { include: { role: true, project: true } },
      },
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async assignRole(
    userId: number,
    roleId: number,
    projectId: number,
    facadeIds: number[],
    assignedBy: number,
  ) {
    // Activate user if PENDING
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    return this.prisma.userRole.upsert({
      where: {
        userId_roleId_projectId: { userId, roleId, projectId },
      },
      create: {
        userId,
        roleId,
        projectId,
        facadeIds,
        assignedBy,
      },
      update: {
        facadeIds,
        assignedBy,
      },
      include: { role: true },
    });
  }
}
