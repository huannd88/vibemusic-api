import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async getForYou(userId: string, limit: number = 20) {
    const cacheKey = `ai:for-you:${userId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    // Get user's listening history for context
    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 50,
    });

    if (history.length === 0) {
      // Cold start: return trending
      const trending = await this.prisma.trending.findMany({
        include: { track: true },
        orderBy: { rank: 'asc' },
        take: limit,
      });
      return { tracks: trending.map(t => t.track), source: 'trending-fallback' };
    }

    const trackTitles = history.map(h => `${h.track.title} - ${h.track.artist || 'Unknown'}`).slice(0, 20);
    const taste = await this.prisma.userTasteProfile.findUnique({ where: { userId } });

    if (!this.ai.isConfigured()) {
      // No AI: return simple collaborative (recent tracks shuffled)
      const recentIds = history.map(h => h.track.youtubeId);
      return { tracks: history.map(h => h.track).slice(0, limit), source: 'history-fallback', recentIds };
    }

    const response = await this.ai.chatJson<{ recommendations: { title: string; artist: string; youtubeQuery: string }[] }>([
      {
        role: 'system',
        content: `You are a music recommendation engine. Given a user's listening history, suggest ${limit} songs they might enjoy. Return JSON: {"recommendations": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]}. Focus on variety while matching their taste. Include mix of similar + discovery tracks.`,
      },
      {
        role: 'user',
        content: `Recent listens:\n${trackTitles.join('\n')}${taste ? `\nTaste profile: genres=${taste.topGenres}, moods=${taste.topMoods}` : ''}`,
      },
    ]);

    const result = { tracks: response.recommendations, source: 'ai', userId };
    await this.redis.setJson(cacheKey, result, 3600); // 1h cache
    return result;
  }

  async getRadio(userId: string, seed: string, type: string = 'track') {
    const cacheKey = `ai:radio:${userId}:${seed}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    if (!this.ai.isConfigured()) {
      return { tracks: [], source: 'ai-not-configured', seed };
    }

    const response = await this.ai.chatJson<{ tracks: { title: string; artist: string; youtubeQuery: string }[] }>([
      {
        role: 'system',
        content: `You are a radio station generator. Given a seed ${type}, generate 30 tracks for an infinite radio station. Mix similar tracks with gradually expanding taste. Return JSON: {"tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]}`,
      },
      { role: 'user', content: `Seed: ${seed} (type: ${type}). Generate 30 tracks for radio mode.` },
    ]);

    const result = { ...response, source: 'ai', seed, type };
    await this.redis.setJson(cacheKey, result, 7200); // 2h cache
    return result;
  }

  async getDiscoverWeekly(userId: string) {
    const cacheKey = `ai:discover-weekly:${userId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 100,
    });

    if (history.length < 5 || !this.ai.isConfigured()) {
      return { tracks: [], source: history.length < 5 ? 'insufficient-history' : 'ai-not-configured' };
    }

    const trackTitles = history.map(h => `${h.track.title} - ${h.track.artist || 'Unknown'}`).slice(0, 30);

    const response = await this.ai.chatJson<{ tracks: { title: string; artist: string; youtubeQuery: string; reason: string }[] }>([
      {
        role: 'system',
        content: `You are creating a Discover Weekly playlist. Suggest 20 songs the user has NEVER heard but would love based on their taste. Focus on hidden gems and new artists. Return JSON: {"tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist", "reason": "why this track"}]}`,
      },
      { role: 'user', content: `Listening history (recent 30):\n${trackTitles.join('\n')}\n\nGenerate Discover Weekly with songs they haven't heard.` },
    ]);

    const result = { ...response, source: 'ai', generatedAt: new Date().toISOString() };
    await this.redis.setJson(cacheKey, result, 7 * 24 * 3600); // 1 week
    return result;
  }

  async getSimilar(youtubeId: string) {
    const cacheKey = `ai:similar:${youtubeId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const track = await this.prisma.track.findUnique({ where: { youtubeId } });
    const trackName = track ? `${track.title} - ${track.artist || 'Unknown'}` : youtubeId;

    if (!this.ai.isConfigured()) {
      return { tracks: [], source: 'ai-not-configured', seed: youtubeId };
    }

    const response = await this.ai.chatJson<{ tracks: { title: string; artist: string; youtubeQuery: string }[] }>([
      {
        role: 'system',
        content: 'Given a song, find 15 similar tracks. Consider genre, mood, tempo, era, and vibe. Return JSON: {"tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]}',
      },
      { role: 'user', content: `Find songs similar to: "${trackName}"` },
    ]);

    const result = { ...response, source: 'ai', seed: youtubeId };
    await this.redis.setJson(cacheKey, result, 24 * 3600); // 24h cache
    return result;
  }

  async getBecauseYouListened(userId: string) {
    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 10,
    });

    if (history.length === 0 || !this.ai.isConfigured()) {
      return { sections: [], source: history.length === 0 ? 'no-history' : 'ai-not-configured' };
    }

    const recentTracks = history.slice(0, 3).map(h => `${h.track.title} - ${h.track.artist || 'Unknown'}`);

    const response = await this.ai.chatJson<{ sections: { becauseOf: string; tracks: { title: string; artist: string; youtubeQuery: string }[] }[] }>([
      {
        role: 'system',
        content: 'Create "Because you listened to..." recommendations. For each of the given tracks, suggest 5 related tracks. Return JSON: {"sections": [{"becauseOf": "Song - Artist", "tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]}]}',
      },
      { role: 'user', content: `Create recommendations based on:\n${recentTracks.join('\n')}` },
    ]);

    return { ...response, source: 'ai' };
  }

  async submitFeedback(userId: string, data: { trackId: string; type: 'like' | 'dislike'; context?: string }) {
    // Store feedback for taste model updates
    await this.redis.setJson(`ai:feedback:${userId}:${data.trackId}`, data, 30 * 24 * 3600);
    // Invalidate for-you cache so next request reflects feedback
    await this.redis.del(`ai:for-you:${userId}`);
    return { message: 'Feedback recorded' };
  }
}
