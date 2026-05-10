import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';
import { nanoid } from 'nanoid';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async processAudioCommand(userId: string, audioBase64?: string) {
    // In production: send audio to Whisper/Google STT for transcription
    // For now, return a stub indicating the audio processing pipeline
    const responseId = nanoid(12);

    await this.redis.setJson(`voice:response:${responseId}`, {
      id: responseId,
      userId,
      status: 'processing',
      message: 'Audio command received. STT integration required (Whisper API / Google Speech-to-Text).',
      createdAt: new Date().toISOString(),
    }, 3600);

    return {
      responseId,
      status: 'processing',
      message: 'Audio STT requires Whisper API integration. Use /ai/voice/text-command as fallback.',
    };
  }

  async processTextCommand(userId: string, text: string) {
    if (!this.ai.isConfigured()) {
      return { intent: 'unknown', action: null, response: 'AI not configured', source: 'fallback' };
    }

    const response = await this.ai.chatJson<{
      intent: string;
      action: string;
      params: Record<string, any>;
      response: string;
      language: string;
    }>([
      {
        role: 'system',
        content: `You are VibeMusic voice assistant. Understand commands in Vietnamese and English. Parse intent and return JSON:
{"intent": "play|search|pause|skip|volume|mood|playlist|info|help|unknown", "action": "specific_action", "params": {"query": "...", "mood": "...", "playlist": "..."}, "response": "natural response in user's language", "language": "vi|en"}

Examples:
- "mở bài Sơn Tùng" → {"intent":"play","action":"search_and_play","params":{"query":"Sơn Tùng"},"response":"Đang tìm bài của Sơn Tùng MTP...","language":"vi"}
- "play something chill" → {"intent":"mood","action":"mood_playlist","params":{"mood":"chill"},"response":"Playing chill vibes for you...","language":"en"}`,
      },
      { role: 'user', content: text },
    ]);

    const responseId = nanoid(12);
    await this.redis.setJson(`voice:response:${responseId}`, {
      id: responseId,
      userId,
      ...response,
      originalText: text,
      createdAt: new Date().toISOString(),
    }, 3600);

    return { responseId, ...response };
  }

  async getResponse(responseId: string) {
    const response = await this.redis.getJson<any>(`voice:response:${responseId}`);
    if (!response) return { error: 'Response not found or expired' };
    return response;
  }
}
