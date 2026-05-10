import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search YouTube (video, playlist, channel)' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'type', required: false, enum: ['video', 'playlist', 'channel'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  search(@Query('q') q: string, @Query('type') type?: string, @Query('limit') limit?: number) {
    return this.searchService.search(q, type || 'video', limit || 20);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: true })
  suggest(@Query('q') q: string) {
    return this.searchService.suggest(q);
  }
}
