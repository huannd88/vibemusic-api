import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AutoPlayService } from './auto-play.service';

@ApiTags('ai-auto')
@Controller('ai/auto')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AutoPlayController {
  constructor(private autoPlayService: AutoPlayService) {}

  @Get('play')
  @ApiOperation({ summary: 'AI auto-select track (zero interaction)' })
  play(@CurrentUser('id') userId: string) {
    return this.autoPlayService.play(userId);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get auto-play preferences' })
  getSettings(@CurrentUser('id') userId: string) {
    return this.autoPlayService.getSettings(userId);
  }

  @Post('settings')
  @ApiOperation({ summary: 'Update auto-play preferences' })
  updateSettings(@CurrentUser('id') userId: string, @Body() settings: Record<string, any>) {
    return this.autoPlayService.updateSettings(userId, settings);
  }
}
