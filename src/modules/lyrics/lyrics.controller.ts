import { Controller, Get, Post, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../common/guards/tier.guard';
import { LyricsService } from './lyrics.service';

@ApiTags('lyrics')
@Controller('lyrics')
@UseGuards(JwtAuthGuard, TierGuard)
@ApiBearerAuth()
export class LyricsController {
  constructor(private lyricsService: LyricsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search lyrics by text' })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') q: string) {
    return this.lyricsService.searchLyrics(q);
  }

  @Get(':youtubeId')
  @ApiOperation({ summary: 'Get time-synced lyrics for a track' })
  getLyrics(@Param('youtubeId') youtubeId: string) {
    return this.lyricsService.getLyrics(youtubeId);
  }

  @Post(':youtubeId/translate')
  @HttpCode(200)
  @RequireTier('PREMIUM')
  @ApiOperation({ summary: 'AI translate lyrics (Premium)' })
  @ApiQuery({ name: 'lang', required: true })
  translate(@Param('youtubeId') youtubeId: string, @Query('lang') lang: string) {
    return this.lyricsService.translateLyrics(youtubeId, lang);
  }
}
