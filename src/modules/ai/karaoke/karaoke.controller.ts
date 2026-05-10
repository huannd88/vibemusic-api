import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KaraokeController {
  constructor(private karaokeService: KaraokeService) {}

  @Post('prepare/:youtubeId')
  @ApiOperation({ summary: 'Start vocal separation for karaoke' })
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
  @ApiOperation({ summary: 'Transpose key (+/- semitones)' })
  transpose(@CurrentUser('id') userId: string, @Body() dto: TransposeDto) {
    return this.karaokeService.transpose(userId, dto);
  }
}
