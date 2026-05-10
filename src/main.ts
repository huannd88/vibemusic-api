import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('VibeMusic API')
    .setDescription('AI Music OS — Your Personal AI DJ')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('system', 'Health & Config')
    .addTag('auth', 'Authentication')
    .addTag('users', 'User Management')
    .addTag('playback', 'Streaming & Playback')
    .addTag('search', 'Search & Autocomplete')
    .addTag('discovery', 'Trending, Charts, Genres, Mood')
    .addTag('playlists', 'Playlist Management')
    .addTag('library', 'Favorites, History, Queue, Backup')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🎵 VibeMusic API running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
}
bootstrap();
