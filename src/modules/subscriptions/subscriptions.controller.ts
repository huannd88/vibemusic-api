import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PurchaseDto {
  @ApiProperty({ example: 'premium', enum: ['premium', 'pro'] }) @IsString() planId: string;
  @ApiPropertyOptional({ description: 'App Store / Play Store receipt' }) @IsOptional() @IsString() receipt?: string;
}
class RestoreDto {
  @ApiProperty() @IsString() receipt: string;
}
class ApplyReferralDto {
  @ApiProperty({ example: 'VIBE-ABC12345' }) @IsString() code: string;
}

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List subscription plans (no auth required)' })
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase subscription' })
  purchase(@CurrentUser('id') userId: string, @Body() dto: PurchaseDto) {
    return this.subscriptionsService.purchase(userId, dto);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription' })
  cancel(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.cancel(userId);
  }

  @Post('restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore purchase from App/Play Store' })
  restore(@CurrentUser('id') userId: string, @Body() dto: RestoreDto) {
    return this.subscriptionsService.restore(userId, dto);
  }

  @Get('referral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my referral code' })
  getReferral(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getReferral(userId);
  }

  @Post('referral/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply referral code for bonus days' })
  applyReferral(@CurrentUser('id') userId: string, @Body() dto: ApplyReferralDto) {
    return this.subscriptionsService.applyReferral(userId, dto);
  }
}
