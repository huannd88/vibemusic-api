import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscoveryService } from './discovery.service';

@ApiTags('discovery')
@Controller('discovery')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  @Get('trending')
  @ApiOperation({ summary: 'Trending tracks by country' })
  @ApiQuery({ name: 'country', required: false, example: 'VN' })
  getTrending(@Query('country') country?: string) {
    return this.discoveryService.getTrending(country);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Most popular tracks by country' })
  @ApiQuery({ name: 'country', required: false, example: 'VN' })
  getPopular(@Query('country') country?: string) {
    return this.discoveryService.getPopular(country);
  }

  @Get('new-tracks')
  @ApiOperation({ summary: 'New releases / debut tracks' })
  @ApiQuery({ name: 'country', required: false, example: 'VN' })
  getNewTracks(@Query('country') country?: string) {
    return this.discoveryService.getNewTracks(country);
  }

  @Get('charts')
  @ApiOperation({ summary: 'Top charts — biggest movers' })
  @ApiQuery({ name: 'country', required: false, example: 'ZZ' })
  getCharts(@Query('country') country?: string) {
    return this.discoveryService.getCharts(country);
  }

  @Get('artists')
  @ApiOperation({ summary: 'Top artists by country' })
  @ApiQuery({ name: 'country', required: false, example: 'VN' })
  getArtists(@Query('country') country?: string) {
    return this.discoveryService.getArtists(country);
  }

  @Get('playlists')
  @ApiOperation({ summary: 'Top playlists by country' })
  @ApiQuery({ name: 'country', required: false, example: 'VN' })
  getPlaylists(@Query('country') country?: string) {
    return this.discoveryService.getPlaylists(country);
  }

  @Get('genres')
  @ApiOperation({ summary: 'Genre list' })
  getGenres() {
    return this.discoveryService.getGenres();
  }

  @Get('genres/:code/videos')
  @ApiOperation({ summary: 'Videos by genre' })
  @ApiQuery({ name: 'region', required: false, example: 'VN' })
  getGenreVideos(@Param('code') code: string, @Query('region') region?: string) {
    return this.discoveryService.getGenreVideos(code, region);
  }

  @Get('mood/categories')
  @ApiOperation({ summary: 'Mood categories' })
  getMoodCategories() {
    return this.discoveryService.getMoodCategories();
  }

  @Get('mood/:id/playlists')
  @ApiOperation({ summary: 'Playlists by mood category' })
  getMoodPlaylists(@Param('id') id: string) {
    return this.discoveryService.getMoodPlaylists(id);
  }
}
