import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../../common/guards/tier.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MemoryService } from './memory.service';

@ApiTags('ai-memory')
@Controller('ai/memory')
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('PREMIUM')
@ApiBearerAuth()
export class MemoryController {
  constructor(private memoryService: MemoryService) {}

  @Get('on-this-day')
  @ApiOperation({ summary: 'Songs you listened to on this day last year (Premium)' })
  onThisDay(@CurrentUser('id') userId: string) {
    return this.memoryService.onThisDay(userId);
  }

  @Get('nostalgia')
  @ApiOperation({ summary: 'Nostalgia mix from your old favorites (Premium)' })
  @ApiQuery({ name: 'period', required: false, enum: ['2020s', '2010s', '2000s', '90s', 'all'] })
  nostalgia(@CurrentUser('id') userId: string, @Query('period') period?: string) {
    return this.memoryService.nostalgia(userId, period);
  }

  @Get('patterns')
  @ApiOperation({ summary: 'Listening patterns & analytics (Premium)' })
  patterns(@CurrentUser('id') userId: string) {
    return this.memoryService.patterns(userId);
  }

  @Get('seasonal')
  @ApiOperation({ summary: 'Seasonal & holiday music suggestions (Premium)' })
  seasonal(@CurrentUser('id') userId: string) {
    return this.memoryService.seasonal(userId);
  }
}
