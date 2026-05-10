import { Module } from '@nestjs/common';
import { HumController } from './hum.controller';
import { HumService } from './hum.service';

@Module({
  controllers: [HumController],
  providers: [HumService],
  exports: [HumService],
})
export class HumModule {}
