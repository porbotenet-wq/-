import { Module } from '@nestjs/common';
import { PlanFactService } from './plan-fact.service';
import { PlanFactController } from './plan-fact.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  providers: [PlanFactService],
  controllers: [PlanFactController],
  exports: [PlanFactService],
})
export class PlanFactModule {}
