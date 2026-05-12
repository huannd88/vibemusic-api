import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';

@WebSocketGateway({ namespace: '/rooms', cors: { origin: '*' } })
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RoomsGateway.name);

  constructor(private redis: RedisService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    client.join(data.roomId);
    const state = await this.redis.getJson<any>(`room:state:${data.roomId}`);
    client.emit(
      'room:sync',
      state || { currentTrack: null, playbackState: 'idle', position: 0 },
    );
    this.server
      .to(data.roomId)
      .emit('room:user-joined', { userId: data.userId, socketId: client.id });
  }

  @SubscribeMessage('room:leave')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    client.leave(data.roomId);
    this.server.to(data.roomId).emit('room:user-left', { userId: data.userId });
  }

  @SubscribeMessage('room:track-change')
  async handleTrackChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; trackId: string; position?: number },
  ) {
    const state = {
      currentTrack: data.trackId,
      playbackState: 'playing',
      position: data.position || 0,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.setJson(`room:state:${data.roomId}`, state, 24 * 3600);
    this.server.to(data.roomId).emit('room:track-changed', state);
  }

  @SubscribeMessage('room:chat')
  handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; message: string },
  ) {
    this.server.to(data.roomId).emit('room:chat', {
      userId: data.userId,
      message: data.message,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('room:vote')
  async handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; trackId: string },
  ) {
    const voteKey = `room:votes:${data.roomId}`;
    const votes = (await this.redis.getJson<any[]>(voteKey)) || [];
    votes.push({
      userId: data.userId,
      trackId: data.trackId,
      at: new Date().toISOString(),
    });
    await this.redis.setJson(voteKey, votes, 3600);

    // Count votes
    const counts: Record<string, number> = {};
    for (const v of votes) counts[v.trackId] = (counts[v.trackId] || 0) + 1;

    this.server
      .to(data.roomId)
      .emit('room:vote-result', { votes: counts, totalVotes: votes.length });
  }

  @SubscribeMessage('room:kick')
  handleKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetUserId: string },
  ) {
    this.server
      .to(data.roomId)
      .emit('room:kicked', { userId: data.targetUserId });
  }
}
