import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
}

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get('me/devices')
  @ApiOperation({ summary: 'List logged-in devices' })
  getDevices(@CurrentUser('id') userId: string) {
    return this.usersService.getDevices(userId);
  }

  @Delete('me/devices/:id')
  @ApiOperation({ summary: 'Remove device' })
  removeDevice(
    @CurrentUser('id') userId: string,
    @Param('id') deviceId: string,
  ) {
    return this.usersService.removeDevice(userId, deviceId);
  }

  @Get('me/subscription')
  @ApiOperation({ summary: 'Get subscription info' })
  getSubscription(@CurrentUser('id') userId: string) {
    return this.usersService.getSubscription(userId);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete account' })
  deleteAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }
}
