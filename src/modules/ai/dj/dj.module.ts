import { Module } from '@nestjs/common';
import { DjController } from './dj.controller';
import { DjService } from './dj.service';

@Module({
  controllers: [DjController],
  providers: [DjService],
  exports: [DjService],
})
export class DjModule {}
