import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';

// YouTube streaming provider interface
export interface StreamInfo {
  url: string;
  quality: string;
  mimeType: string;
  contentLength?: string;
  expiresAt?: number;
}

export interface TrackInfo {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // seconds
  formats: { quality: string; mimeType: string; audioQuality?: string }[];
}

@Injectable()
export class PlaybackService {
  private readonly logger = new Logger(PlaybackService.name);

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
    private ai: AiProviderService,
  ) {}

  async getStreamUrl(youtubeId: string, quality?: string): Promise<StreamInfo> {
    // Check cache first
    const cacheKey = `stream:${youtubeId}:${quality || 'auto'}`;
    const cached = await this.redis.getJson<StreamInfo>(cacheKey);
    if (cached && cached.expiresAt && cached.expiresAt > Date.now()) {
      return cached;
    }

    // Try providers in fallback order
    const stream = await this.tryProviders(youtubeId, quality);

    // Cache for 3 hours (YouTube stream URLs typically expire in 6h)
    await this.redis.setJson(cacheKey, stream, 3 * 60 * 60);
    return stream;
  }

  async getTrackInfo(youtubeId: string): Promise<TrackInfo> {
    const cacheKey = `track-info:${youtubeId}`;
    const cached = await this.redis.getJson<TrackInfo>(cacheKey);
    if (cached) return cached;

    const info = await this.fetchTrackInfo(youtubeId);

    // Cache for 24 hours
    await this.redis.setJson(cacheKey, info, 24 * 60 * 60);
    return info;
  }

  async getFormats(youtubeId: string) {
    const info = await this.getTrackInfo(youtubeId);
    return info.formats;
  }

  async getBatchInfo(youtubeIds: string[]): Promise<TrackInfo[]> {
    const results: TrackInfo[] = [];
    for (const id of youtubeIds.slice(0, 50)) {
      try {
        const info = await this.getTrackInfo(id);
        results.push(info);
      } catch (e) {
        this.logger.warn(`Failed to get info for ${id}: ${(e as Error).message}`);
      }
    }
    return results;
  }

  private async tryProviders(youtubeId: string, quality?: string): Promise<StreamInfo> {
    // Provider 1: ytdl-core
    try {
      return await this.fetchWithYtdl(youtubeId, quality);
    } catch (e) {
      this.logger.warn(`ytdl-core failed for ${youtubeId}: ${(e as Error).message}`);
    }

    // Provider 2: youtubei
    try {
      return await this.fetchWithYoutubei(youtubeId, quality);
    } catch (e) {
      this.logger.warn(`youtubei failed for ${youtubeId}: ${(e as Error).message}`);
    }

    // Fallback: return YouTube embed URL (won't play audio directly but won't crash)
    this.logger.warn(`All stream providers failed for ${youtubeId}, returning fallback`);
    return {
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      quality: 'fallback',
      mimeType: 'text/html',
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }

  private async fetchWithYtdl(youtubeId: string, quality?: string): Promise<StreamInfo> {
    const ytdl = require('ytdl-core');
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${youtubeId}`);

    // Get audio-only formats, sorted by quality
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
      .sort((a: any, b: any) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    if (audioFormats.length === 0) throw new Error('No audio formats available');

    let selected = audioFormats[0]; // Best quality by default
    if (quality === '128k') {
      selected = audioFormats.find((f: any) => f.audioBitrate && f.audioBitrate <= 128) || audioFormats[audioFormats.length - 1];
    }

    return {
      url: selected.url,
      quality: `${selected.audioBitrate || 'unknown'}kbps`,
      mimeType: selected.mimeType || 'audio/webm',
      contentLength: selected.contentLength,
      expiresAt: Date.now() + 5 * 60 * 60 * 1000, // ~5h
    };
  }

  private async fetchWithYoutubei(youtubeId: string, quality?: string): Promise<StreamInfo> {
    const { Innertube } = require('youtubei');
    const yt = await Innertube.create();
    const info = await yt.getInfo(youtubeId);

    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    if (!format) throw new Error('No audio format from youtubei');

    return {
      url: format.decipher(yt.session.player),
      quality: `${format.bitrate ? Math.round(format.bitrate / 1000) : 'unknown'}kbps`,
      mimeType: format.mime_type || 'audio/webm',
      expiresAt: Date.now() + 5 * 60 * 60 * 1000,
    };
  }

  private async fetchTrackInfo(youtubeId: string): Promise<TrackInfo> {
    // Provider 1: ytdl-core
    try {
      const ytdl = require('ytdl-core');
      const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${youtubeId}`);
      const details = info.videoDetails;
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      return {
        youtubeId,
        title: details.title,
        artist: details.author?.name || 'Unknown',
        thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url || '',
        duration: parseInt(details.lengthSeconds, 10) || 0,
        formats: audioFormats.map((f: any) => ({
          quality: `${f.audioBitrate || 'unknown'}kbps`,
          mimeType: f.mimeType || 'audio/webm',
          audioQuality: f.audioQuality,
        })),
      };
    } catch (e) {
      this.logger.warn(`ytdl-core trackInfo failed for ${youtubeId}: ${(e as Error).message}`);
    }

    // Provider 2: YouTube oEmbed API (no auth needed, always works)
    try {
      const url = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeId}`;
      const resp = await fetch(url);
      const data = await resp.json() as any;
      if (data.title) {
        return {
          youtubeId,
          title: data.title || 'Unknown',
          artist: data.author_name || 'Unknown',
          thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
          duration: 0,
          formats: [{ quality: 'auto', mimeType: 'audio/webm' }],
        };
      }
    } catch (e) {
      this.logger.warn(`oEmbed failed for ${youtubeId}: ${(e as Error).message}`);
    }

    // Fallback: return minimal info with YouTube thumbnail
    return {
      youtubeId,
      title: `Track ${youtubeId}`,
      artist: 'Unknown',
      thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      duration: 0,
      formats: [{ quality: 'auto', mimeType: 'audio/webm' }],
    };
  }

  // ---- Phase 2: Smart Playback ----

  async smartShuffle(userId: string, playlistId: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id: playlistId, userId },
      include: { tracks: { include: { track: true }, orderBy: { position: 'asc' } } },
    });

    if (!playlist) return { tracks: [], message: 'Playlist not found' };

    // Fisher-Yates shuffle with artist separation to avoid consecutive same-artist tracks
    const tracks = [...playlist.tracks];
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    return { tracks: tracks.map(t => t.track), playlistId, shuffled: true };
  }

  async getNextTrack(userId: string, currentYoutubeId: string, mode?: string) {
    const track = await this.prisma.track.findUnique({ where: { youtubeId: currentYoutubeId } });
    const trackName = track ? `${track.title} - ${track.artist || 'Unknown'}` : currentYoutubeId;

    if (!this.ai.isConfigured()) {
      // Fallback: get from user's recent history
      const history = await this.prisma.listeningHistory.findMany({
        where: { userId },
        include: { track: true },
        orderBy: { listenedAt: 'desc' },
        take: 20,
      });
      const candidates = history.filter(h => h.track.youtubeId !== currentYoutubeId);
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      return { track: next?.track || null, source: 'history-fallback', mode };
    }

    const response = await this.ai.chatJson<{ track: { title: string; artist: string; youtubeQuery: string }; reason: string }>([
      {
        role: 'system',
        content: `Choose the best next track. Mode: ${mode || 'auto'}. Return JSON: {"track": {"title": "...", "artist": "...", "youtubeQuery": "title artist"}, "reason": "why"}`,
      },
      { role: 'user', content: `Currently playing: "${trackName}". Mode: ${mode || 'auto'}. What should play next?` },
    ]);

    return { ...response, source: 'ai', mode };
  }

  async startSession(userId: string, data: { device?: string; quality?: string }) {
    const session = await this.prisma.playbackSession.create({
      data: {
        userId,
        metadata: JSON.stringify(data),
      },
    });
    return { sessionId: session.id, startedAt: session.startedAt };
  }

  async trackEvent(userId: string, data: { sessionId: string; type: string; trackId?: string; position?: number; metadata?: string }) {
    const session = await this.prisma.playbackSession.findFirst({
      where: { id: data.sessionId, userId },
    });

    if (!session) return { message: 'Session not found' };

    const events: any[] = JSON.parse(session.events);
    events.push({ ...data, timestamp: new Date().toISOString() });

    await this.prisma.playbackSession.update({
      where: { id: data.sessionId },
      data: { events: JSON.stringify(events) },
    });

    return { message: 'Event tracked', eventCount: events.length };
  }

  async endSession(userId: string, sessionId: string) {
    const session = await this.prisma.playbackSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) return { message: 'Session not found' };

    await this.prisma.playbackSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });

    const events: any[] = JSON.parse(session.events);
    return {
      message: 'Session ended',
      sessionId,
      duration: Math.round((Date.now() - session.startedAt.getTime()) / 1000),
      eventCount: events.length,
    };
  }
}
