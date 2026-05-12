import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AiProviderService } from '../ai-provider.service';

@Injectable()
export class MoodService {
  private readonly logger = new Logger(MoodService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private ai: AiProviderService,
  ) {}

  async detectMood(userId: string, text: string) {
    if (!this.ai.isConfigured()) {
      return { mood: 'neutral', confidence: 0, source: 'ai-not-configured' };
    }

    const result = await this.ai.chatJson<{
      mood: string;
      confidence: number;
      keywords: string[];
    }>([
      {
        role: 'system',
        content:
          'Detect the mood/emotion from user text. Return JSON: {"mood": "happy|sad|energetic|calm|romantic|melancholy|angry|nostalgic|focused|party", "confidence": 0.0-1.0, "keywords": ["detected", "mood", "words"]}',
      },
      { role: 'user', content: text },
    ]);

    // Save to history
    await this.prisma.moodHistory.create({
      data: { userId, mood: result.mood, source: 'text', input: text },
    });

    return { ...result, source: 'ai' };
  }

  async generateMoodPlaylist(userId: string, description: string) {
    if (!this.ai.isConfigured()) {
      return { tracks: [], mood: 'unknown', source: 'ai-not-configured' };
    }

    const response = await this.ai.chatJson<{
      mood: string;
      tracks: { title: string; artist: string; youtubeQuery: string }[];
      playlistTitle: string;
    }>([
      {
        role: 'system',
        content:
          'Create a playlist matching the mood described. Return JSON: {"mood": "detected_mood", "playlistTitle": "creative playlist name", "tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]} with 15 tracks.',
      },
      { role: 'user', content: `Create a playlist for: "${description}"` },
    ]);

    // Save mood history
    await this.prisma.moodHistory.create({
      data: {
        userId,
        mood: response.mood,
        source: 'playlist',
        input: description,
      },
    });

    return { ...response, source: 'ai' };
  }

  async getMoodHistory(userId: string) {
    return this.prisma.moodHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getMoodSuggestion(userId: string) {
    const hour = new Date().getHours();
    let timeContext: string;
    if (hour >= 5 && hour < 12) timeContext = 'morning';
    else if (hour >= 12 && hour < 17) timeContext = 'afternoon';
    else if (hour >= 17 && hour < 21) timeContext = 'evening';
    else timeContext = 'night';

    // Get recent moods
    const recentMoods = await this.prisma.moodHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (!this.ai.isConfigured()) {
      const defaultMoods: Record<string, string> = {
        morning: 'energetic',
        afternoon: 'focused',
        evening: 'calm',
        night: 'romantic',
      };
      return {
        mood: defaultMoods[timeContext],
        timeOfDay: timeContext,
        source: 'default',
      };
    }

    const response = await this.ai.chatJson<{
      mood: string;
      reason: string;
      suggestedPlaylistTitle: string;
    }>([
      {
        role: 'system',
        content:
          'Suggest a "Mood of the Day" for the user. Consider time of day and recent mood patterns. Return JSON: {"mood": "...", "reason": "why this mood", "suggestedPlaylistTitle": "creative title"}',
      },
      {
        role: 'user',
        content: `Time: ${timeContext}. Recent moods: ${recentMoods.map((m) => m.mood).join(', ') || 'none'}. Suggest mood of the day.`,
      },
    ]);

    return { ...response, timeOfDay: timeContext, source: 'ai' };
  }

  async generateProgression(userId: string, fromMood: string, toMood: string) {
    if (!this.ai.isConfigured()) {
      return {
        tracks: [],
        from: fromMood,
        to: toMood,
        source: 'ai-not-configured',
      };
    }

    const response = await this.ai.chatJson<{
      tracks: {
        title: string;
        artist: string;
        youtubeQuery: string;
        moodStage: string;
      }[];
      stages: string[];
    }>([
      {
        role: 'system',
        content: `Create an emotional progression playlist that gradually shifts from "${fromMood}" to "${toMood}". Return JSON: {"stages": ["${fromMood}", "transition1", "transition2", "${toMood}"], "tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist", "moodStage": "stage_name"}]} with 15-20 tracks.`,
      },
      {
        role: 'user',
        content: `Create emotional progression: ${fromMood} → ${toMood}`,
      },
    ]);

    await this.prisma.moodHistory.create({
      data: { userId, mood: `${fromMood}→${toMood}`, source: 'progression' },
    });

    return { ...response, from: fromMood, to: toMood, source: 'ai' };
  }
}
