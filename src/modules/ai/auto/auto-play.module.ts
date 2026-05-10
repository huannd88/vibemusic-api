import { Module } from '@nestjs/common';
import { AutoPlayController } from './auto-play.controller';
import { AutoPlayService } from './auto-play.service';

@Module({
  controllers: [AutoPlayController],
  providers: [AutoPlayService],
  exports: [AutoPlayService],
})
export class AutoPlayModule {}
