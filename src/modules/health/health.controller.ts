import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@ApiTags('system')
@Controller()
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check — DB, Redis, uptime' })
  async health() {
    let dbHealthy = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {}

    const redisHealthy = await this.redis.isHealthy();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const status = dbHealthy && redisHealthy ? 'ok' : 'degraded';

    return {
      status,
      uptime,
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('config')
  @ApiOperation({ summary: 'App config & feature flags' })
  getConfig() {
    return {
      version: '1.0.0',
      features: {
        // Phase 1
        playback: true,
        search: true,
        discovery: true,
        playlists: true,
        library: true,
        // Phase 2
        ai_recommend: true,
        ai_mood: true,
        ai_context: true,
        smart_playback: true,
        lyrics: true,
        // Phase 3
        ai_dj: true,
        ai_voice: true,
        ai_karaoke: true,
        ai_hum: true,
        ai_memory: true,
        // Phase 4
        social_rooms: true,
        profiles: true,
        follows: true,
        notifications: true,
        // Phase 5
        subscriptions: true,
        auto_play: true,
      },
    };
  }
}
