import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const CACHE_TTL_6H = 6 * 60 * 60;
const CACHE_TTL_24H = 24 * 60 * 60;

@Injectable()
export class DiscoveryService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getTrending(country: string = 'VN') {
    return this.cachedQuery(`discovery:trending:${country}`, CACHE_TTL_6H, () =>
      this.prisma.trending.findMany({
        where: { countryCode: country },
        include: { track: true },
        orderBy: { rank: 'asc' },
        take: 30,
      }),
    );
  }

  async getPopular(country: string = 'VN') {
    return this.cachedQuery(`discovery:popular:${country}`, CACHE_TTL_6H, () =>
      this.prisma.popular.findMany({
        where: { countryCode: country },
        include: { track: true },
        orderBy: { rank: 'asc' },
        take: 100,
      }),
    );
  }

  async getNewTracks(country: string = 'VN') {
    return this.cachedQuery(`discovery:new-tracks:${country}`, CACHE_TTL_6H, () =>
      this.prisma.chart.findMany({
        where: { countryCode: country, chartType: 'new' },
        include: { track: true },
        orderBy: { rank: 'asc' },
        take: 30,
      }),
    );
  }

  async getCharts(country: string = 'ZZ') {
    return this.cachedQuery(`discovery:charts:${country}`, CACHE_TTL_6H, () =>
      this.prisma.chart.findMany({
        where: { countryCode: country, chartType: 'top' },
        include: { track: true },
        orderBy: { rank: 'asc' },
        take: 50,
      }),
    );
  }

  async getArtists(country: string = 'VN') {
    return this.cachedQuery(`discovery:artists:${country}`, CACHE_TTL_6H, () =>
      this.prisma.topArtist.findMany({
        where: { countryCode: country },
        include: { artist: true },
        orderBy: { rank: 'asc' },
        take: 100,
      }),
    );
  }

  async getPlaylists(country: string = 'VN') {
    return this.cachedQuery(`discovery:playlists:${country}`, CACHE_TTL_6H, () =>
      this.prisma.topPlaylist.findMany({
        where: { countryCode: country },
        take: 60,
      }),
    );
  }

  async getGenres() {
    return this.cachedQuery('discovery:genres', CACHE_TTL_24H, () =>
      this.prisma.genre.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async getGenreVideos(genreCode: string, region: string = 'VN') {
    return this.cachedQuery(`discovery:genre:${genreCode}:${region}`, CACHE_TTL_6H, async () => {
      const genre = await this.prisma.genre.findUnique({ where: { code: genreCode } });
      if (!genre) return [];
      return this.prisma.genreVideo.findMany({
        where: { genreId: genre.id, regionCode: region },
        include: { track: true },
        take: 30,
      });
    });
  }

  async getMoodCategories() {
    return this.cachedQuery('discovery:mood:categories', CACHE_TTL_24H, () =>
      this.prisma.moodCategory.findMany(),
    );
  }

  async getMoodPlaylists(categoryId: string) {
    return this.cachedQuery(`discovery:mood:${categoryId}`, CACHE_TTL_6H, () =>
      this.prisma.moodPlaylist.findMany({
        where: { categoryId },
      }),
    );
  }

  private async cachedQuery<T>(key: string, ttl: number, queryFn: () => Promise<T>): Promise<T> {
    const cached = await this.redis.getJson<T>(key);
    if (cached) return cached;

    const result = await queryFn();
    await this.redis.setJson(key, result, ttl);
    return result;
  }
}
