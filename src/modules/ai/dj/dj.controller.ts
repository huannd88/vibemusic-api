import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../../common/guards/tier.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DjService } from './dj.service';
import { IsString, IsOptional, IsIn, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class StartDjDto {
  @ApiPropertyOptional({ example: 'chill' }) @IsOptional() @IsString() mood?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() genres?: string[];
}
class DjCommandDto {
  @ApiProperty({ example: 'chill hơn đi, giảm tempo' }) @IsString() text: string;
}
class DjFeedbackDto {
  @ApiProperty() @IsString() trackId: string;
  @ApiProperty({ enum: ['up', 'down'] }) @IsIn(['up', 'down']) type: 'up' | 'down';
}

@ApiTags('ai-dj')
@Controller('ai/dj')
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('PREMIUM')
@ApiBearerAuth()
export class DjController {
  constructor(private djService: DjService) {}

  @Post('start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start AI DJ session (Premium)' })
  start(@CurrentUser('id') userId: string, @Body() dto: StartDjDto) {
    return this.djService.start(userId, dto);
  }

  @Get('next')
  @ApiOperation({ summary: 'Get next track from AI DJ' })
  next(@CurrentUser('id') userId: string) {
    return this.djService.next(userId);
  }

  @Post('command')
  @HttpCode(200)
  @ApiOperation({ summary: 'Natural language command to DJ: "chill hơn đi"' })
  command(@CurrentUser('id') userId: string, @Body() dto: DjCommandDto) {
    return this.djService.command(userId, dto.text);
  }

  @Post('feedback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thumbs up/down on current track' })
  feedback(@CurrentUser('id') userId: string, @Body() dto: DjFeedbackDto) {
    return this.djService.feedback(userId, dto);
  }

  @Get('commentary/:trackId')
  @ApiOperation({ summary: 'AI DJ commentary/intro for a track' })
  commentary(@CurrentUser('id') userId: string, @Param('trackId') trackId: string) {
    return this.djService.commentary(userId, trackId);
  }

  @Post('stop')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stop AI DJ session' })
  stop(@CurrentUser('id') userId: string) {
    return this.djService.stop(userId);
  }
}
