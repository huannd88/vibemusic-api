import { Controller, Get, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../../common/guards/tier.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ContextService } from './context.service';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ReportContextDto {
  @ApiPropertyOptional({ example: 'evening' }) @IsOptional() @IsString() timeOfDay?: string;
  @ApiPropertyOptional({ example: 'working' }) @IsOptional() @IsString() activity?: string;
  @ApiPropertyOptional({ example: 'rainy' }) @IsOptional() @IsString() weather?: string;
  @ApiPropertyOptional({ example: 'home' }) @IsOptional() @IsString() location?: string;
}

@ApiTags('ai')
@Controller('ai/context')
@UseGuards(JwtAuthGuard, TierGuard)
@ApiBearerAuth()
export class ContextController {
  constructor(private contextService: ContextService) {}

  @Post('report')
  @HttpCode(200)
  @ApiOperation({ summary: 'Report current context (time, activity, location)' })
  report(@CurrentUser('id') userId: string, @Body() dto: ReportContextDto) {
    return this.contextService.reportContext(userId, dto);
  }

  @Get('suggest')
  @RequireTier('PREMIUM')
  @ApiOperation({ summary: 'Get context-aware music suggestion (Premium)' })
  suggest(@CurrentUser('id') userId: string) {
    return this.contextService.getSuggestion(userId);
  }
}
