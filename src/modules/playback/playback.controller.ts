import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlaybackService } from './playback.service';

@ApiTags('playback')
@Controller('playback')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlaybackController {
  constructor(private playbackService: PlaybackService) {}

  @Get('stream/:youtubeId')
  @ApiOperation({ summary: 'Get audio stream URL' })
  @ApiQuery({ name: 'quality', required: false, enum: ['128k', '256k', 'auto'] })
  getStream(@Param('youtubeId') youtubeId: string, @Query('quality') quality?: string) {
    return this.playbackService.getStreamUrl(youtubeId, quality);
  }

  @Get('info/:youtubeId')
  @ApiOperation({ summary: 'Get track info (title, artist, duration, thumbnail)' })
  getInfo(@Param('youtubeId') youtubeId: string) {
    return this.playbackService.getTrackInfo(youtubeId);
  }

  @Get('formats/:youtubeId')
  @ApiOperation({ summary: 'Get available audio formats/quality' })
  getFormats(@Param('youtubeId') youtubeId: string) {
    return this.playbackService.getFormats(youtubeId);
  }

  @Post('batch-info')
  @ApiOperation({ summary: 'Get info for multiple tracks (max 50)' })
  getBatchInfo(@Body() body: { youtubeIds: string[] }) {
    return this.playbackService.getBatchInfo(body.youtubeIds);
  }

  // ---- Phase 2: Smart Playback ----

  @Get('smart-shuffle')
  @ApiOperation({ summary: 'Smart shuffle - true random, balanced' })
  @ApiQuery({ name: 'playlist', required: true })
  smartShuffle(@CurrentUser('id') userId: string, @Query('playlist') playlistId: string) {
    return this.playbackService.smartShuffle(userId, playlistId);
  }

  @Get('next-track')
  @ApiOperation({ summary: 'AI-powered next track selection' })
  @ApiQuery({ name: 'current', required: true })
  @ApiQuery({ name: 'mode', required: false, enum: ['auto', 'similar', 'diverse'] })
  nextTrack(@CurrentUser('id') userId: string, @Query('current') current: string, @Query('mode') mode?: string) {
    return this.playbackService.getNextTrack(userId, current, mode);
  }

  @Post('session/start')
  @ApiOperation({ summary: 'Start playback session' })
  startSession(@CurrentUser('id') userId: string, @Body() body: { device?: string; quality?: string }) {
    return this.playbackService.startSession(userId, body);
  }

  @Post('session/event')
  @ApiOperation({ summary: 'Track playback event (play/pause/skip/seek)' })
  trackEvent(@CurrentUser('id') userId: string, @Body() body: { sessionId: string; type: string; trackId?: string; position?: number; metadata?: string }) {
    return this.playbackService.trackEvent(userId, body);
  }

  @Post('session/end')
  @ApiOperation({ summary: 'End playback session' })
  endSession(@CurrentUser('id') userId: string, @Body() body: { sessionId: string }) {
    return this.playbackService.endSession(userId, body.sessionId);
  }
}

