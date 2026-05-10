import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private client: OpenAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get('AI_API_KEY') || this.config.get('OPENAI_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: this.config.get('AI_BASE_URL') || 'https://openrouter.ai/api/v1',
      });
      this.logger.log(`AI Provider initialized (base: ${this.config.get('AI_BASE_URL') || 'openrouter.ai'})`);
    } else {
      this.logger.warn('AI Provider not configured — AI features will use fallback mode');
    }
  }

  async chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean },
  ): Promise<string> {
    const model = options?.model || this.config.get('AI_MODEL') || 'openai/gpt-4o-mini';

    try {
      if (!this.client) throw new Error('AI not configured');
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
        ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`AI chat failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async chatJson<T>(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<T> {
    const result = await this.chat(messages, { ...options, jsonMode: true });
    try {
      return JSON.parse(result) as T;
    } catch {
      this.logger.warn(`Failed to parse AI JSON: ${result.substring(0, 200)}`);
      throw new Error('AI returned invalid JSON');
    }
  }

  isConfigured(): boolean {
    const key = this.config.get('AI_API_KEY') || this.config.get('OPENAI_API_KEY');
    return !!key;
  }
}
