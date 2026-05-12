import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(
    userId: string,
    data: {
      name: string;
      description?: string;
      isPublic?: boolean;
      maxUsers?: number;
    },
  ) {
    const room = await this.prisma.listeningRoom.create({
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? true,
        maxUsers: data.maxUsers ?? 50,
        hostId: userId,
      },
    });

    // Auto-join host
    await this.prisma.roomParticipant.create({
      data: { roomId: room.id, userId, role: 'host' },
    });

    // Cache room state
    await this.redis.setJson(
      `room:state:${room.id}`,
      {
        currentTrack: null,
        playbackState: 'idle',
        position: 0,
        updatedAt: new Date().toISOString(),
      },
      24 * 3600,
    );

    return { ...room, participantCount: 1 };
  }

  async listPublic() {
    const rooms = await this.prisma.listeningRoom.findMany({
      where: { isPublic: true, closedAt: null },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rooms.map((r) => ({
      ...r,
      participantCount: r._count.participants,
      _count: undefined,
    }));
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.listeningRoom.findUnique({
      where: { id: roomId },
      include: {
        host: { select: { id: true, name: true, avatarUrl: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!room) return { error: 'Room not found' };

    const state = await this.redis.getJson<any>(`room:state:${roomId}`);

    return {
      ...room,
      playbackState: state || { currentTrack: null, playbackState: 'idle' },
    };
  }

  async join(userId: string, roomId: string) {
    const room = await this.prisma.listeningRoom.findUnique({
      where: { id: roomId },
      include: {
        _count: { select: { participants: { where: { leftAt: null } } } },
      },
    });

    if (!room || room.closedAt) return { error: 'Room not found or closed' };
    if (room._count.participants >= room.maxUsers)
      return { error: 'Room is full' };

    // Upsert participant
    const existing = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (existing && !existing.leftAt) return { message: 'Already in room' };

    if (existing) {
      await this.prisma.roomParticipant.update({
        where: { id: existing.id },
        data: { leftAt: null, joinedAt: new Date() },
      });
    } else {
      await this.prisma.roomParticipant.create({
        data: { roomId, userId, role: 'listener' },
      });
    }

    return { message: 'Joined room', roomId };
  }

  async leave(userId: string, roomId: string) {
    const participant = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!participant || participant.leftAt) return { message: 'Not in room' };

    await this.prisma.roomParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });

    return { message: 'Left room', roomId };
  }

  async deleteRoom(userId: string, roomId: string) {
    const room = await this.prisma.listeningRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== userId) return { error: 'Only host can delete room' };

    await this.prisma.listeningRoom.update({
      where: { id: roomId },
      data: { closedAt: new Date() },
    });

    await this.redis.del(`room:state:${roomId}`);

    return { message: 'Room closed', roomId };
  }
}
