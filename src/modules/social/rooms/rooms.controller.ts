import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RoomsService } from './rooms.service';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateRoomDto {
  @ApiProperty({ example: 'Chill Lofi Night' }) @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxUsers?: number;
}

@ApiTags('social-rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create listening room' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List public rooms' })
  list() {
    return this.roomsService.listPublic();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room details' })
  getRoom(@Param('id') id: string) {
    return this.roomsService.getRoom(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join room' })
  join(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.roomsService.join(userId, id);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave room' })
  leave(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.roomsService.leave(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Close room (host only)' })
  deleteRoom(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.roomsService.deleteRoom(userId, id);
  }
}
