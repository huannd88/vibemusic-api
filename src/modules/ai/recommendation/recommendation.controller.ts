import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TierGuard, RequireTier } from '../../../common/guards/tier.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RecommendationService } from './recommendation.service';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class FeedbackDto {
  @ApiProperty() @IsString() trackId: string;
  @ApiProperty({ enum: ['like', 'dislike'] }) @IsIn(['like', 'dislike']) type:
    | 'like'
    | 'dislike';
  @ApiPropertyOptional() @IsOptional() @IsString() context?: string;
}

@ApiTags('ai')
@Controller('ai/recommend')
@UseGuards(JwtAuthGuard, TierGuard)
@ApiBearerAuth()
export class RecommendationController {
  constructor(private recommendService: RecommendationService) {}

  @Get('for-you')
  @ApiOperation({ summary: 'Personalized recommendations (taste model)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getForYou(@CurrentUser('id') userId: string, @Query('limit') limit?: number) {
    return this.recommendService.getForYou(userId, limit ? +limit : 20);
  }

  @Get('radio')
  @ApiOperation({ summary: 'Infinite radio from seed track/artist' })
  @ApiQuery({ name: 'seed', required: true })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['track', 'artist', 'genre'],
  })
  getRadio(
    @CurrentUser('id') userId: string,
    @Query('seed') seed: string,
    @Query('type') type?: string,
  ) {
    return this.recommendService.getRadio(userId, seed, type || 'track');
  }

  @Get('discover-weekly')
  @ApiOperation({ summary: 'Weekly discovery playlist' })
  getDiscoverWeekly(@CurrentUser('id') userId: string) {
    return this.recommendService.getDiscoverWeekly(userId);
  }

  @Get('similar/:youtubeId')
  @ApiOperation({ summary: 'Similar tracks to a given track' })
  getSimilar(@Param('youtubeId') youtubeId: string) {
    return this.recommendService.getSimilar(youtubeId);
  }

  @Get('because-you-listened')
  @RequireTier('PREMIUM')
  @ApiOperation({ summary: '"Because you listened to..." sections (Premium)' })
  getBecauseYouListened(@CurrentUser('id') userId: string) {
    return this.recommendService.getBecauseYouListened(userId);
  }

  @Post('feedback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Like/dislike recommendation feedback' })
  submitFeedback(@CurrentUser('id') userId: string, @Body() dto: FeedbackDto) {
    return this.recommendService.submitFeedback(userId, dto);
  }
}
