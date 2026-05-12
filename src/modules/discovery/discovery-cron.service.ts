/**
 * Discovery Cron Service
 * =====================================================
 * 8 scheduled jobs to populate discovery data from YouTube.
 * Follows Upbeat cronjob patterns: scrape → upsert tracks → insert rankings → log results
 *
 * Schedule (daily):
 *   0:00  Trending (6h interval)
 *   0:10  Popular (6h interval)
 *   0:20  Charts - Biggest Movers (12h interval)
 *   0:30  New Tracks - Top Debuts (12h interval)
 *   1:00  Top Artists (24h)
 *   2:00  Top Playlists (24h)
 *   3:00  Genre Videos (24h)
 *   4:00  Mood Categories + Playlists (24h)
 *
 * On startup: runs all jobs once if DB is empty (seed mode)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  getTrendingVideos,
  getTopSongsMostPopular,
  getTopSongsBiggestMovers,
  getTopSongsTopDebuts,
  getTopArtists,
  ChartVideo,
  ChartArtist,
} from './youtube-charts.helper';

// ─── Global country list for discovery ────────────────
// Top music markets worldwide
const COUNTRIES = [
  'VN',
  'US',
  'GB',
  'KR',
  'JP',
  'IN',
  'BR',
  'DE',
  'FR',
  'MX',
  'ID',
  'TH',
  'PH',
  'ES',
  'IT',
  'CA',
  'AU',
  'TW',
  'TR',
  'RU',
  'AR',
  'CO',
  'CL',
  'PE',
  'SA',
  'EG',
  'NG',
  'ZA',
  'SE',
  'NL',
];

// Delay between country requests (ms)
const COUNTRY_DELAY = 2000;

// Genre definitions for seeding
const GENRES = [
  { code: 'pop', name: 'Pop' },
  { code: 'rock', name: 'Rock' },
  { code: 'hiphop', name: 'Hip Hop' },
  { code: 'rnb', name: 'R&B' },
  { code: 'edm', name: 'EDM' },
  { code: 'jazz', name: 'Jazz' },
  { code: 'classical', name: 'Classical' },
  { code: 'country', name: 'Country' },
  { code: 'latin', name: 'Latin' },
  { code: 'kpop', name: 'K-Pop' },
  { code: 'vpop', name: 'V-Pop' },
  { code: 'jpop', name: 'J-Pop' },
  { code: 'indie', name: 'Indie' },
  { code: 'metal', name: 'Metal' },
  { code: 'reggaeton', name: 'Reggaeton' },
  { code: 'lofi', name: 'Lo-Fi' },
];

// Mood categories for seeding
const MOOD_CATEGORIES = [
  { name: 'Chill', params: 'chill vibes playlist' },
  { name: 'Energetic', params: 'energetic workout playlist' },
  { name: 'Happy', params: 'happy feel good playlist' },
  { name: 'Sad', params: 'sad emotional playlist' },
  { name: 'Romantic', params: 'romantic love songs playlist' },
  { name: 'Focus', params: 'focus study concentration playlist' },
  { name: 'Sleep', params: 'sleep relaxing calm playlist' },
  { name: 'Party', params: 'party dance playlist' },
  { name: 'Road Trip', params: 'road trip driving playlist' },
  { name: 'Workout', params: 'workout gym motivation playlist' },
  { name: 'Morning', params: 'morning wake up playlist' },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Lock TTL — max time a single cron job is expected to run (30 min)
const LOCK_TTL_SECONDS = 30 * 60;

@Injectable()
export class DiscoveryCronService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryCronService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Startup: Seed if DB is empty ───────────────────

  async onModuleInit() {
    // Check if we have any discovery data
    const trendingCount = await this.prisma.trending.count();
    const genreCount = await this.prisma.genre.count();

    if (trendingCount === 0 || genreCount === 0) {
      this.logger.log('🌱 No discovery data found — starting initial seed...');
      // Run seed in background (don't block app startup)
      // Distributed lock prevents multiple instances from seeding simultaneously
      setTimeout(async () => {
        const acquired = await this.redis.acquireLock(
          'lock:cron:seed',
          LOCK_TTL_SECONDS * 4,
        );
        if (acquired) {
          try {
            await this.seedAllData();
          } finally {
            await this.redis.releaseLock('lock:cron:seed');
          }
        } else {
          this.logger.log(
            '🌱 Seed already running on another instance, skipping',
          );
        }
      }, 5000);
    } else {
      this.logger.log(
        `✅ Discovery data exists: ${trendingCount} trending, ${genreCount} genres`,
      );
    }
  }

  async seedAllData() {
    this.logger.log('🌱 Seeding all discovery data...');
    const jobs = [
      { name: 'genres', fn: () => this.syncGenres() },
      { name: 'moods', fn: () => this.syncMoods() },
      { name: 'trending', fn: () => this.syncTrending() },
      { name: 'popular', fn: () => this.syncPopular() },
      { name: 'charts', fn: () => this.syncCharts() },
      { name: 'new-tracks', fn: () => this.syncNewTracks() },
      { name: 'artists', fn: () => this.syncArtists() },
      { name: 'playlists', fn: () => this.syncPlaylists() },
    ];

    for (const job of jobs) {
      try {
        await job.fn();
        this.logger.log(`🌱 Seed ${job.name}: done`);
        await delay(3000); // Space out requests
      } catch (e) {
        this.logger.error(
          `🌱 Seed ${job.name}: failed — ${(e as Error).message}`,
        );
      }
    }
    this.logger.log('🌱 Seed complete!');
  }

  // ─── Cron Schedules ─────────────────────────────────

  @Cron('0 0 0,6,12,18 * * *') // Every 6h
  async handleTrending() {
    await this.syncTrending();
  }

  @Cron('0 10 0,6,12,18 * * *') // Every 6h, offset 10min
  async handlePopular() {
    await this.syncPopular();
  }

  @Cron('0 20 0,12 * * *') // Every 12h
  async handleCharts() {
    await this.syncCharts();
  }

  @Cron('0 30 0,12 * * *') // Every 12h
  async handleNewTracks() {
    await this.syncNewTracks();
  }

  @Cron('0 0 1 * * *') // Daily 1:00
  async handleArtists() {
    await this.syncArtists();
  }

  @Cron('0 0 2 * * *') // Daily 2:00
  async handlePlaylists() {
    await this.syncPlaylists();
  }

  @Cron('0 0 3 * * *') // Daily 3:00
  async handleGenres() {
    await this.syncGenres();
  }

  @Cron('0 0 4 * * *') // Daily 4:00
  async handleMoods() {
    await this.syncMoods();
  }

  // ─── Public methods for manual trigger ──────────────

  async runJob(
    jobName: string,
  ): Promise<{ status: string; records: number; duration: number }> {
    const jobMap: Record<string, () => Promise<number>> = {
      trending: () => this.syncTrending(),
      popular: () => this.syncPopular(),
      charts: () => this.syncCharts(),
      'new-tracks': () => this.syncNewTracks(),
      artists: () => this.syncArtists(),
      playlists: () => this.syncPlaylists(),
      genres: () => this.syncGenres(),
      moods: () => this.syncMoods(),
      all: async () => {
        await this.seedAllData();
        return 0;
      },
    };

    const fn = jobMap[jobName];
    if (!fn) {
      return { status: 'error', records: 0, duration: 0 };
    }

    const start = Date.now();
    try {
      const records = await fn();
      return { status: 'success', records, duration: Date.now() - start };
    } catch (e) {
      return { status: 'error', records: 0, duration: Date.now() - start };
    }
  }

  async getJobStatus(): Promise<any[]> {
    return this.prisma.cronjobRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  // ─── Job implementations ────────────────────────────

  private async syncTrending(): Promise<number> {
    return this.runWithLock('trending', async () => {
      let total = 0;

      for (let i = 0; i < COUNTRIES.length; i++) {
        const cc = COUNTRIES[i];
        try {
          const videos = await getTrendingVideos(cc);
          if (videos.length > 0) {
            const count = await this.upsertChartVideos(videos, 'trending');
            total += count;
            this.logger.log(`Trending ${cc}: ${count} tracks`);
          }
        } catch (e) {
          this.logger.error(`Trending ${cc}: ${(e as Error).message}`);
        }
        if (i < COUNTRIES.length - 1) await delay(COUNTRY_DELAY);
      }

      await this.redis.flushPattern('discovery:trending:*');
      return total;
    });
  }

  private async syncPopular(): Promise<number> {
    return this.runWithLock('popular', async () => {
      let total = 0;

      for (let i = 0; i < COUNTRIES.length; i++) {
        const cc = COUNTRIES[i];
        try {
          const videos = await getTopSongsMostPopular(cc);
          if (videos.length > 0) {
            // Delete old + insert fresh
            await this.prisma.popular.deleteMany({
              where: { countryCode: cc },
            });
            const count = await this.upsertPopularVideos(videos);
            total += count;
            this.logger.log(`Popular ${cc}: ${count} tracks`);
          }
        } catch (e) {
          this.logger.error(`Popular ${cc}: ${(e as Error).message}`);
        }
        if (i < COUNTRIES.length - 1) await delay(COUNTRY_DELAY);
      }

      await this.redis.flushPattern('discovery:popular:*');
      return total;
    });
  }

  private async syncCharts(): Promise<number> {
    return this.runWithLock('charts', async () => {
      let total = 0;

      // Global (ZZ) first
      try {
        const songs = await getTopSongsBiggestMovers('ZZ');
        if (songs.length > 0) {
          await this.prisma.chart.deleteMany({
            where: { countryCode: 'ZZ', chartType: 'top' },
          });
          const count = await this.upsertChartEntries(songs, 'top');
          total += count;
          this.logger.log(`Charts ZZ: ${count} tracks`);
        }
      } catch (e) {
        this.logger.error(`Charts ZZ: ${(e as Error).message}`);
      }

      for (let i = 0; i < COUNTRIES.length; i++) {
        const cc = COUNTRIES[i];
        try {
          const songs = await getTopSongsBiggestMovers(cc);
          if (songs.length > 0) {
            await this.prisma.chart.deleteMany({
              where: { countryCode: cc, chartType: 'top' },
            });
            const count = await this.upsertChartEntries(songs, 'top');
            total += count;
            this.logger.log(`Charts ${cc}: ${count} tracks`);
          }
        } catch (e) {
          this.logger.error(`Charts ${cc}: ${(e as Error).message}`);
        }
        if (i < COUNTRIES.length - 1) await delay(COUNTRY_DELAY);
      }

      await this.redis.flushPattern('discovery:charts:*');
      return total;
    });
  }

  private async syncNewTracks(): Promise<number> {
    return this.runWithLock('new-tracks', async () => {
      let total = 0;

      for (let i = 0; i < COUNTRIES.length; i++) {
        const cc = COUNTRIES[i];
        try {
          const songs = await getTopSongsTopDebuts(cc);
          if (songs.length > 0) {
            await this.prisma.chart.deleteMany({
              where: { countryCode: cc, chartType: 'new' },
            });
            const count = await this.upsertChartEntries(songs, 'new');
            total += count;
            this.logger.log(`New Tracks ${cc}: ${count} tracks`);
          }
        } catch (e) {
          this.logger.error(`New Tracks ${cc}: ${(e as Error).message}`);
        }
        if (i < COUNTRIES.length - 1) await delay(COUNTRY_DELAY);
      }

      await this.redis.flushPattern('discovery:new-tracks:*');
      return total;
    });
  }

  private async syncArtists(): Promise<number> {
    return this.runWithLock('artists', async () => {
      let total = 0;

      for (let i = 0; i < COUNTRIES.length; i++) {
        const cc = COUNTRIES[i];
        try {
          const artists = await getTopArtists(cc);
          if (artists.length > 0) {
            await this.prisma.topArtist.deleteMany({
              where: { countryCode: cc },
            });
            const count = await this.upsertArtists(artists);
            total += count;
            this.logger.log(`Artists ${cc}: ${count} artists`);
          }
        } catch (e) {
          this.logger.error(`Artists ${cc}: ${(e as Error).message}`);
        }
        if (i < COUNTRIES.length - 1) await delay(COUNTRY_DELAY);
      }

      await this.redis.flushPattern('discovery:artists:*');
      return total;
    });
  }

  private async syncPlaylists(): Promise<number> {
    return this.runWithLock('playlists', async () => {
      let total = 0;

      for (let i = 0; i < COUNTRIES.length; i++) {
        const cc = COUNTRIES[i];
        try {
          const playlists = await this.searchTopPlaylists(cc);
          if (playlists.length > 0) {
            await this.prisma.topPlaylist.deleteMany({
              where: { countryCode: cc },
            });
            await this.prisma.topPlaylist.createMany({ data: playlists });
            total += playlists.length;
            this.logger.log(`Playlists ${cc}: ${playlists.length} playlists`);
          }
        } catch (e) {
          this.logger.error(`Playlists ${cc}: ${(e as Error).message}`);
        }
        if (i < COUNTRIES.length - 1) await delay(COUNTRY_DELAY);
      }

      await this.redis.flushPattern('discovery:playlists:*');
      return total;
    });
  }

  private async syncGenres(): Promise<number> {
    return this.runWithLock('genres', async () => {
      // 1. Seed genres
      for (const genre of GENRES) {
        await this.prisma.genre.upsert({
          where: { code: genre.code },
          create: genre,
          update: { name: genre.name },
        });
      }

      // 2. Search videos for each genre + top regions
      const topRegions = ['VN', 'US', 'KR', 'JP', 'GB'];
      let total = 0;

      for (const genre of GENRES) {
        for (const region of topRegions) {
          try {
            const videos = await this.searchGenreVideos(
              genre.code,
              genre.name,
              region,
            );
            if (videos.length > 0) {
              const dbGenre = await this.prisma.genre.findUnique({
                where: { code: genre.code },
              });
              if (!dbGenre) continue;

              // Delete old + insert fresh
              await this.prisma.genreVideo.deleteMany({
                where: { genreId: dbGenre.id, regionCode: region },
              });

              for (const v of videos) {
                const track = await this.upsertTrack(
                  v.videoId,
                  v.title,
                  v.artist,
                  v.thumbnail,
                );
                await this.prisma.genreVideo.create({
                  data: {
                    trackId: track.id,
                    genreId: dbGenre.id,
                    regionCode: region,
                  },
                });
                total++;
              }
              this.logger.log(
                `Genre ${genre.code}/${region}: ${videos.length} videos`,
              );
            }
          } catch (e) {
            this.logger.error(
              `Genre ${genre.code}/${region}: ${(e as Error).message}`,
            );
          }
          await delay(1000);
        }
      }

      await this.redis.flushPattern('discovery:genre*');
      return total;
    });
  }

  private async syncMoods(): Promise<number> {
    return this.runWithLock('moods', async () => {
      let total = 0;

      // 1. Seed mood categories
      for (const mood of MOOD_CATEGORIES) {
        await this.prisma.moodCategory
          .upsert({
            where: { id: mood.name }, // use name as lookup
            create: { name: mood.name, params: mood.params },
            update: { params: mood.params },
          })
          .catch(async () => {
            // If not found by id, find by name or create
            const existing = await this.prisma.moodCategory.findFirst({
              where: { name: mood.name },
            });
            if (!existing) {
              await this.prisma.moodCategory.create({
                data: { name: mood.name, params: mood.params },
              });
            }
          });
      }

      // 2. Search playlists for each mood category
      const categories = await this.prisma.moodCategory.findMany();
      for (const cat of categories) {
        try {
          const playlists = await this.searchMoodPlaylists(
            cat.params || cat.name,
          );
          if (playlists.length > 0) {
            await this.prisma.moodPlaylist.deleteMany({
              where: { categoryId: cat.id },
            });
            await this.prisma.moodPlaylist.createMany({
              data: playlists.map((pl) => ({
                categoryId: cat.id,
                title: pl.title,
                thumbnail: pl.thumbnail,
                youtubePlaylistId: pl.youtubePlaylistId,
              })),
            });
            total += playlists.length;
            this.logger.log(`Mood ${cat.name}: ${playlists.length} playlists`);
          }
        } catch (e) {
          this.logger.error(`Mood ${cat.name}: ${(e as Error).message}`);
        }
        await delay(1000);
      }

      await this.redis.flushPattern('discovery:mood*');
      return total;
    });
  }

  // ─── DB Helpers ─────────────────────────────────────

  private async upsertTrack(
    youtubeId: string,
    title: string,
    artist: string,
    thumbnail: string,
  ) {
    return this.prisma.track.upsert({
      where: { youtubeId },
      create: { youtubeId, title, artist, thumbnail },
      update: { title, artist, thumbnail },
    });
  }

  private async upsertChartVideos(
    videos: ChartVideo[],
    _type: string,
  ): Promise<number> {
    let count = 0;
    for (const v of videos) {
      if (!v.videoId) continue;
      const track = await this.upsertTrack(
        v.videoId,
        v.title,
        v.artist,
        v.thumbnail,
      );

      await this.prisma.trending.create({
        data: {
          trackId: track.id,
          countryCode: v.countryCode,
          rank: v.rank,
          period: v.trend,
        },
      });
      count++;
    }
    return count;
  }

  private async upsertPopularVideos(videos: ChartVideo[]): Promise<number> {
    let count = 0;
    for (const v of videos) {
      if (!v.videoId) continue;
      const track = await this.upsertTrack(
        v.videoId,
        v.title,
        v.artist,
        v.thumbnail,
      );

      await this.prisma.popular.create({
        data: {
          trackId: track.id,
          countryCode: v.countryCode,
          rank: v.rank,
          viewCount: v.viewCount?.toString() || null,
        },
      });
      count++;
    }
    return count;
  }

  private async upsertChartEntries(
    videos: ChartVideo[],
    chartType: string,
  ): Promise<number> {
    let count = 0;
    for (const v of videos) {
      if (!v.videoId) continue;
      const track = await this.upsertTrack(
        v.videoId,
        v.title,
        v.artist,
        v.thumbnail,
      );

      await this.prisma.chart.create({
        data: {
          trackId: track.id,
          countryCode: v.countryCode,
          rank: v.rank,
          trend: v.trend,
          chartType,
        },
      });
      count++;
    }
    return count;
  }

  private async upsertArtists(artists: ChartArtist[]): Promise<number> {
    let count = 0;
    for (const a of artists) {
      if (!a.name) continue;

      const channelId =
        a.channelId || `auto-${a.name.toLowerCase().replace(/\s+/g, '-')}`;
      const artist = await this.prisma.artist.upsert({
        where: { youtubeChannelId: channelId },
        create: {
          youtubeChannelId: channelId,
          name: a.name,
          thumbnail: a.thumbnail,
          country: a.countryCode,
        },
        update: { name: a.name, thumbnail: a.thumbnail },
      });

      await this.prisma.topArtist.create({
        data: {
          artistId: artist.id,
          countryCode: a.countryCode,
          rank: a.rank,
        },
      });
      count++;
    }
    return count;
  }

  // ─── Search helpers (using youtubei) ────────────────

  private async searchTopPlaylists(countryCode: string): Promise<any[]> {
    try {
      const { Client } = require('youtubei');
      const youtube = new Client();
      const countryName = this.getCountryName(countryCode);
      const results = await youtube.search(
        `top music playlist ${countryName}`,
        { type: 'playlist' },
      );
      const items = results.items || results || [];

      return items
        .slice(0, 30)
        .map((pl: any) => {
          const thumbnails = pl.thumbnails || [];
          const thumb =
            thumbnails.length > 0 ? thumbnails[thumbnails.length - 1] : null;
          return {
            youtubeId: pl.id,
            title: pl.title || '',
            thumbnail: thumb?.url || '',
            channelName: pl.channel?.name || '',
            videoCount: pl.videoCount || 0,
            countryCode,
          };
        })
        .filter((pl: any) => pl.youtubeId);
    } catch (e) {
      this.logger.error(
        `searchTopPlaylists error (${countryCode}): ${(e as Error).message}`,
      );
      return [];
    }
  }

  private async searchGenreVideos(
    genreCode: string,
    genreName: string,
    regionCode: string,
  ): Promise<
    { videoId: string; title: string; artist: string; thumbnail: string }[]
  > {
    try {
      const { Client } = require('youtubei');
      const youtube = new Client();
      const query = `${genreName} ${regionCode} music 2026`;
      const results = await youtube.search(query, { type: 'video' });
      const items = results.items || results || [];

      return items
        .slice(0, 20)
        .map((item: any) => ({
          videoId: item.id,
          title: item.title || '',
          artist: item.channel?.name || '',
          thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        }))
        .filter((v: any) => v.videoId);
    } catch (e) {
      this.logger.error(
        `searchGenreVideos error (${genreCode}/${regionCode}): ${(e as Error).message}`,
      );
      return [];
    }
  }

  private async searchMoodPlaylists(
    searchParams: string,
  ): Promise<
    { title: string; thumbnail: string; youtubePlaylistId: string }[]
  > {
    try {
      const { Client } = require('youtubei');
      const youtube = new Client();
      const results = await youtube.search(searchParams, { type: 'playlist' });
      const items = results.items || results || [];

      return items
        .slice(0, 10)
        .map((pl: any) => {
          const thumbnails = pl.thumbnails || [];
          const thumb =
            thumbnails.length > 0 ? thumbnails[thumbnails.length - 1] : null;
          return {
            title: pl.title || '',
            thumbnail: thumb?.url || '',
            youtubePlaylistId: pl.id || '',
          };
        })
        .filter((pl: any) => pl.youtubePlaylistId);
    } catch (e) {
      this.logger.error(`searchMoodPlaylists error: ${(e as Error).message}`);
      return [];
    }
  }

  // ─── Utility ────────────────────────────────────────

  private getCountryName(code: string): string {
    const map: Record<string, string> = {
      VN: 'Vietnam',
      US: 'United States',
      GB: 'United Kingdom',
      KR: 'South Korea',
      JP: 'Japan',
      IN: 'India',
      BR: 'Brazil',
      DE: 'Germany',
      FR: 'France',
      MX: 'Mexico',
      ID: 'Indonesia',
      TH: 'Thailand',
      PH: 'Philippines',
      ES: 'Spain',
      IT: 'Italy',
      CA: 'Canada',
      AU: 'Australia',
      TW: 'Taiwan',
      TR: 'Turkey',
      RU: 'Russia',
      AR: 'Argentina',
      CO: 'Colombia',
      CL: 'Chile',
      PE: 'Peru',
      SA: 'Saudi Arabia',
      EG: 'Egypt',
      NG: 'Nigeria',
      ZA: 'South Africa',
      SE: 'Sweden',
      NL: 'Netherlands',
    };
    return map[code] || code;
  }

  /**
   * Run a job with a Redis-based distributed lock.
   * Prevents duplicate execution across multiple instances and
   * prevents overlap between scheduled runs and manual triggers.
   */
  private async runWithLock(
    jobName: string,
    fn: () => Promise<number>,
  ): Promise<number> {
    const lockKey = `lock:cron:${jobName}`;

    // Attempt to acquire distributed lock
    const acquired = await this.redis.acquireLock(lockKey, LOCK_TTL_SECONDS);
    if (!acquired) {
      this.logger.warn(
        `${jobName}: lock held by another instance/run, skipping`,
      );
      return 0;
    }

    const startedAt = new Date();

    // Create cronjob run entry
    const run = await this.prisma.cronjobRun.create({
      data: { jobName, status: 'running', startedAt },
    });

    try {
      this.logger.log(`${jobName}: started...`);
      const records = await fn();

      await this.prisma.cronjobRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          recordsCount: records,
          finishedAt: new Date(),
        },
      });

      this.logger.log(`${jobName}: completed — ${records} records`);
      return records;
    } catch (e) {
      const error = (e as Error).message;
      this.logger.error(`${jobName}: failed — ${error}`);

      await this.prisma.cronjobRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error,
          finishedAt: new Date(),
        },
      });
      return 0;
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }
}
