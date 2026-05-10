import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, tier: true, authProvider: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true, tier: true },
    });
  }

  async getDevices(userId: string) {
    return this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastActive: 'desc' },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    await this.prisma.userDevice.deleteMany({ where: { id: deviceId, userId } });
    return { message: 'Device removed' };
  }

  async getSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return { tier: 'FREE', status: 'ACTIVE', expiresAt: null };
    return sub;
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Account deleted' };
  }
}
