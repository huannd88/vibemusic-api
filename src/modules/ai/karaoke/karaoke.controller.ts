import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../../common/guards/tier.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { KaraokeService } from './karaoke.service';
import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class TransposeDto {
  @ApiProperty() @IsString() jobId: string;
  @ApiProperty({ example: 2 }) @IsNumber() semitones: number;
}

@ApiTags('ai-karaoke')
@Controller('ai/karaoke')
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('PREMIUM')
@ApiBearerAuth()
export class KaraokeController {
  constructor(private karaokeService: KaraokeService) {}

  @Post('prepare/:youtubeId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start vocal separation for karaoke (Premium)' })
  prepare(@CurrentUser('id') userId: string, @Param('youtubeId') youtubeId: string) {
    return this.karaokeService.prepare(userId, youtubeId);
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Check karaoke processing status' })
  getStatus(@Param('jobId') jobId: string) {
    return this.karaokeService.getStatus(jobId);
  }

  @Get('stream/:jobId')
  @ApiOperation({ summary: 'Stream separated audio (instrumental/vocal)' })
  getStream(@Param('jobId') jobId: string) {
    return this.karaokeService.getStream(jobId);
  }

  @Post('transpose')
  @HttpCode(200)
  @ApiOperation({ summary: 'Transpose key (+/- semitones) (Premium)' })
  transpose(@CurrentUser('id') userId: string, @Body() dto: TransposeDto) {
    return this.karaokeService.transpose(userId, dto);
  }
}
