import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { AiProviderService } from '../ai/ai-provider.service';

@Injectable()
export class LyricsService {
  private readonly logger = new Logger(LyricsService.name);

  constructor(
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async getLyrics(youtubeId: string) {
    const cacheKey = `lyrics:${youtubeId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    // Try to fetch lyrics from external sources
    // In production, integrate with MusixMatch, Genius, or LRCLIB API
    // For now, use AI to generate approximate lyrics
    const result = { youtubeId, lyrics: null, synced: false, source: 'none', message: 'Lyrics service requires external API integration (MusixMatch/Genius/LRCLIB)' };
    await this.redis.setJson(cacheKey, result, 24 * 3600);
    return result;
  }

  async searchLyrics(query: string) {
    const cacheKey = `lyrics:search:${query}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const result = { query, results: [], source: 'none', message: 'Lyrics search requires external API integration' };
    await this.redis.setJson(cacheKey, result, 3600);
    return result;
  }

  async translateLyrics(youtubeId: string, targetLang: string) {
    if (!this.ai.isConfigured()) {
      return { youtubeId, translated: null, targetLang, source: 'ai-not-configured' };
    }

    const lyrics = await this.getLyrics(youtubeId);
    if (!lyrics.lyrics) {
      return { youtubeId, translated: null, targetLang, message: 'No lyrics available to translate' };
    }

    const response = await this.ai.chatJson<{ translated: string; originalLang: string }>([
      {
        role: 'system',
        content: `Translate these song lyrics to ${targetLang}. Preserve the poetic feel. Return JSON: {"translated": "translated lyrics line by line", "originalLang": "detected language"}`,
      },
      { role: 'user', content: lyrics.lyrics },
    ]);

    return { youtubeId, ...response, targetLang, source: 'ai' };
  }
}
