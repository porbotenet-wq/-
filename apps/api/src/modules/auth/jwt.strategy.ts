import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Extract and validate JWT from Authorization header
   */
  validateToken(authHeader?: string): JwtPayload {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      return this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
