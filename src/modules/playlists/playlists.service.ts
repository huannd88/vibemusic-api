import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class PlaylistsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, title: string) {
    return this.prisma.playlist.create({
      data: { userId, title },
    });
  }

  async findAll(userId: string) {
    return this.prisma.playlist.findMany({
      where: { userId },
      include: { _count: { select: { tracks: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        tracks: { include: { track: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (!playlist.isPublic && playlist.userId !== userId)
      throw new ForbiddenException();
    return playlist;
  }

  async update(
    id: string,
    userId: string,
    data: { title?: string; isPublic?: boolean },
  ) {
    await this.verifyOwner(id, userId);
    return this.prisma.playlist.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.verifyOwner(id, userId);
    await this.prisma.playlist.delete({ where: { id } });
    return { message: 'Playlist deleted' };
  }

  async addTracks(id: string, userId: string, youtubeIds: string[]) {
    await this.verifyOwner(id, userId);

    const existingTracks = await this.prisma.playlistTrack.findMany({
      where: { playlistId: id },
      orderBy: { position: 'desc' },
      take: 1,
    });
    let position =
      existingTracks.length > 0 ? existingTracks[0].position + 1 : 0;

    for (const youtubeId of youtubeIds) {
      // Upsert track
      const track = await this.prisma.track.upsert({
        where: { youtubeId },
        update: {},
        create: { youtubeId, title: youtubeId }, // Title will be updated later
      });

      // Add to playlist (skip if already exists)
      try {
        await this.prisma.playlistTrack.create({
          data: { playlistId: id, trackId: track.id, position: position++ },
        });
      } catch {
        // Unique constraint — already in playlist
      }
    }

    return this.findOne(id, userId);
  }

  async removeTrack(id: string, userId: string, trackId: string) {
    await this.verifyOwner(id, userId);
    await this.prisma.playlistTrack.deleteMany({
      where: { playlistId: id, trackId },
    });
    return { message: 'Track removed from playlist' };
  }

  async reorderTracks(id: string, userId: string, trackIds: string[]) {
    await this.verifyOwner(id, userId);
    for (let i = 0; i < trackIds.length; i++) {
      await this.prisma.playlistTrack.updateMany({
        where: { playlistId: id, trackId: trackIds[i] },
        data: { position: i },
      });
    }
    return this.findOne(id, userId);
  }

  async generateShareCode(id: string, userId: string) {
    await this.verifyOwner(id, userId);
    const shareCode = nanoid(8);
    await this.prisma.playlist.update({
      where: { id },
      data: { shareCode, isPublic: true },
    });
    return { shareCode };
  }

  async getByShareCode(code: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { shareCode: code },
      include: {
        tracks: { include: { track: true }, orderBy: { position: 'asc' } },
        user: { select: { name: true, avatarUrl: true } },
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  async importFromYoutube(userId: string, youtubeUrl: string) {
    // Extract playlist ID from URL
    const match = youtubeUrl.match(/[?&]list=([^&]+)/);
    if (!match) throw new NotFoundException('Invalid YouTube playlist URL');

    const playlistId = match[1];

    try {
      const { Innertube } = require('youtubei');
      const yt = await Innertube.create();
      const ytPlaylist = await yt.getPlaylist(playlistId);

      const playlist = await this.prisma.playlist.create({
        data: {
          userId,
          title: ytPlaylist.info?.title || `Imported Playlist`,
        },
      });

      const videos = ytPlaylist.videos || [];
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const track = await this.prisma.track.upsert({
          where: { youtubeId: video.id },
          update: { title: video.title?.text || video.id },
          create: {
            youtubeId: video.id,
            title: video.title?.text || video.id,
            artist: video.author?.name || '',
            thumbnail: video.thumbnails?.[0]?.url || '',
            duration: video.duration?.seconds || 0,
          },
        });
        await this.prisma.playlistTrack.create({
          data: { playlistId: playlist.id, trackId: track.id, position: i },
        });
      }

      return this.findOne(playlist.id, userId);
    } catch (e) {
      throw new NotFoundException(`Failed to import: ${(e as Error).message}`);
    }
  }

  private async verifyOwner(playlistId: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== userId)
      throw new ForbiddenException('Not your playlist');
  }
}
