import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlaybackModule } from './modules/playback/playback.module';
import { SearchModule } from './modules/search/search.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { LibraryModule } from './modules/library/library.module';

// Phase 2
import { AiModule } from './modules/ai/ai.module';
import { LyricsModule } from './modules/lyrics/lyrics.module';

// Phase 4
import { RoomsModule } from './modules/social/rooms/rooms.module';
import { ProfilesModule } from './modules/social/profiles/profiles.module';
import { FollowsModule } from './modules/social/follows/follows.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

// Phase 5
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

import { validateEnv } from './common/env.validation';
import { isWorker } from './common/app-role';

/**
 * Root Application Module
 *
 * ScheduleModule is only registered when APP_ROLE is 'worker' or 'all'.
 * This prevents cronjobs from running on API instances in multi-instance deployments.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      { name: 'general', ttl: 60000, limit: 120 },
      { name: 'youtube', ttl: 60000, limit: 30 },
    ]),
    // Cron scheduler — only active on worker instances
    ...(isWorker() ? [ScheduleModule.forRoot()] : []),
    PrismaModule,
    RedisModule,
    // Phase 1
    HealthModule,
    AuthModule,
    UsersModule,
    PlaybackModule,
    SearchModule,
    DiscoveryModule,
    PlaylistsModule,
    LibraryModule,
    // Phase 2 + 3 + 5 (Auto Play inside AiModule)
    AiModule,
    LyricsModule,
    // Phase 4
    RoomsModule,
    ProfilesModule,
    FollowsModule,
    NotificationsModule,
    // Phase 5
    SubscriptionsModule,
  ],
})
export class AppModule {}
