import { Module } from '@nestjs/common';
import { KaraokeController } from './karaoke.controller';
import { KaraokeService } from './karaoke.service';

@Module({
  controllers: [KaraokeController],
  providers: [KaraokeService],
  exports: [KaraokeService],
})
export class KaraokeModule {}
