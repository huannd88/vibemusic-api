import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { nanoid } from 'nanoid';

interface KaraokeJob {
  id: string;
  userId: string;
  youtubeId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

@Injectable()
export class KaraokeService {
  private readonly logger = new Logger(KaraokeService.name);

  constructor(private redis: RedisService) {}

  async prepare(userId: string, youtubeId: string) {
    const jobId = nanoid(16);

    const job: KaraokeJob = {
      id: jobId,
      userId,
      youtubeId,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    await this.redis.setJson(`karaoke:job:${jobId}`, job, 24 * 3600);

    // In production: queue a BullMQ job for vocal separation using Demucs/Spleeter
    // The worker would:
    // 1. Download audio from YouTube
    // 2. Run vocal separation (Demucs model)
    // 3. Save instrumental + vocal tracks
    // 4. Update job status to 'ready'

    // Simulate processing for now
    job.status = 'processing';
    job.progress = 50;
    await this.redis.setJson(`karaoke:job:${jobId}`, job, 24 * 3600);

    return {
      jobId,
      youtubeId,
      status: 'queued',
      message:
        'Vocal separation queued. Requires Demucs/Spleeter integration for production.',
      estimatedTime: '30-60 seconds (when integrated)',
    };
  }

  async getStatus(jobId: string) {
    const job = await this.redis.getJson<KaraokeJob>(`karaoke:job:${jobId}`);
    if (!job) return { error: 'Job not found or expired' };

    return {
      jobId: job.id,
      youtubeId: job.youtubeId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  async getStream(jobId: string) {
    const job = await this.redis.getJson<KaraokeJob>(`karaoke:job:${jobId}`);
    if (!job) return { error: 'Job not found or expired' };

    if (job.status !== 'ready') {
      return {
        jobId: job.id,
        status: job.status,
        message: `Job is ${job.status}. Wait until status is 'ready'.`,
      };
    }

    // In production: return stream URL for separated audio
    return {
      jobId: job.id,
      youtubeId: job.youtubeId,
      streams: {
        instrumental: null, // URL to instrumental track
        vocal: null, // URL to isolated vocal track
      },
      message: 'Audio separation requires Demucs integration',
    };
  }

  async transpose(userId: string, data: { jobId: string; semitones: number }) {
    const job = await this.redis.getJson<KaraokeJob>(
      `karaoke:job:${data.jobId}`,
    );
    if (!job) return { error: 'Job not found' };

    // In production: use FFmpeg to pitch-shift the audio
    return {
      jobId: data.jobId,
      originalKey: 'C',
      transposedBy: data.semitones,
      newKey: `${data.semitones > 0 ? '+' : ''}${data.semitones} semitones`,
      message: 'Transpose requires FFmpeg integration for production',
    };
  }
}
