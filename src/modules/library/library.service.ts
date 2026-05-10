import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  // ===== FAVORITES =====
  async getFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFavorite(userId: string, youtubeId: string) {
    const track = await this.prisma.track.upsert({
      where: { youtubeId },
      update: {},
      create: { youtubeId, title: youtubeId },
    });
    try {
      await this.prisma.favorite.create({ data: { userId, trackId: track.id } });
    } catch {
      // Already favorited
    }
    return { message: 'Added to favorites' };
  }

  async removeFavorite(userId: string, youtubeId: string) {
    const track = await this.prisma.track.findUnique({ where: { youtubeId } });
    if (track) {
      await this.prisma.favorite.deleteMany({ where: { userId, trackId: track.id } });
    }
    return { message: 'Removed from favorites' };
  }

  // ===== HISTORY =====
  async getHistory(userId: string, limit: number = 50, offset: number = 0) {
    const [items, total] = await Promise.all([
      this.prisma.listeningHistory.findMany({
        where: { userId },
        include: { track: true },
        orderBy: { listenedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.listeningHistory.count({ where: { userId } }),
    ]);
    return { items, total, limit, offset };
  }

  async addHistory(userId: string, data: { youtubeId: string; durationPlayed?: number; skipped?: boolean; context?: string }) {
    const track = await this.prisma.track.upsert({
      where: { youtubeId: data.youtubeId },
      update: {},
      create: { youtubeId: data.youtubeId, title: data.youtubeId },
    });
    await this.prisma.listeningHistory.create({
      data: {
        userId,
        trackId: track.id,
        durationPlayed: data.durationPlayed,
        skipped: data.skipped || false,
        context: data.context,
      },
    });
    return { message: 'History recorded' };
  }

  async clearHistory(userId: string) {
    await this.prisma.listeningHistory.deleteMany({ where: { userId } });
    return { message: 'History cleared' };
  }

  // ===== QUEUE =====
  async getQueue(userId: string) {
    const queue = await this.prisma.queue.findUnique({ where: { userId } });
    if (!queue) return { tracks: [], currentIndex: 0 };
    return {
      tracks: JSON.parse(queue.tracksJson),
      currentIndex: queue.currentIndex,
    };
  }

  async updateQueue(userId: string, data: { tracks: string[]; currentIndex: number }) {
    await this.prisma.queue.upsert({
      where: { userId },
      update: { tracksJson: JSON.stringify(data.tracks), currentIndex: data.currentIndex },
      create: { userId, tracksJson: JSON.stringify(data.tracks), currentIndex: data.currentIndex },
    });
    return { message: 'Queue updated' };
  }

  // ===== BACKUP / RESTORE =====
  async createBackup(userId: string) {
    const [playlists, favorites, history] = await Promise.all([
      this.prisma.playlist.findMany({
        where: { userId },
        include: { tracks: { include: { track: true } } },
      }),
      this.prisma.favorite.findMany({
        where: { userId },
        include: { track: true },
      }),
      this.prisma.listeningHistory.findMany({
        where: { userId },
        include: { track: true },
        take: 500,
        orderBy: { listenedAt: 'desc' },
      }),
    ]);

    const code = nanoid(12);
    const backupData = { playlists, favorites, history, createdAt: new Date().toISOString() };

    await this.prisma.backup.create({
      data: { userId, code, data: JSON.stringify(backupData) },
    });

    return { code, message: 'Backup created' };
  }

  async restoreBackup(userId: string, code: string) {
    const backup = await this.prisma.backup.findUnique({ where: { code } });
    if (!backup) throw new NotFoundException('Backup not found');

    const data = JSON.parse(backup.data);

    // Restore playlists
    for (const pl of data.playlists || []) {
      const playlist = await this.prisma.playlist.create({
        data: { userId, title: pl.title, isPublic: pl.isPublic },
      });
      for (const pt of pl.tracks || []) {
        const track = await this.prisma.track.upsert({
          where: { youtubeId: pt.track.youtubeId },
          update: {},
          create: {
            youtubeId: pt.track.youtubeId,
            title: pt.track.title,
            artist: pt.track.artist,
            thumbnail: pt.track.thumbnail,
            duration: pt.track.duration,
          },
        });
        try {
          await this.prisma.playlistTrack.create({
            data: { playlistId: playlist.id, trackId: track.id, position: pt.position },
          });
        } catch {}
      }
    }

    // Restore favorites
    for (const fav of data.favorites || []) {
      const track = await this.prisma.track.upsert({
        where: { youtubeId: fav.track.youtubeId },
        update: {},
        create: {
          youtubeId: fav.track.youtubeId,
          title: fav.track.title,
          artist: fav.track.artist,
        },
      });
      try {
        await this.prisma.favorite.create({ data: { userId, trackId: track.id } });
      } catch {}
    }

    return { message: 'Backup restored successfully' };
  }
}
