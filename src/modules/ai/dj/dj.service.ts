import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';

interface DjSession {
  userId: string;
  mood: string;
  energy: string;
  genres: string[];
  playedTracks: string[];
  feedback: { trackId: string; type: 'up' | 'down' }[];
  startedAt: string;
}

@Injectable()
export class DjService {
  private readonly logger = new Logger(DjService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async start(
    userId: string,
    preferences?: { mood?: string; genres?: string[] },
  ) {
    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 30,
    });

    const recentTracks = history.map(
      (h) => `${h.track.title} - ${h.track.artist || 'Unknown'}`,
    );

    const session: DjSession = {
      userId,
      mood: preferences?.mood || 'auto',
      energy: 'medium',
      genres: preferences?.genres || [],
      playedTracks: [],
      feedback: [],
      startedAt: new Date().toISOString(),
    };

    await this.redis.setJson(`dj:session:${userId}`, session, 4 * 3600);

    // Get first track from AI
    const firstTrack = await this.getNextTrackFromAI(
      userId,
      session,
      recentTracks,
    );

    return {
      sessionId: userId,
      status: 'active',
      firstTrack,
      mood: session.mood,
    };
  }

  async next(userId: string) {
    const session = await this.redis.getJson<DjSession>(`dj:session:${userId}`);
    if (!session)
      return {
        error: 'No active DJ session',
        message: 'Start a DJ session first',
      };

    const history = await this.prisma.listeningHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 20,
    });
    const recentTracks = history.map(
      (h) => `${h.track.title} - ${h.track.artist || 'Unknown'}`,
    );

    const track = await this.getNextTrackFromAI(userId, session, recentTracks);
    session.playedTracks.push(track.title || 'unknown');
    await this.redis.setJson(`dj:session:${userId}`, session, 4 * 3600);

    return { track, sessionTracksPlayed: session.playedTracks.length };
  }

  async command(userId: string, text: string) {
    const session = await this.redis.getJson<DjSession>(`dj:session:${userId}`);
    if (!session) return { error: 'No active DJ session' };

    if (!this.ai.isConfigured()) {
      return {
        message: 'Command received',
        interpreted: text,
        action: 'ai-not-configured',
      };
    }

    const response = await this.ai.chatJson<{
      action: string;
      mood?: string;
      energy?: string;
      genre?: string;
      response: string;
    }>([
      {
        role: 'system',
        content:
          'You are an AI DJ assistant. Interpret user commands about music. Return JSON: {"action": "change_mood|change_energy|change_genre|skip|replay|info", "mood": "new_mood_if_changed", "energy": "low|medium|high", "genre": "genre_if_changed", "response": "DJ response text"}',
      },
      { role: 'user', content: text },
    ]);

    // Update session based on command
    if (response.mood) session.mood = response.mood;
    if (response.energy) session.energy = response.energy;
    if (response.genre)
      session.genres = [response.genre, ...session.genres.slice(0, 4)];
    await this.redis.setJson(`dj:session:${userId}`, session, 4 * 3600);

    return { ...response, sessionUpdated: true };
  }

  async feedback(
    userId: string,
    data: { trackId: string; type: 'up' | 'down' },
  ) {
    const session = await this.redis.getJson<DjSession>(`dj:session:${userId}`);
    if (!session) return { error: 'No active DJ session' };

    session.feedback.push(data);
    await this.redis.setJson(`dj:session:${userId}`, session, 4 * 3600);

    return {
      message: 'Feedback recorded',
      totalFeedback: session.feedback.length,
    };
  }

  async commentary(userId: string, trackId: string) {
    if (!this.ai.isConfigured()) {
      return { trackId, commentary: null, source: 'ai-not-configured' };
    }

    const cacheKey = `dj:commentary:${trackId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const track = await this.prisma.track.findUnique({
      where: { youtubeId: trackId },
    });
    const trackName = track
      ? `${track.title} - ${track.artist || 'Unknown'}`
      : trackId;

    const response = await this.ai.chatJson<{
      commentary: string;
      funFact: string;
      transition: string;
    }>([
      {
        role: 'system',
        content:
          'You are an enthusiastic AI DJ. Write a short, engaging DJ commentary introducing a song. Include a fun fact. Return JSON: {"commentary": "DJ intro text (2-3 sentences)", "funFact": "interesting fact about song/artist", "transition": "transition phrase to next song"}',
      },
      { role: 'user', content: `Introduce this song: "${trackName}"` },
    ]);

    const result = { trackId, ...response, source: 'ai' };
    await this.redis.setJson(cacheKey, result, 24 * 3600);
    return result;
  }

  async stop(userId: string) {
    const session = await this.redis.getJson<DjSession>(`dj:session:${userId}`);
    if (!session) return { message: 'No active session' };

    await this.redis.del(`dj:session:${userId}`);

    return {
      message: 'DJ session ended',
      tracksPlayed: session.playedTracks.length,
      duration: Math.round(
        (Date.now() - new Date(session.startedAt).getTime()) / 1000,
      ),
      feedbackGiven: session.feedback.length,
    };
  }

  private async getNextTrackFromAI(
    userId: string,
    session: DjSession,
    recentTracks: string[],
  ) {
    if (!this.ai.isConfigured()) {
      return { title: 'AI DJ requires API key', artist: '', youtubeQuery: '' };
    }

    const response = await this.ai.chatJson<{
      title: string;
      artist: string;
      youtubeQuery: string;
      djNote: string;
    }>([
      {
        role: 'system',
        content: `You are an AI DJ selecting the perfect next track. Consider: mood=${session.mood}, energy=${session.energy}, genres=${session.genres.join(',') || 'any'}. Avoid tracks already played: ${session.playedTracks.join(', ') || 'none'}. Return JSON: {"title": "...", "artist": "...", "youtubeQuery": "title artist", "djNote": "why this track fits the vibe"}`,
      },
      {
        role: 'user',
        content: `Recent history: ${recentTracks.slice(0, 10).join(', ')}. Feedback: ${session.feedback.map((f) => `${f.trackId}:${f.type}`).join(', ') || 'none'}. Pick the next track.`,
      },
    ]);

    return response;
  }
}
