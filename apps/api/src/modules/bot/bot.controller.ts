import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { BotService } from './bot.service';
import { webhookCallback } from 'grammy';

@Controller('bot')
export class BotController {
  private handleUpdate: ReturnType<typeof webhookCallback>;

  constructor(private botService: BotService) {
    this.handleUpdate = webhookCallback(this.botService.bot, 'express');
  }

  /**
   * POST /api/v1/bot/webhook
   * Telegram sends updates here
   */
  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response) {
    await this.handleUpdate(req, res);
  }
}
