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
      const { Client } = require('youtubei');
      const yt = new Client();

      let results;
      if (type === 'playlist') {
        results = await yt.search(query, { type: 'playlist' });
      } else {
        results = await yt.search(query, { type: 'video' });
      }

      // youtubei@1.8.x: results.items, older versions: results directly as array
      const rawItems = results.items || results || [];
      const items = rawItems.slice(0, limit).map((item: any) => ({
        youtubeId: item.id,
        title: item.title?.text || item.title || '',
        artist: item.channel?.name || item.author?.name || '',
        thumbnail:
          item.thumbnails?.[0]?.url ||
          `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        duration: item.duration?.seconds || 0,
        viewCount: item.view_count?.text || item.viewCount || '',
        type,
      }));

      const response = { results: items, query, type };
      await this.redis.setJson(cacheKey, response, 30 * 60); // 30 min cache
      return response;
    } catch (e) {
      this.logger.error(`Search failed: ${(e as Error).message}`);
      return {
        results: [],
        query,
        type,
        error: 'Search temporarily unavailable',
      };
    }
  }

  async suggest(query: string) {
    if (!query?.trim()) return { suggestions: [] };

    const cacheKey = `suggest:${query}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    try {
      // youtubei Client doesn't have getSearchSuggestions, use Google suggest API
      const url = `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&q=${encodeURIComponent(query)}&ds=yt`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const text = await resp.text();
      // Parse JSONP: window.google.ac.h(...)
      const jsonStr = text.replace(/^[^(]+\(/, '').replace(/\)$/, '');
      const data = JSON.parse(jsonStr);
      const suggestions = (data[1] || []).map((item: any) => item[0]);

      const response = { suggestions, query };
      await this.redis.setJson(cacheKey, response, 60 * 60); // 1h cache
      return response;
    } catch (e) {
      this.logger.error(`Suggest failed: ${(e as Error).message}`);
      return { suggestions: [], query };
    }
  }
}
