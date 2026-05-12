import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../../common/guards/tier.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AutoPlayService } from './auto-play.service';

@ApiTags('ai-auto')
@Controller('ai/auto')
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('PREMIUM')
@ApiBearerAuth()
export class AutoPlayController {
  constructor(private autoPlayService: AutoPlayService) {}

  @Get('play')
  @ApiOperation({
    summary: 'AI auto-select track (zero interaction) (Premium)',
  })
  play(@CurrentUser('id') userId: string) {
    return this.autoPlayService.play(userId);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get auto-play preferences' })
  getSettings(@CurrentUser('id') userId: string) {
    return this.autoPlayService.getSettings(userId);
  }

  @Post('settings')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update auto-play preferences (Premium)' })
  updateSettings(
    @CurrentUser('id') userId: string,
    @Body() settings: Record<string, any>,
  ) {
    return this.autoPlayService.updateSettings(userId, settings);
  }
}
