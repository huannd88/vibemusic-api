# VibeMusic API

> NestJS backend cho VibeMusic — AI Music OS
>
> Swagger UI: `http://localhost:3000/api-docs`

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | NestJS | 11.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 6.x |
| Cache | Redis (ioredis) | 7 |
| Queue | BullMQ | 5.x |
| Auth | Passport + JWT | — |
| YouTube | ytdl-core + youtubei | — |
| Docs | Swagger (@nestjs/swagger) | — |

---

## Setup & Run

### Prerequisites

- Node.js ≥ 18
- PostgreSQL 16 running (via `vibemusic-infra`)
- Redis 7 running (via `vibemusic-infra`)

### Development

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Run database migrations
npx prisma migrate dev

# 4. Start dev server (hot reload)
npm run start:dev

# Server: http://localhost:3000
# Swagger: http://localhost:3000/api-docs
```

### Production Build

```bash
# Build
npm run build

# Run
npm run start:prod
# → Runs dist/main.js
```

### All npm scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run start:debug` | Dev with debugger |
| `npm run build` | Production build → `dist/` |
| `npm run start:prod` | Run production build |
| `npm run lint` | ESLint fix |
| `npm run format` | Prettier format |
| `npm run test` | Unit tests |
| `npm run test:watch` | Unit tests (watch mode) |
| `npm run test:cov` | Test coverage |
| `npm run test:e2e` | E2E tests |

### Prisma commands

| Command | Description |
|---------|-------------|
| `npx prisma generate` | Generate client from schema |
| `npx prisma migrate dev` | Create & apply migration |
| `npx prisma migrate deploy` | Apply migrations (production) |
| `npx prisma studio` | Visual DB browser (port 5555) |
| `npx prisma db push` | Push schema without migration |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `3000` | Server port |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `REDIS_HOST` | ❌ | `localhost` | Redis host |
| `REDIS_PORT` | ❌ | `6379` | Redis port |
| `JWT_SECRET` | ✅ | — | JWT signing secret |
| `JWT_EXPIRATION` | ❌ | `15m` | Access token TTL |
| `JWT_REFRESH_SECRET` | ✅ | — | Refresh token secret |
| `JWT_REFRESH_EXPIRATION` | ❌ | `7d` | Refresh token TTL |
| `GOOGLE_CLIENT_ID` | ❌ | — | Google OAuth (Phase 1) |
| `GOOGLE_CLIENT_SECRET` | ❌ | — | Google OAuth |
| `OPENAI_API_KEY` | ❌ | — | AI features (Phase 2+) |
| `GEMINI_API_KEY` | ❌ | — | AI features (Phase 2+) |

---

## Project Structure

```
src/
├── main.ts                        # Bootstrap, Swagger, CORS
├── app.module.ts                  # Root module
├── prisma/                        # PrismaService (global)
├── redis/                         # RedisService (global)
├── common/decorators/             # @CurrentUser
└── modules/
    ├── health/                    # /health, /config
    ├── auth/                      # /auth/*
    ├── users/                     # /users/*
    ├── playback/                  # /playback/*
    ├── search/                    # /search/*
    ├── discovery/                 # /discovery/*
    ├── playlists/                 # /playlists/*
    └── library/                   # /library/*
```

### Module pattern

Mỗi module gồm 3 files:
```
modules/<name>/
├── <name>.module.ts       # NestJS module declaration
├── <name>.controller.ts   # Route handlers + Swagger decorators
└── <name>.service.ts      # Business logic
```

---

## API Endpoints — Phase 1 (Implemented ✅)

### System — 2 endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Health check (DB, Redis, uptime) |
| GET | `/config` | ❌ | Feature flags |

### Auth — 8 endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Email + password |
| POST | `/auth/login` | ❌ | Login → tokens |
| POST | `/auth/google` | ❌ | Google OAuth |
| POST | `/auth/apple` | ❌ | Apple Sign-In (stub) |
| POST | `/auth/refresh` | 🔑 | Refresh token rotation |
| POST | `/auth/logout` | 🔒 | Revoke all tokens |
| POST | `/auth/forgot-password` | ❌ | Send reset email |
| POST | `/auth/reset-password` | ❌ | Reset with token |

### Users — 6 endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | 🔒 | Profile |
| PUT | `/users/me` | 🔒 | Update profile |
| GET | `/users/me/devices` | 🔒 | Device list |
| DELETE | `/users/me/devices/:id` | 🔒 | Remove device |
| GET | `/users/me/subscription` | 🔒 | Subscription info |
| DELETE | `/users/me` | 🔒 | Delete account |

### Playback — 4 endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/playback/stream/:youtubeId` | 🔒 | Audio stream URL (fallback: ytdl → youtubei) |
| GET | `/playback/info/:youtubeId` | 🔒 | Track metadata |
| GET | `/playback/formats/:youtubeId` | 🔒 | Available qualities |
| POST | `/playback/batch-info` | 🔒 | Batch track info (max 50) |

### Search — 2 endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search?q=&type=&limit=` | 🔒 | YouTube search |
| GET | `/search/suggest?q=` | 🔒 | Autocomplete |

### Discovery — 10 endpoints

| Method | Endpoint | Auth | Cache | Description |
|--------|----------|------|-------|-------------|
| GET | `/discovery/trending?country=` | 🔒 | 6h | Trending |
| GET | `/discovery/popular?country=` | 🔒 | 6h | Most popular |
| GET | `/discovery/new-tracks?country=` | 🔒 | 6h | New releases |
| GET | `/discovery/charts?country=` | 🔒 | 6h | Top charts |
| GET | `/discovery/artists?country=` | 🔒 | 6h | Top artists |
| GET | `/discovery/playlists?country=` | 🔒 | 6h | Top playlists |
| GET | `/discovery/genres` | 🔒 | 24h | Genre list |
| GET | `/discovery/genres/:code/videos` | 🔒 | 6h | Videos by genre |
| GET | `/discovery/mood/categories` | 🔒 | 24h | Mood categories |
| GET | `/discovery/mood/:id/playlists` | 🔒 | 6h | Mood playlists |

### Playlists — 11 endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/playlists` | 🔒 | Create |
| GET | `/playlists` | 🔒 | List user playlists |
| GET | `/playlists/:id` | 🔒 | Get + tracks |
| PUT | `/playlists/:id` | 🔒 | Update |
| DELETE | `/playlists/:id` | 🔒 | Delete |
| POST | `/playlists/:id/tracks` | 🔒 | Add tracks |
| DELETE | `/playlists/:id/tracks/:trackId` | 🔒 | Remove track |
| PUT | `/playlists/:id/tracks/reorder` | 🔒 | Reorder |
| POST | `/playlists/:id/share` | 🔒 | Generate share code |
| GET | `/playlists/shared/:code` | ❌ | Get by share code |
| POST | `/playlists/import` | 🔒 | Import from YouTube URL |

### Library — 9 endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/library/favorites` | 🔒 | List favorites |
| POST | `/library/favorites/:youtubeId` | 🔒 | Add favorite |
| DELETE | `/library/favorites/:youtubeId` | 🔒 | Remove |
| GET | `/library/history?limit=&offset=` | 🔒 | Listening history |
| POST | `/library/history` | 🔒 | Record listen |
| DELETE | `/library/history` | 🔒 | Clear history |
| GET | `/library/queue` | 🔒 | Current queue |
| PUT | `/library/queue` | 🔒 | Update queue |
| POST | `/library/backup` | 🔒 | Create backup |
| POST | `/library/restore` | 🔒 | Restore backup |

**Auth legend**: ❌ Public · 🔑 Refresh token · 🔒 JWT Bearer token

**Total Phase 1: 52 endpoints**

> Phase 2-5 endpoints → xem [plan.md](../plan.md)

---

## Database

Schema: `prisma/schema.prisma` (26 models)

```bash
# View current schema
npx prisma studio

# Create migration after schema changes
npx prisma migrate dev --name <description>
```

## Caching Strategy

| Data | TTL | Key pattern |
|------|-----|-------------|
| Stream URLs | 3h | `stream:<youtubeId>:<quality>` |
| Track info | 24h | `track-info:<youtubeId>` |
| Search results | 30min | `search:<query>:<type>:<limit>` |
| Suggestions | 1h | `suggest:<query>` |
| Discovery data | 6h/24h | `discovery:<type>:<country>` |

## Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| `Cannot find module '@prisma/client'` | `npx prisma generate` |
| DB connection refused | Check Docker: `docker-compose ps` |
| Redis connection refused | Check Docker + `REDIS_HOST` in `.env` |
| YouTube stream 403 | IP bị rate limit, đợi hoặc đổi IP |
| Port 3000 in use | `lsof -i :3000` → kill hoặc đổi `PORT` |
