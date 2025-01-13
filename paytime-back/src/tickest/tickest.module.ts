import { Module } from '@nestjs/common';
import { TickestService } from './tickest.service';
import { TickestController } from './tickest.controller';

@Module({
  controllers: [TickestController],
  providers: [TickestService],
})
export class TickestModule {}
