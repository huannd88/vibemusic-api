import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../../common/guards/tier.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { VoiceService } from './voice.service';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AudioCommandDto {
  @ApiPropertyOptional({ description: 'Base64 encoded audio' }) @IsOptional() @IsString() audio?: string;
}
class TextCommandDto {
  @ApiProperty({ example: 'mở bài Sơn Tùng đi' }) @IsString() text: string;
}

@ApiTags('ai-voice')
@Controller('ai/voice')
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('PREMIUM')
@ApiBearerAuth()
export class VoiceController {
  constructor(private voiceService: VoiceService) {}

  @Post('command')
  @HttpCode(200)
  @ApiOperation({ summary: 'Audio voice command (STT → Intent → Action) (Premium)' })
  audioCommand(@CurrentUser('id') userId: string, @Body() dto: AudioCommandDto) {
    return this.voiceService.processAudioCommand(userId, dto.audio);
  }

  @Post('text-command')
  @HttpCode(200)
  @ApiOperation({ summary: 'Text command fallback (Vietnamese/English NLU) (Premium)' })
  textCommand(@CurrentUser('id') userId: string, @Body() dto: TextCommandDto) {
    return this.voiceService.processTextCommand(userId, dto.text);
  }

  @Get('response/:id')
  @ApiOperation({ summary: 'Get voice response result' })
  getResponse(@Param('id') id: string) {
    return this.voiceService.getResponse(id);
  }
}
