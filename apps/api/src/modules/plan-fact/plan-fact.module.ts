import { Module } from '@nestjs/common';
import { PlanFactService } from './plan-fact.service';
import { PlanFactController } from './plan-fact.controller';

@Module({
  providers: [PlanFactService],
  controllers: [PlanFactController],
  exports: [PlanFactService],
})
export class PlanFactModule {}
