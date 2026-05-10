import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { HumService } from './hum.service';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class HumRecognizeDto {
  @ApiPropertyOptional({ description: 'Base64 encoded humming audio' }) @IsOptional() @IsString() audio?: string;
  @ApiPropertyOptional({ example: 'na na na na, bài có đoạn chorus rất bắt tai' }) @IsOptional() @IsString() description?: string;
}

@ApiTags('ai-hum')
@Controller('ai/hum')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HumController {
  constructor(private humService: HumService) {}

  @Post('recognize')
  @ApiOperation({ summary: 'Upload humming audio or describe melody to identify song' })
  recognize(@CurrentUser('id') userId: string, @Body() dto: HumRecognizeDto) {
    return this.humService.recognize(userId, dto);
  }

  @Get('result/:id')
  @ApiOperation({ summary: 'Get hum recognition result' })
  getResult(@Param('id') id: string) {
    return this.humService.getResult(id);
  }
}
