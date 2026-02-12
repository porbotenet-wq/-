import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

class TelegramAuthDto {
  initData: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/v1/auth/telegram
   * Authenticate via Telegram Mini App initData
   */
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  async authenticateTelegram(@Body() dto: TelegramAuthDto) {
    const result = await this.authService.authenticateTelegram(dto.initData);
    return {
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
