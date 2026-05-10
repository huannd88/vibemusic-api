import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';

@Injectable()
export class AutoPlayService {
  private readonly logger = new Logger(AutoPlayService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async play(userId: string) {
    // Get user preferences
    const prefsKey = `autoplay:settings:${userId}`;
    const prefs = await this.redis.getJson<any>(prefsKey) || {
      mode: 'smart',
      genres: [],
      avoidExplicit: false,
      maxDuration: 600,
    };

    // Get context hints
    const hour = new Date().getHours();
    let timeContext = 'daytime';
    if (hour >= 6 && hour < 12) timeContext = 'morning';
    else if (hour >= 12 && hour < 17) timeContext = 'afternoon';
    else if (hour >= 17 && hour < 21) timeContext = 'evening';
    else timeContext = 'night';

    // Get history for personalization
    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 20,
    });

    if (!this.ai.isConfigured()) {
      // Fallback: pick from history
      if (history.length > 0) {
        const random = history[Math.floor(Math.random() * history.length)];
        return {
          track: random.track,
          reason: 'Based on your listening history',
          source: 'history-fallback',
          context: { timeOfDay: timeContext },
        };
      }
      return { track: null, reason: 'No history. Play something first!', source: 'empty' };
    }

    const recentTracks = history.map(h => `${h.track.title} - ${h.track.artist || 'Unknown'}`);
    const response = await this.ai.chatJson<{
      track: { title: string; artist: string; youtubeQuery: string };
      reason: string;
    }>([
      {
        role: 'system',
        content: `You are a zero-interaction AI music selector. Pick ONE perfect track for right now. Consider: time=${timeContext}, user mode=${prefs.mode}, preferred genres=${prefs.genres.join(',') || 'any'}. Return JSON: {"track": {"title": "...", "artist": "...", "youtubeQuery": "title artist"}, "reason": "why this track right now (1 sentence)"}`,
      },
      {
        role: 'user',
        content: `Recent history: ${recentTracks.slice(0, 10).join(', ') || 'none'}. Auto-select a track.`,
      },
    ]);

    return {
      ...response,
      source: 'ai',
      context: { timeOfDay: timeContext, mode: prefs.mode },
    };
  }

  async getSettings(userId: string) {
    const prefsKey = `autoplay:settings:${userId}`;
    const prefs = await this.redis.getJson<any>(prefsKey);
    return prefs || {
      mode: 'smart',
      genres: [],
      avoidExplicit: false,
      maxDuration: 600,
      enabled: true,
    };
  }

  async updateSettings(userId: string, settings: Record<string, any>) {
    const prefsKey = `autoplay:settings:${userId}`;
    const current = await this.redis.getJson<any>(prefsKey) || {};
    const updated = { ...current, ...settings };
    await this.redis.setJson(prefsKey, updated, 365 * 24 * 3600);
    return { message: 'Settings saved', settings: updated };
  }
}
