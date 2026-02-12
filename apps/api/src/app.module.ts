import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './common/supabase/supabase.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { BotModule } from './modules/bot/bot.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaskModule } from './modules/task/task.module';
import { PlanFactModule } from './modules/plan-fact/plan-fact.module';
import { UserModule } from './modules/user/user.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    SupabaseModule,
    PrismaModule,
    AuthModule,
    BotModule,
    TaskModule,
    PlanFactModule,
    UserModule,
    AuditModule,
    NotificationModule,
  ],
})
export class AppModule {}
