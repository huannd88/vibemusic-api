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
import { MoodService } from './mood.service';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class DetectMoodDto {
  @ApiProperty({ example: 'buồn quá, muốn nghe nhạc chill' })
  @IsString()
  text: string;
}
class MoodPlaylistDto {
  @ApiProperty({ example: 'nhạc chill buổi tối cho coding' })
  @IsString()
  description: string;
}
class ProgressionDto {
  @ApiProperty({ example: 'sad' }) @IsString() from: string;
  @ApiProperty({ example: 'happy' }) @IsString() to: string;
}

@ApiTags('ai')
@Controller('ai/mood')
@UseGuards(JwtAuthGuard, TierGuard)
@ApiBearerAuth()
export class MoodController {
  constructor(private moodService: MoodService) {}

  @Post('detect')
  @HttpCode(200)
  @RequireTier('PREMIUM')
  @ApiOperation({ summary: 'Detect mood from text/emoji (Premium)' })
  detect(@CurrentUser('id') userId: string, @Body() dto: DetectMoodDto) {
    return this.moodService.detectMood(userId, dto.text);
  }

  @Post('playlist')
  @HttpCode(200)
  @RequireTier('PREMIUM')
  @ApiOperation({ summary: 'Generate playlist by mood description (Premium)' })
  playlist(@CurrentUser('id') userId: string, @Body() dto: MoodPlaylistDto) {
    return this.moodService.generateMoodPlaylist(userId, dto.description);
  }

  @Get('history')
  @RequireTier('PREMIUM')
  @ApiOperation({ summary: 'Mood history (Premium)' })
  history(@CurrentUser('id') userId: string) {
    return this.moodService.getMoodHistory(userId);
  }

  @Get('suggestion')
  @RequireTier('PREMIUM')
  @ApiOperation({ summary: 'Mood of the day suggestion (Premium)' })
  suggestion(@CurrentUser('id') userId: string) {
    return this.moodService.getMoodSuggestion(userId);
  }

  @Post('progression')
  @HttpCode(200)
  @RequireTier('PREMIUM')
  @ApiOperation({
    summary: 'Emotional progression playlist (sad → happy) (Premium)',
  })
  progression(@CurrentUser('id') userId: string, @Body() dto: ProgressionDto) {
    return this.moodService.generateProgression(userId, dto.from, dto.to);
  }
}
