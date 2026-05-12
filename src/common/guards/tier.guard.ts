import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const TIER_KEY = 'requiredTier';

/**
 * Decorator to specify minimum subscription tier required for an endpoint.
 * Usage: @RequireTier('PREMIUM') or @RequireTier('PRO')
 */
export const RequireTier = (...tiers: string[]) => SetMetadata(TIER_KEY, tiers);

const TIER_HIERARCHY: Record<string, number> = {
  FREE: 0,
  PREMIUM: 1,
  PRO: 2,
};

@Injectable()
export class TierGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTiers = this.reflector.getAllAndOverride<string[]>(TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTiers || requiredTiers.length === 0) {
      return true; // No tier requirement → allow all
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tier) {
      throw new ForbiddenException('Subscription tier required');
    }

    const userTierLevel = TIER_HIERARCHY[user.tier] ?? 0;
    const minRequired = Math.min(
      ...requiredTiers.map((t) => TIER_HIERARCHY[t] ?? 0),
    );

    if (userTierLevel < minRequired) {
      throw new ForbiddenException(
        `This feature requires ${requiredTiers.join(' or ')} subscription. Current tier: ${user.tier}`,
      );
    }

    return true;
  }
}
