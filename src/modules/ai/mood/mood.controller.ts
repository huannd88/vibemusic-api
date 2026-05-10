import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MoodService } from './mood.service';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class DetectMoodDto {
  @ApiProperty({ example: 'buồn quá, muốn nghe nhạc chill' }) @IsString() text: string;
}
class MoodPlaylistDto {
  @ApiProperty({ example: 'nhạc chill buổi tối cho coding' }) @IsString() description: string;
}
class ProgressionDto {
  @ApiProperty({ example: 'sad' }) @IsString() from: string;
  @ApiProperty({ example: 'happy' }) @IsString() to: string;
}

@ApiTags('ai')
@Controller('ai/mood')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MoodController {
  constructor(private moodService: MoodService) {}

  @Post('detect')
  @ApiOperation({ summary: 'Detect mood from text/emoji' })
  detect(@CurrentUser('id') userId: string, @Body() dto: DetectMoodDto) {
    return this.moodService.detectMood(userId, dto.text);
  }

  @Post('playlist')
  @ApiOperation({ summary: 'Generate playlist by mood description' })
  playlist(@CurrentUser('id') userId: string, @Body() dto: MoodPlaylistDto) {
    return this.moodService.generateMoodPlaylist(userId, dto.description);
  }

  @Get('history')
  @ApiOperation({ summary: 'Mood history' })
  history(@CurrentUser('id') userId: string) {
    return this.moodService.getMoodHistory(userId);
  }

  @Get('suggestion')
  @ApiOperation({ summary: 'Mood of the day suggestion' })
  suggestion(@CurrentUser('id') userId: string) {
    return this.moodService.getMoodSuggestion(userId);
  }

  @Post('progression')
  @ApiOperation({ summary: 'Emotional progression playlist (sad → happy)' })
  progression(@CurrentUser('id') userId: string, @Body() dto: ProgressionDto) {
    return this.moodService.generateProgression(userId, dto.from, dto.to);
  }
}
