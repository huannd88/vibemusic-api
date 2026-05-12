import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiProviderService } from '../../ai/ai-provider.service';

@Injectable()
export class FollowsService {
  constructor(
    private prisma: PrismaService,
    private ai: AiProviderService,
  ) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) return { error: 'Cannot follow yourself' };

    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
    });
    if (!target) return { error: 'User not found' };

    try {
      await this.prisma.follow.create({
        data: { followerId, followingId },
      });

      // Create notification
      await this.prisma.notification.create({
        data: {
          userId: followingId,
          type: 'follow',
          title: 'New follower',
          body: `Someone started following you`,
          data: JSON.stringify({ followerId }),
        },
      });

      return { message: 'Followed', followingId };
    } catch {
      return { message: 'Already following' };
    }
  }

  async unfollow(followerId: string, followingId: string) {
    try {
      await this.prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
      return { message: 'Unfollowed', followingId };
    } catch {
      return { message: 'Not following' };
    }
  }

  async getFollowing(userId: string) {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, name: true, avatarUrl: true, tier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return follows.map((f) => ({ ...f.following, followedAt: f.createdAt }));
  }

  async getFollowers(userId: string) {
    const follows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, name: true, avatarUrl: true, tier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return follows.map((f) => ({ ...f.follower, followedAt: f.createdAt }));
  }

  async getFeed(userId: string) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    if (followingIds.length === 0)
      return { feed: [], message: 'Follow people to see their activity' };

    // Get recent activity from followed users
    const recentHistory = await this.prisma.listeningHistory.findMany({
      where: { userId: { in: followingIds } },
      include: {
        track: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { listenedAt: 'desc' },
      take: 30,
    });

    return {
      feed: recentHistory.map((h) => ({
        type: 'listened',
        user: h.user,
        track: h.track,
        at: h.listenedAt,
      })),
    };
  }

  async blend(userId: string, otherUserId: string) {
    const [myHistory, theirHistory] = await Promise.all([
      this.prisma.listeningHistory.findMany({
        where: { userId },
        include: { track: true },
        orderBy: { listenedAt: 'desc' },
        take: 50,
      }),
      this.prisma.listeningHistory.findMany({
        where: { userId: otherUserId },
        include: { track: true },
        orderBy: { listenedAt: 'desc' },
        take: 50,
      }),
    ]);

    if (!this.ai.isConfigured()) {
      // Merge and deduplicate
      const allTracks = [...myHistory, ...theirHistory].map((h) => h.track);
      const unique = [
        ...new Map(allTracks.map((t) => [t.youtubeId, t])).values(),
      ];
      return {
        tracks: unique.slice(0, 20),
        source: 'merge',
        blendWith: otherUserId,
      };
    }

    const myTracks = myHistory
      .slice(0, 15)
      .map((h) => `${h.track.title} - ${h.track.artist || 'Unknown'}`);
    const theirTracks = theirHistory
      .slice(0, 15)
      .map((h) => `${h.track.title} - ${h.track.artist || 'Unknown'}`);

    const response = await this.ai.chatJson<{
      playlistTitle: string;
      tracks: { title: string; artist: string; youtubeQuery: string }[];
    }>([
      {
        role: 'system',
        content:
          'Create a "Blend" playlist combining two users\' music tastes. Find songs they might both enjoy. Return JSON: {"playlistTitle": "creative blend name", "tracks": [{"title": "...", "artist": "...", "youtubeQuery": "title artist"}]} with 20 tracks.',
      },
      {
        role: 'user',
        content: `User A likes: ${myTracks.join(', ')}. User B likes: ${theirTracks.join(', ')}. Create a blend playlist.`,
      },
    ]);

    return { ...response, source: 'ai', blendWith: otherUserId };
  }
}
