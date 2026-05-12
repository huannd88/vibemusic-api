import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { isApi, isProduction, getAppRole } from './common/app-role';
import { RedisIoAdapter } from './common/redis.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const appRole = getAppRole();
  const isProd = isProduction();

  const app = await NestFactory.create(AppModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ─── Security Middleware ────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // ─── Global Validation Pipe ─────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Graceful Shutdown ──────────────────────────────
  app.enableShutdownHooks();

  // ─── CORS — env-driven ─────────────────────────────
  const corsOrigins = process.env.CORS_ORIGINS;
  app.enableCors({
    origin:
      isProd && corsOrigins
        ? corsOrigins.split(',').map((o) => o.trim())
        : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ─── WebSocket Redis Adapter (API mode only) ───────
  if (isApi()) {
    const redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
  }

  // ─── Swagger — disabled in production ──────────────
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('VibeMusic API')
      .setDescription('AI Music OS — Your Personal AI DJ')
      .setVersion(process.env.npm_package_version || '0.0.1')
      .addBearerAuth()
      .addTag('system', 'Health & Config')
      .addTag('auth', 'Authentication')
      .addTag('users', 'User Management')
      .addTag('playback', 'Streaming & Playback')
      .addTag('search', 'Search & Autocomplete')
      .addTag('discovery', 'Trending, Charts, Genres, Mood')
      .addTag('discovery-sync', 'Manual data sync triggers')
      .addTag('playlists', 'Playlist Management')
      .addTag('library', 'Favorites, History, Queue, Backup')
      .addTag('ai', 'AI Features')
      .addTag('lyrics', 'Lyrics')
      .addTag('social', 'Social Features')
      .addTag('notifications', 'Notifications')
      .addTag('subscriptions', 'Subscriptions')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  // ─── Start ─────────────────────────────────────────
  if (isApi()) {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(
      `🎵 VibeMusic [${appRole.toUpperCase()}] running on http://0.0.0.0:${port}`,
    );
    if (!isProd) {
      logger.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
    }
  } else {
    // Worker mode — no HTTP, just init app for cron/seed
    await app.init();
    logger.log(
      `🔧 VibeMusic [WORKER] started — cron jobs active, no HTTP listener`,
    );
  }
}
bootstrap();
