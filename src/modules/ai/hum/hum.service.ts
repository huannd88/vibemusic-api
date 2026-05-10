import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';
import { nanoid } from 'nanoid';

@Injectable()
export class HumService {
  private readonly logger = new Logger(HumService.name);

  constructor(
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async recognize(userId: string, data: { audio?: string; description?: string }) {
    const resultId = nanoid(12);

    if (data.description && this.ai.isConfigured()) {
      // Text-based hum description → AI identification
      const response = await this.ai.chatJson<{ matches: { title: string; artist: string; confidence: number; youtubeQuery: string }[] }>([
        {
          role: 'system',
          content: 'User is humming or describing a song melody. Identify the song. Return JSON: {"matches": [{"title": "...", "artist": "...", "confidence": 0.0-1.0, "youtubeQuery": "title artist"}]} with up to 5 matches sorted by confidence.',
        },
        { role: 'user', content: `I'm trying to find a song: ${data.description}` },
      ]);

      await this.redis.setJson(`hum:result:${resultId}`, {
        id: resultId, userId, status: 'completed', ...response,
        source: 'ai-text', createdAt: new Date().toISOString(),
      }, 3600);

      return { resultId, status: 'completed', ...response };
    }

    // Audio-based recognition requires Google Hum-to-Search or similar API
    await this.redis.setJson(`hum:result:${resultId}`, {
      id: resultId, userId, status: 'pending',
      message: 'Audio hum recognition requires integration with Google Hum-to-Search API or ACRCloud.',
      createdAt: new Date().toISOString(),
    }, 3600);

    return {
      resultId,
      status: 'pending',
      message: 'Audio recognition requires external API. Use description field as text fallback.',
    };
  }

  async getResult(resultId: string) {
    const result = await this.redis.getJson<any>(`hum:result:${resultId}`);
    if (!result) return { error: 'Result not found or expired' };
    return result;
  }
}
