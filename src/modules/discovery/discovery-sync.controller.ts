import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DiscoveryCronService } from './discovery-cron.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Manual trigger endpoints for discovery sync jobs.
 * Protected by JWT auth — only authenticated users can trigger syncs.
 *
 * In production, this should be further restricted (e.g. admin-only).
 * For now, JWT guard prevents unauthenticated public access.
 */
@ApiTags('discovery-sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('discovery/sync')
export class DiscoverySyncController {
  constructor(private cronService: DiscoveryCronService) {}

  @Post(':job')
  @ApiOperation({ summary: 'Manual trigger a discovery sync job' })
  async triggerJob(@Param('job') job: string) {
    const validJobs = [
      'trending',
      'popular',
      'charts',
      'new-tracks',
      'artists',
      'playlists',
      'genres',
      'moods',
      'all',
    ];
    if (!validJobs.includes(job)) {
      return { error: `Invalid job. Valid: ${validJobs.join(', ')}` };
    }

    // Run async — don't wait for completion
    const promise = this.cronService.runJob(job);

    if (job === 'all') {
      return { message: `All jobs started in background`, status: 'running' };
    }

    const result = await promise;
    return {
      job,
      ...result,
      durationMs: result.duration,
      durationSec: (result.duration / 1000).toFixed(1),
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get recent cronjob run history' })
  async getStatus() {
    const runs = await this.cronService.getJobStatus();
    return { runs, total: runs.length };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List available sync jobs' })
  getJobs() {
    return {
      jobs: [
        {
          name: 'trending',
          schedule: 'Every 6h',
          description: 'YouTube trending videos',
        },
        {
          name: 'popular',
          schedule: 'Every 6h',
          description: 'Most popular songs',
        },
        {
          name: 'charts',
          schedule: 'Every 12h',
          description: 'Top charts - biggest movers',
        },
        {
          name: 'new-tracks',
          schedule: 'Every 12h',
          description: 'Top debuts / new releases',
        },
        { name: 'artists', schedule: 'Daily 1:00', description: 'Top artists' },
        {
          name: 'playlists',
          schedule: 'Daily 2:00',
          description: 'Top playlists',
        },
        {
          name: 'genres',
          schedule: 'Daily 3:00',
          description: '16 genres + videos',
        },
        {
          name: 'moods',
          schedule: 'Daily 4:00',
          description: '11 mood categories + playlists',
        },
        {
          name: 'all',
          schedule: 'Manual',
          description: 'Run all jobs sequentially',
        },
      ],
    };
  }
}
