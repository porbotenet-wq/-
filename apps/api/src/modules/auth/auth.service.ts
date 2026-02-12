import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface JwtPayload {
  sub: number; // user.id
  telegramId: number;
  role: string | null;
  projectId: number | null;
  facadeIds: number[];
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Validate Telegram Mini App initData (HMAC-SHA256)
   * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   */
  validateInitData(initData: string): Record<string, string> {
    const botToken = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('Missing hash in initData');

    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      throw new UnauthorizedException('Invalid initData signature');
    }

    return Object.fromEntries(params.entries());
  }

  /**
   * Authenticate via Telegram initData → find/create user → return JWT
   */
  async authenticateTelegram(initData: string) {
    const validated = this.validateInitData(initData);

    const userData = JSON.parse(validated.user || '{}');
    const telegramId = userData.id;
    if (!telegramId) {
      throw new UnauthorizedException('No user data in initData');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId: BigInt(telegramId),
          firstName: userData.first_name || null,
          lastName: userData.last_name || null,
          username: userData.username || null,
          status: 'PENDING',
        },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Build JWT payload
    const primaryRole = user.userRoles[0] || null;
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: Number(user.telegramId),
      role: primaryRole?.role.systemName || null,
      projectId: primaryRole?.projectId || null,
      facadeIds: primaryRole?.facadeIds || [],
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        telegramId: Number(user.telegramId),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        status: user.status,
        role: primaryRole?.role.systemName || null,
      },
    };
  }

  /**
   * Find or create user by Telegram ID (used by Bot)
   */
  async findOrCreateByTelegramId(
    telegramId: number,
    firstName?: string,
    lastName?: string,
    username?: string,
  ) {
    let user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    const isNew = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId: BigInt(telegramId),
          firstName: firstName || null,
          lastName: lastName || null,
          username: username || null,
          status: 'PENDING',
        },
        include: {
          userRoles: { include: { role: true } },
        },
      });
    }

    return { user, isNew };
  }
}
