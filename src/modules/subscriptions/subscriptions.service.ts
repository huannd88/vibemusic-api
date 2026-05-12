import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { nanoid } from 'nanoid';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tier: 'FREE',
    price: 0,
    currency: 'USD',
    features: [
      'Nghe nhạc YouTube không giới hạn',
      'Background playback',
      'Search & Discovery',
      'Playlists (tối đa 10)',
      'Hum to Search',
      'Seasonal Music',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tier: 'PREMIUM',
    price: 2.99,
    currency: 'USD',
    billingCycle: 'monthly',
    features: [
      'Tất cả tính năng Free',
      'AI Recommendation cá nhân hóa',
      'AI Mood Engine',
      'AI DJ Agent',
      'Smart Playback',
      'Memory Music (On This Day, Nostalgia)',
      'Lyrics dịch thuật',
      'Playlists không giới hạn',
      'Listening Rooms',
      'Blend Playlists',
      'Không quảng cáo',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'PRO',
    price: 4.99,
    currency: 'USD',
    billingCycle: 'monthly',
    features: [
      'Tất cả tính năng Premium',
      'Voice Assistant tiếng Việt',
      'AI Karaoke (vocal separation)',
      'HQ Audio (320kbps)',
      'Context-Aware AI',
      'Offline mode',
      'Priority support',
      'Early access features',
    ],
  },
];

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private prisma: PrismaService) {}

  getPlans() {
    return { plans: PLANS };
  }

  async purchase(userId: string, data: { planId: string; receipt?: string }) {
    const plan = PLANS.find((p) => p.id === data.planId);
    if (!plan) return { error: 'Invalid plan' };
    if (plan.id === 'free') return { error: 'Cannot purchase Free tier' };

    const tier = plan.tier as 'PREMIUM' | 'PRO';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Upsert subscription
    await this.prisma.subscription.upsert({
      where: { userId },
      update: { tier, status: 'ACTIVE', startedAt: new Date(), expiresAt },
      create: {
        userId,
        tier,
        status: 'ACTIVE',
        startedAt: new Date(),
        expiresAt,
      },
    });

    // Update user tier
    await this.prisma.user.update({
      where: { id: userId },
      data: { tier },
    });

    // In production: verify receipt with Apple/Google
    return {
      message: 'Subscription activated',
      plan: plan.name,
      tier,
      expiresAt: expiresAt.toISOString(),
      receipt: data.receipt ? 'verified' : 'no-receipt',
    };
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!sub || sub.status === 'CANCELLED')
      return { message: 'No active subscription' };

    await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { tier: 'FREE' },
    });

    return {
      message: 'Subscription cancelled',
      effectiveUntil: sub.expiresAt?.toISOString() || 'immediately',
    };
  }

  async restore(userId: string, data: { receipt: string }) {
    // In production: verify receipt with Apple/Google to check active subscription
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      return { message: 'No subscription found to restore', restored: false };
    }

    if (sub.expiresAt && sub.expiresAt > new Date()) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { status: 'ACTIVE' },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { tier: sub.tier },
      });
      return {
        message: 'Subscription restored',
        tier: sub.tier,
        restored: true,
      };
    }

    return {
      message: 'Subscription expired, please purchase again',
      restored: false,
    };
  }

  async getReferral(userId: string) {
    let referral = await this.prisma.referral.findUnique({ where: { userId } });

    if (!referral) {
      referral = await this.prisma.referral.create({
        data: {
          userId,
          code: `VIBE-${nanoid(8).toUpperCase()}`,
        },
      });
    }

    return {
      code: referral.code,
      usedCount: referral.usedBy.length,
      bonusDays: referral.bonusDays,
      shareUrl: `https://vibemusic.app/ref/${referral.code}`,
    };
  }

  async applyReferral(userId: string, data: { code: string }) {
    const referral = await this.prisma.referral.findUnique({
      where: { code: data.code },
    });

    if (!referral) return { error: 'Invalid referral code' };
    if (referral.userId === userId)
      return { error: 'Cannot use your own referral code' };
    if (referral.usedBy.includes(userId))
      return { error: 'Already used this code' };

    // Grant bonus days to referrer
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        usedBy: { push: userId },
        bonusDays: { increment: 7 },
      },
    });

    // Grant bonus days to new user — extend or create subscription
    const bonus = 7;
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + bonus);

    if (sub) {
      const currentExpiry =
        sub.expiresAt && sub.expiresAt > new Date()
          ? sub.expiresAt
          : new Date();
      currentExpiry.setDate(currentExpiry.getDate() + bonus);
      await this.prisma.subscription.update({
        where: { userId },
        data: { expiresAt: currentExpiry, tier: 'PREMIUM', status: 'ACTIVE' },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          userId,
          tier: 'PREMIUM',
          status: 'ACTIVE',
          expiresAt: newExpiry,
        },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { tier: 'PREMIUM' },
    });

    return {
      message: 'Referral applied',
      bonusDays: bonus,
      referrerBonus: bonus,
      newTier: 'PREMIUM',
    };
  }
}
