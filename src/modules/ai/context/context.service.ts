import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';

@Injectable()
export class ContextService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async reportContext(userId: string, data: { timeOfDay?: string; activity?: string; weather?: string; location?: string; metadata?: string }) {
    await this.prisma.contextEvent.create({
      data: { userId, ...data },
    });
    // Cache latest context for quick access
    await this.redis.setJson(`context:latest:${userId}`, { ...data, reportedAt: new Date().toISOString() }, 3600);
    return { message: 'Context reported' };
  }

  async getSuggestion(userId: string) {
    const context = await this.redis.getJson<any>(`context:latest:${userId}`);
    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 10,
    });

    if (!this.ai.isConfigured()) {
      // Default suggestions based on time
      const hour = new Date().getHours();
      const defaults: Record<string, string[]> = {
        morning: ['upbeat pop', 'morning motivation'],
        working: ['lo-fi beats', 'focus music'],
        exercising: ['workout hits', 'EDM energy'],
        relaxing: ['chill acoustic', 'ambient'],
        sleeping: ['sleep sounds', 'soft piano'],
      };
      const activity = context?.activity || (hour < 12 ? 'morning' : 'relaxing');
      return { suggestion: defaults[activity] || ['chill vibes'], context, source: 'default' };
    }

    const recentTracks = history.map(h => `${h.track.title}`).slice(0, 5).join(', ');
    const response = await this.ai.chatJson<{ suggestion: string; mood: string; tracks: { title: string; artist: string; youtubeQuery: string }[] }>([
      {
        role: 'system',
        content: 'Given user context, suggest music. Return JSON: {"suggestion": "description", "mood": "detected_mood", "tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]} with 10 tracks.',
      },
      {
        role: 'user',
        content: `Context: ${JSON.stringify(context || {})}. Recent: ${recentTracks || 'none'}. Suggest music.`,
      },
    ]);

    return { ...response, context, source: 'ai' };
  }
}
