import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { AiProviderService } from '../ai/ai-provider.service';

interface LrcLibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

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
    if (cached) {
      // If cached result was a 404, throw again
      if (cached._notFound) {
        throw new NotFoundException(`No lyrics found for ${youtubeId}`);
      }
      return cached;
    }

    // First get track info to know title/artist for LRCLIB lookup
    const trackInfo = await this.getTrackMetadata(youtubeId);
    if (!trackInfo || !trackInfo.title) {
      // Cache the not-found to avoid repeated lookups
      await this.redis.setJson(cacheKey, { _notFound: true }, 3600);
      throw new NotFoundException(`No lyrics found for ${youtubeId}`);
    }

    // Try LRCLIB API (free, no auth)
    try {
      const lyrics = await this.fetchFromLrcLib(trackInfo.title, trackInfo.artist);
      if (lyrics) {
        const result = {
          youtubeId,
          title: trackInfo.title,
          artist: trackInfo.artist,
          lyrics: lyrics.syncedLyrics || lyrics.plainLyrics,
          plainLyrics: lyrics.plainLyrics || null,
          syncedLyrics: lyrics.syncedLyrics || null,
          synced: !!lyrics.syncedLyrics,
          instrumental: lyrics.instrumental,
          source: 'lrclib',
        };
        await this.redis.setJson(cacheKey, result, 24 * 3600);
        return result;
      }
    } catch (e) {
      this.logger.warn(`LRCLIB failed for ${trackInfo.title}: ${(e as Error).message}`);
    }

    // No lyrics found
    const notFoundResult = {
      youtubeId,
      title: trackInfo.title,
      artist: trackInfo.artist,
      lyrics: null,
      synced: false,
      source: 'none',
      message: 'No lyrics found for this track',
    };
    await this.redis.setJson(cacheKey, notFoundResult, 6 * 3600);
    return notFoundResult;
  }

  async searchLyrics(query: string) {
    const cacheKey = `lyrics:search:${query}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    // Search LRCLIB
    try {
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'VibeMusic API v1.0' },
      });

      if (resp.ok) {
        const data = (await resp.json()) as LrcLibResult[];
        const results = data.slice(0, 10).map((item) => ({
          id: item.id,
          trackName: item.trackName,
          artistName: item.artistName,
          albumName: item.albumName || null,
          duration: item.duration || null,
          instrumental: item.instrumental,
          hasLyrics: !!item.plainLyrics || !!item.syncedLyrics,
          hasSyncedLyrics: !!item.syncedLyrics,
        }));
        const result = { query, results, total: results.length, source: 'lrclib' };
        await this.redis.setJson(cacheKey, result, 3600);
        return result;
      }
    } catch (e) {
      this.logger.warn(`LRCLIB search failed: ${(e as Error).message}`);
    }

    const result = { query, results: [], total: 0, source: 'none', message: 'No results found' };
    await this.redis.setJson(cacheKey, result, 3600);
    return result;
  }

  async translateLyrics(youtubeId: string, targetLang: string) {
    if (!this.ai.isConfigured()) {
      return { youtubeId, translated: null, targetLang, source: 'ai-not-configured' };
    }

    const lyricsData = await this.getLyrics(youtubeId);
    if (!lyricsData.lyrics) {
      return { youtubeId, translated: null, targetLang, message: 'No lyrics available to translate' };
    }

    const response = await this.ai.chatJson<{ translated: string; originalLang: string }>([
      {
        role: 'system',
        content: `Translate these song lyrics to ${targetLang}. Preserve the poetic feel. Return JSON: {"translated": "translated lyrics line by line", "originalLang": "detected language"}`,
      },
      { role: 'user', content: lyricsData.lyrics },
    ]);

    return { youtubeId, ...response, targetLang, source: 'ai' };
  }

  // --- Private helpers ---

  private async fetchFromLrcLib(title: string, artist?: string): Promise<LrcLibResult | null> {
    // Clean title: remove common YouTube suffixes
    const cleanTitle = title
      .replace(/\s*\(Official\s*(Music\s*)?Video\)/i, '')
      .replace(/\s*\[Official\s*(Music\s*)?Video\]/i, '')
      .replace(/\s*\(Official\s*Audio\)/i, '')
      .replace(/\s*\(Official\s*Video\)/i, '')
      .replace(/\s*\(Lyrics?\s*Video\)/i, '')
      .replace(/\s*\(Lyrics?\)/i, '')
      .replace(/\s*\(Lyric\s*Video\)/i, '')
      .replace(/\s*\(4K\s*Remaster(ed)?\)/i, '')
      .replace(/\s*\(HD\)/i, '')
      .replace(/\s*\(HQ\)/i, '')
      .replace(/\s*\(M\/V\)/i, '')
      .replace(/\s*\(MV\)/i, '')
      .replace(/\s*\(Audio\)/i, '')
      .replace(/\s*\(Visualizer\)/i, '')
      .replace(/\s*\|.*$/, '')
      .replace(/\s*ft\.?\s*.*/i, '')
      .trim();

    // Try exact match first
    const params = new URLSearchParams({ track_name: cleanTitle });
    if (artist) params.set('artist_name', artist);

    try {
      const url = `https://lrclib.net/api/get?${params.toString()}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'VibeMusic API v1.0' },
      });

      if (resp.ok) {
        const data = (await resp.json()) as LrcLibResult;
        if (data && (data.plainLyrics || data.syncedLyrics)) {
          return data;
        }
      }
    } catch (e) {
      this.logger.warn(`LRCLIB get failed: ${(e as Error).message}`);
    }

    // Fallback: search
    try {
      const searchQuery = artist ? `${cleanTitle} ${artist}` : cleanTitle;
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
      const resp = await fetch(searchUrl, {
        headers: { 'User-Agent': 'VibeMusic API v1.0' },
      });

      if (resp.ok) {
        const results = (await resp.json()) as LrcLibResult[];
        if (results.length > 0) {
          // Return the first result with lyrics
          const withLyrics = results.find((r) => r.plainLyrics || r.syncedLyrics);
          return withLyrics || null;
        }
      }
    } catch (e) {
      this.logger.warn(`LRCLIB search fallback failed: ${(e as Error).message}`);
    }

    return null;
  }

  private async getTrackMetadata(youtubeId: string): Promise<{ title: string; artist?: string } | null> {
    // Try oEmbed for quick metadata
    try {
      const url = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeId}`;
      const resp = await fetch(url);
      const data = (await resp.json()) as any;
      if (data.title) {
        // Parse "Artist - Title (Official Video)" format common on YouTube
        let title = data.title;
        let artist = data.author_name || undefined;

        // If title contains " - ", extract artist from title (more accurate)
        const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        if (dashMatch) {
          artist = dashMatch[1].trim();
          title = dashMatch[2].trim();
        }

        return { title, artist };
      }
    } catch (e) {
      this.logger.warn(`oEmbed metadata failed for ${youtubeId}: ${(e as Error).message}`);
    }
    return null;
  }
}
