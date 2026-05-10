import { Module } from '@nestjs/common';
import { LyricsController } from './lyrics.controller';
import { LyricsService } from './lyrics.service';

@Module({
  controllers: [LyricsController],
  providers: [LyricsService],
  exports: [LyricsService],
})
export class LyricsModule {}
