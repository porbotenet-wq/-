import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtStrategy } from '../../modules/auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

/** Decorator: @RequirePermission('task', 'create') */
export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action });

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtStrategy: JwtStrategy,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Validate JWT
    const payload = this.jwtStrategy.validateToken(
      request.headers.authorization,
    );
    request.user = payload;

    // 2. Check permission requirement
    const required = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!required) {
      // No permission required — just auth
      return true;
    }

    // 3. Admin bypass
    if (payload.role === 'admin') {
      return true;
    }

    if (!payload.role) {
      throw new ForbiddenException('No role assigned');
    }

    // 4. Check role has permission
    const rolePermission = await this.prisma.rolePermission.findFirst({
      where: {
        role: { systemName: payload.role },
        permission: {
          resource: required.resource,
          action: required.action,
        },
      },
    });

    if (!rolePermission) {
      throw new ForbiddenException(
        `Permission denied: ${required.resource}.${required.action}`,
      );
    }

    return true;
  }
}
