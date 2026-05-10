import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async getProfile(profileId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: profileId },
      select: {
        id: true, name: true, avatarUrl: true, tier: true, createdAt: true,
        _count: {
          select: {
            playlists: true,
            favorites: true,
            following: true,
            followers: true,
          },
        },
      },
    });

    if (!user) return { error: 'User not found' };

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
      joinedAt: user.createdAt,
      stats: {
        playlists: user._count.playlists,
        favorites: user._count.favorites,
        following: user._count.following,
        followers: user._count.followers,
      },
    };
  }

  async getTasteCard(profileId: string) {
    const history = await this.prisma.listeningHistory.findMany({
      where: { userId: profileId },
      include: { track: true },
      orderBy: { listenedAt: 'desc' },
      take: 100,
    });

    const genres: Record<string, number> = {};
    const artists: Record<string, number> = {};
    for (const h of history) {
      if (h.track.artist) artists[h.track.artist] = (artists[h.track.artist] || 0) + 1;
    }

    const topArtists = Object.entries(artists).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

    return {
      userId: profileId,
      totalListens: history.length,
      topArtists,
      recentlyPlayed: history.slice(0, 5).map(h => ({ title: h.track.title, artist: h.track.artist, playedAt: h.listenedAt })),
    };
  }

  async getPublicPlaylists(profileId: string) {
    return this.prisma.playlist.findMany({
      where: { userId: profileId, isPublic: true },
      include: { _count: { select: { tracks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
