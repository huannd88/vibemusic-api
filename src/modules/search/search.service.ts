import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private redis: RedisService) {}

  async search(query: string, type: string = 'video', limit: number = 20) {
    if (!query?.trim()) return { results: [] };

    const cacheKey = `search:${query}:${type}:${limit}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    try {
      const { Innertube } = require('youtubei');
      const yt = await Innertube.create();

      let results;
      if (type === 'playlist') {
        results = await yt.search(query, { type: 'playlist' });
      } else {
        results = await yt.search(query, { type: 'video' });
      }

      const items = (results.results || []).slice(0, limit).map((item: any) => ({
        youtubeId: item.id,
        title: item.title?.text || item.title || '',
        artist: item.author?.name || '',
        thumbnail: item.thumbnails?.[0]?.url || '',
        duration: item.duration?.seconds || 0,
        viewCount: item.view_count?.text || '',
        type,
      }));

      const response = { results: items, query, type };
      await this.redis.setJson(cacheKey, response, 30 * 60); // 30 min cache
      return response;
    } catch (e) {
      this.logger.error(`Search failed: ${(e as Error).message}`);
      return { results: [], query, type, error: 'Search temporarily unavailable' };
    }
  }

  async suggest(query: string) {
    if (!query?.trim()) return { suggestions: [] };

    const cacheKey = `suggest:${query}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    try {
      const { Innertube } = require('youtubei');
      const yt = await Innertube.create();
      const suggestions = await yt.getSearchSuggestions(query);

      const response = { suggestions: suggestions || [], query };
      await this.redis.setJson(cacheKey, response, 60 * 60); // 1h cache
      return response;
    } catch (e) {
      this.logger.error(`Suggest failed: ${(e as Error).message}`);
      return { suggestions: [], query };
    }
  }
}
