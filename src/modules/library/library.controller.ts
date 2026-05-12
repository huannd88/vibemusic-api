import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LibraryService } from './library.service';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AddHistoryDto {
  @ApiProperty() @IsString() youtubeId: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() durationPlayed?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() skipped?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() context?: string;
}
class UpdateQueueDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  tracks: string[];
  @ApiProperty() @IsNumber() currentIndex: number;
}
class RestoreDto {
  @ApiProperty() @IsString() code: string;
}

@ApiTags('library')
@Controller('library')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LibraryController {
  constructor(private libraryService: LibraryService) {}

  // Favorites
  @Get('favorites')
  @ApiOperation({ summary: 'Get favorite tracks' })
  getFavorites(@CurrentUser('id') userId: string) {
    return this.libraryService.getFavorites(userId);
  }

  @Post('favorites/:youtubeId')
  @ApiOperation({ summary: 'Add to favorites' })
  addFavorite(
    @CurrentUser('id') userId: string,
    @Param('youtubeId') youtubeId: string,
  ) {
    return this.libraryService.addFavorite(userId, youtubeId);
  }

  @Delete('favorites/:youtubeId')
  @ApiOperation({ summary: 'Remove from favorites' })
  removeFavorite(
    @CurrentUser('id') userId: string,
    @Param('youtubeId') youtubeId: string,
  ) {
    return this.libraryService.removeFavorite(userId, youtubeId);
  }

  // History
  @Get('history')
  @ApiOperation({ summary: 'Listening history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.libraryService.getHistory(
      userId,
      limit ? +limit : 50,
      offset ? +offset : 0,
    );
  }

  @Post('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record listen event' })
  addHistory(@CurrentUser('id') userId: string, @Body() dto: AddHistoryDto) {
    return this.libraryService.addHistory(userId, dto);
  }

  @Delete('history')
  @ApiOperation({ summary: 'Clear listening history' })
  clearHistory(@CurrentUser('id') userId: string) {
    return this.libraryService.clearHistory(userId);
  }

  // Queue
  @Get('queue')
  @ApiOperation({ summary: 'Get current queue' })
  getQueue(@CurrentUser('id') userId: string) {
    return this.libraryService.getQueue(userId);
  }

  @Put('queue')
  @ApiOperation({ summary: 'Update queue' })
  updateQueue(@CurrentUser('id') userId: string, @Body() dto: UpdateQueueDto) {
    return this.libraryService.updateQueue(userId, dto);
  }

  // Backup/Restore
  @Post('backup')
  @ApiOperation({ summary: 'Create backup of all playlists & favorites' })
  createBackup(@CurrentUser('id') userId: string) {
    return this.libraryService.createBackup(userId);
  }

  @Post('restore')
  @ApiOperation({ summary: 'Restore from backup code' })
  restoreBackup(@CurrentUser('id') userId: string, @Body() dto: RestoreDto) {
    return this.libraryService.restoreBackup(userId, dto.code);
  }
}
