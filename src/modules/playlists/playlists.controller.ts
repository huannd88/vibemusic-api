import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlaylistsService } from './playlists.service';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreatePlaylistDto {
  @ApiProperty({ example: 'My Playlist' }) @IsString() title: string;
}
class UpdatePlaylistDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
}
class AddTracksDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  youtubeIds: string[];
}
class ReorderDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  trackIds: string[];
}
class ImportDto {
  @ApiProperty({ example: 'https://youtube.com/playlist?list=PLxxxx' })
  @IsString()
  youtubeUrl: string;
}

@ApiTags('playlists')
@Controller('playlists')
export class PlaylistsController {
  constructor(private playlistsService: PlaylistsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create playlist' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePlaylistDto) {
    return this.playlistsService.create(userId, dto.title);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user playlists' })
  findAll(@CurrentUser('id') userId: string) {
    return this.playlistsService.findAll(userId);
  }

  @Get('shared/:code')
  @ApiOperation({ summary: 'Get shared playlist by code (no auth)' })
  getShared(@Param('code') code: string) {
    return this.playlistsService.getByShareCode(code);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get playlist with tracks' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.playlistsService.findOne(id, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update playlist' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete playlist' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.playlistsService.remove(id, userId);
  }

  @Post(':id/tracks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add tracks to playlist' })
  addTracks(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddTracksDto,
  ) {
    return this.playlistsService.addTracks(id, userId, dto.youtubeIds);
  }

  @Delete(':id/tracks/:trackId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove track from playlist' })
  removeTrack(
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.playlistsService.removeTrack(id, userId, trackId);
  }

  @Put(':id/tracks/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder tracks' })
  reorder(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.playlistsService.reorderTracks(id, userId, dto.trackIds);
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate share code' })
  share(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.playlistsService.generateShareCode(id, userId);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import playlist from YouTube URL' })
  importPlaylist(@CurrentUser('id') userId: string, @Body() dto: ImportDto) {
    return this.playlistsService.importFromYoutube(userId, dto.youtubeUrl);
  }
}
