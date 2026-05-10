import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VoiceController {
  constructor(private voiceService: VoiceService) {}

  @Post('command')
  @ApiOperation({ summary: 'Audio voice command (STT → Intent → Action)' })
  audioCommand(@CurrentUser('id') userId: string, @Body() dto: AudioCommandDto) {
    return this.voiceService.processAudioCommand(userId, dto.audio);
  }

  @Post('text-command')
  @ApiOperation({ summary: 'Text command fallback (Vietnamese/English NLU)' })
  textCommand(@CurrentUser('id') userId: string, @Body() dto: TextCommandDto) {
    return this.voiceService.processTextCommand(userId, dto.text);
  }

  @Get('response/:id')
  @ApiOperation({ summary: 'Get voice response result' })
  getResponse(@Param('id') id: string) {
    return this.voiceService.getResponse(id);
  }
}
