import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async onThisDay(userId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const history = await this.prisma.listeningHistory.findMany({
      where: {
        userId,
        listenedAt: { gte: startOfDay, lt: endOfDay },
      },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 20,
    });

    return {
      date: startOfDay.toISOString().split('T')[0],
      tracksPlayed: history.length,
      tracks: history.map(h => ({
        ...h.track,
        listenedAt: h.listenedAt,
        durationPlayed: h.durationPlayed,
      })),
      message: history.length === 0 ? 'No listening history from this day last year' : undefined,
    };
  }

  async nostalgia(userId: string, period?: string) {
    const cacheKey = `memory:nostalgia:${userId}:${period || 'all'}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    // Get oldest history
    const oldHistory = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'asc' },
      take: 50,
    });

    if (oldHistory.length === 0) {
      return { tracks: [], message: 'No listening history yet' };
    }

    const tracks = oldHistory.map(h => h.track);
    const uniqueTracks = [...new Map(tracks.map(t => [t.youtubeId, t])).values()];

    if (!this.ai.isConfigured()) {
      const result = { tracks: uniqueTracks.slice(0, 20), source: 'history', period: period || 'all-time' };
      await this.redis.setJson(cacheKey, result, 24 * 3600);
      return result;
    }

    const trackNames = uniqueTracks.slice(0, 20).map(t => `${t.title} - ${t.artist || 'Unknown'}`);
    const response = await this.ai.chatJson<{ playlistTitle: string; description: string; tracks: { title: string; artist: string; youtubeQuery: string }[] }>([
      {
        role: 'system',
        content: `Create a nostalgia mix. The user's old favorites are listed below. Mix in similar songs from that era. Return JSON: {"playlistTitle": "creative title", "description": "playlist description", "tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]} with 20 tracks.`,
      },
      { role: 'user', content: `Old favorites: ${trackNames.join(', ')}. Period: ${period || 'all-time'}. Create nostalgia mix.` },
    ]);

    const result = { ...response, source: 'ai', period: period || 'all-time' };
    await this.redis.setJson(cacheKey, result, 24 * 3600);
    return result;
  }

  async patterns(userId: string) {
    const cacheKey = `memory:patterns:${userId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 500,
    });

    if (history.length === 0) {
      return { patterns: [], message: 'Insufficient listening history' };
    }

    // Calculate basic patterns
    const hourMap: Record<number, number> = {};
    const dayMap: Record<number, number> = {};
    const trackCounts: Record<string, { count: number; title: string; artist: string | null }> = {};

    for (const h of history) {
      const hour = new Date(h.listenedAt).getHours();
      const day = new Date(h.listenedAt).getDay();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
      dayMap[day] = (dayMap[day] || 0) + 1;

      const key = h.track.youtubeId;
      if (!trackCounts[key]) trackCounts[key] = { count: 0, title: h.track.title, artist: h.track.artist };
      trackCounts[key].count++;
    }

    const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
    const peakDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
    const topTracks = Object.entries(trackCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const result = {
      totalListens: history.length,
      peakListeningHour: peakHour ? { hour: +peakHour[0], count: peakHour[1] } : null,
      peakListeningDay: peakDay ? { day: dayNames[+peakDay[0]], count: peakDay[1] } : null,
      topTracks: topTracks.map(([id, data]) => ({ youtubeId: id, ...data })),
      listeningByHour: hourMap,
      listeningByDay: Object.fromEntries(Object.entries(dayMap).map(([k, v]) => [dayNames[+k], v])),
    };

    await this.redis.setJson(cacheKey, result, 6 * 3600);
    return result;
  }

  async seasonal(userId: string) {
    const month = new Date().getMonth();
    const seasonMap: Record<number, string> = {
      0: 'winter', 1: 'winter', 2: 'spring', 3: 'spring', 4: 'spring',
      5: 'summer', 6: 'summer', 7: 'summer', 8: 'autumn', 9: 'autumn',
      10: 'autumn', 11: 'winter',
    };
    const season = seasonMap[month];

    // Check for holidays
    const day = new Date().getDate();
    let holiday: string | null = null;
    if (month === 1 && day >= 10 && day <= 16) holiday = 'Tết Nguyên Đán';
    if (month === 11 && day >= 20 && day <= 25) holiday = 'Christmas';
    if (month === 9 && day === 31) holiday = 'Halloween';

    if (!this.ai.isConfigured()) {
      return { season, holiday, tracks: [], source: 'default' };
    }

    const cacheKey = `memory:seasonal:${season}:${holiday || 'none'}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const response = await this.ai.chatJson<{ tracks: { title: string; artist: string; youtubeQuery: string }[]; playlistTitle: string }>([
      {
        role: 'system',
        content: `Create a seasonal playlist for ${season}${holiday ? ` with ${holiday} theme` : ''}. Mix international and Vietnamese songs. Return JSON: {"playlistTitle": "creative title", "tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]} with 15 tracks.`,
      },
      { role: 'user', content: `Season: ${season}. Holiday: ${holiday || 'none'}. Create seasonal mix.` },
    ]);

    const result = { season, holiday, ...response, source: 'ai' };
    await this.redis.setJson(cacheKey, result, 24 * 3600);
    return result;
  }
}
