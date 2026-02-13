import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './common/supabase/supabase.module';
import { BotModule } from './modules/bot/bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    SupabaseModule,
    BotModule,
  ],
})
export class AppModule {}
