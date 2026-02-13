import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { BotModule } from '../bot/bot.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BotModule, AuditModule, AuthModule],
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
