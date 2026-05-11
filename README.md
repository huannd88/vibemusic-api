# 🎵 VibeMusic API

> NestJS Backend — AI Music OS · **~120 REST + 8 WebSocket endpoints**
>
> Swagger UI: `http://localhost:3000/api-docs`

---

## Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────┐
│              Client (Flutter / Web)              │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────┐
│                 NestJS Application               │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ REST API │  │ WebSocket │  │  BullMQ      │  │
│  │Controllers│ │  Gateway  │  │  Workers     │  │
│  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  │
│       └───────────────┼───────────────┘          │
│              Service Layer (DI)                  │
└───────┬───────────────┬───────────────┬──────────┘
        │               │               │
   PostgreSQL 16     Redis 7      External APIs
   (Prisma ORM)    (ioredis)    (YouTube, OpenAI)
```

### Module Pattern

Mỗi feature module gồm 3 files:

```
modules/<name>/
├── <name>.module.ts       # NestJS module (imports, providers, exports)
├── <name>.controller.ts   # Route handlers + Swagger decorators
└── <name>.service.ts      # Business logic + Prisma/Redis calls
```

### Global Services

| Service | Scope | Chức năng |
|---------|-------|-----------|
| `PrismaService` | Global | Database ORM wrapper |
| `RedisService` | Global | `get/set/getJson/setJson/del/flushPattern` |
| `AiProviderService` | Global | OpenAI SDK wrapper (custom base URL cho OpenRouter) |

### Auth Flow

```
Register/Login → JWT Access Token (15m) + Refresh Token (7d)
               → @UseGuards(JwtAuthGuard) + @CurrentUser('id')
               → Refresh token rotation (mỗi lần dùng tạo token mới)
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | NestJS (TypeScript) | 11.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 6.x |
| Cache | Redis (ioredis) | 7 |
| Queue | BullMQ | 5.x |
| Auth | Passport.js + JWT | — |
| WebSocket | Socket.io (@nestjs/websockets) | 4.x |
| AI | OpenAI SDK via OpenRouter | GPT-4o-mini |
| YouTube | ytdl-core + youtubei | — |
| API Docs | Swagger (@nestjs/swagger) | 11.x |
| Rate Limit | @nestjs/throttler | 6.x |

---

## Project Structure

```
vibemusic-api/
├── src/
│   ├── main.ts                         # Bootstrap, Swagger, CORS, ValidationPipe
│   ├── app.module.ts                   # Root module (imports all features)
│   ├── prisma/                         # PrismaService (global)
│   ├── redis/                          # RedisService (global)
│   ├── common/decorators/              # @CurrentUser decorator
│   └── modules/
│       ├── health/                     # GET /health, /config
│       ├── auth/                       # 8 endpoints (JWT + OAuth + refresh rotation)
│       ├── users/                      # 6 endpoints (profile, devices, subscription)
│       ├── playback/                   # 4+5 endpoints (stream, info, smart playback)
│       ├── search/                     # 2 endpoints (search + suggest)
│       ├── discovery/                  # 10 endpoints + 8 cronjobs + sync controller
│       │   ├── discovery.controller.ts      # 10 discovery endpoints
│       │   ├── discovery.service.ts         # Prisma queries + Redis cache
│       │   ├── discovery-cron.service.ts    # 8 scheduled cronjobs (@nestjs/schedule)
│       │   ├── discovery-sync.controller.ts # Manual trigger + status endpoints
│       │   └── youtube-charts.helper.ts     # YouTube Charts InnerTube scraper
│       ├── playlists/                  # 11 endpoints (CRUD, share, import)
│       ├── library/                    # 9 endpoints (favorites, history, queue, backup)
│       ├── lyrics/                     # 3 endpoints (search, get, translate)
│       ├── ai/                         # 28 endpoints
│       │   ├── ai.module.ts            # Root AI module
│       │   ├── ai-provider.service.ts  # OpenAI SDK wrapper
│       │   ├── recommendation/         # 6 endpoints (for-you, radio, discover-weekly)
│       │   ├── mood/                   # 5 endpoints (detect, playlist, progression)
│       │   ├── context/                # 2 endpoints (report, suggest)
│       │   ├── dj/                     # 6 endpoints (AI DJ session)
│       │   ├── voice/                  # 3 endpoints (STT/TTS Vietnamese)
│       │   ├── karaoke/                # 4 endpoints (vocal separation)
│       │   ├── hum/                    # 2 endpoints (hum-to-search)
│       │   ├── memory/                 # 4 endpoints (nostalgia, patterns)
│       │   └── auto/                   # 3 endpoints (zero-interaction)
│       ├── social/
│       │   ├── rooms/                  # 6 REST + WebSocket gateway (8 events)
│       │   ├── profiles/               # 3 endpoints
│       │   └── follows/                # 6 endpoints
│       ├── notifications/              # 4 endpoints
│       └── subscriptions/              # 6 endpoints
├── prisma/
│   ├── schema.prisma                   # 32 models
│   └── migrations/                     # 4 migrations
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Build & Run

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL 16** + **Redis 7** (via `vibemusic-infra` Docker)
- **npm** (hoặc pnpm)

### Development (Local)

```bash
# 1. Start infrastructure
cd ../vibemusic-infra && docker-compose up -d

# 2. Install dependencies
cd ../vibemusic-api && npm install

# 3. Setup environment
cp .env.example .env
# → Sửa AI_API_KEY nếu cần AI features

# 4. Generate Prisma client + migrate
npx prisma generate
npx prisma migrate dev

# 5. Start dev server (hot reload)
npm run start:dev

# Server:  http://localhost:3000
# Swagger: http://localhost:3000/api-docs
# Health:  http://localhost:3000/health
```

### Production (Docker)

```bash
# Build production
npm run build

# Run production
NODE_ENV=production npm run start:prod
# → Runs dist/main.js

# Hoặc dùng Docker:
# 1. Build image
docker build -t vibemusic-api .

# 2. Run với production env
docker run -d \
  --name vibemusic-api \
  -p 3000:3000 \
  --env-file .env.production \
  --network vibemusic-network \
  vibemusic-api

# 3. Apply migrations
docker exec vibemusic-api npx prisma migrate deploy
```

### NPM Scripts

| Command | Mô tả |
|---------|-------|
| `npm run start:dev` | Dev server (hot reload) |
| `npm run start:debug` | Dev + debugger |
| `npm run build` | Production build → `dist/` |
| `npm run start:prod` | Run production build |
| `npm run lint` | ESLint fix |
| `npm run format` | Prettier format |
| `npm run test` | Unit tests |
| `npm run test:watch` | Unit tests (watch) |
| `npm run test:cov` | Test coverage |
| `npm run test:e2e` | E2E tests |

### Prisma Commands

| Command | Mô tả |
|---------|-------|
| `npx prisma generate` | Generate client |
| `npx prisma migrate dev` | Create & apply migration |
| `npx prisma migrate deploy` | Apply migrations (production) |
| `npx prisma studio` | Visual DB browser (:5555) |
| `npx prisma db push` | Push schema (no migration) |

---

## Environment Variables

```env
# === Core ===
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://vibemusic:vibemusic_dev_2026@localhost:5432/vibemusic
REDIS_HOST=localhost
REDIS_PORT=6379

# === Auth ===
JWT_SECRET=vibemusic_jwt_secret_dev_2026_change_in_production
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=vibemusic_refresh_secret_dev_2026_change_in_production
JWT_REFRESH_EXPIRATION=7d

# === AI (OpenRouter / OpenAI compatible) ===
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=your_openrouter_api_key_here
AI_MODEL=openai/gpt-4o-mini

# === OAuth (optional) ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# === Encryption ===
ENCRYPT_SECRET=vibemusic_encrypt_secret_dev
```

---

## Database Schema (32 models)

```
AUTH & USERS              MUSIC DATA (Cronjobs)      USER LIBRARY
├── User                  ├── Track                  ├── Playlist
├── UserDevice            ├── Artist                 ├── PlaylistTrack
├── RefreshToken          ├── Genre                  ├── Favorite
├── Subscription          ├── Trending               ├── ListeningHistory
                          ├── Popular                ├── Queue
AI & PERSONALIZATION      ├── Chart                  ├── Backup
├── UserTasteProfile      ├── TopArtist
├── AiPlaylist            ├── TopPlaylist            SOCIAL
├── MoodHistory           ├── GenreVideo             ├── Follow
├── ContextEvent          ├── MoodCategory           ├── ListeningRoom
├── PlaybackSession       ├── MoodPlaylist           ├── RoomParticipant
                                                     ├── RoomMessage
SYSTEM                    PHASE 5                    ├── Notification
├── CronjobRun            ├── Referral
```

### Caching Strategy

| Data | TTL | Key Pattern |
|------|-----|-------------|
| Stream URLs | 3h | `stream:<youtubeId>:<quality>` |
| Track info | 24h | `track-info:<youtubeId>` |
| Search | 30min | `search:<query>:<type>:<limit>` |
| Suggestions | 1h | `suggest:<query>` |
| Discovery | 6h/24h | `discovery:<type>:<country>` |
| AI responses | 1h | `ai:<type>:<userId>` |

### Rate Limiting

| Tier | Limit | Scope |
|------|-------|-------|
| General | 120 req/min | Per IP |
| YouTube | 30 req/min | `/playback`, `/search` |
| AI | 20 req/min | `/ai/*` |
| WebSocket | 60 msg/min | Per user |

---

## API Checklist đầy đủ

> Legend: ❌ Public · 🔑 Refresh token · 🔒 JWT Bearer

### Phase 1 — Foundation (52 endpoints)

#### System — 2 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 1 | GET | `/health` | ❌ | Health check (DB + Redis + uptime) |
| 2 | GET | `/config` | ❌ | Feature flags JSON |

#### Auth — 8 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 3 | POST | `/auth/register` | ❌ | Đăng ký email+password |
| 4 | POST | `/auth/login` | ❌ | Đăng nhập → tokens |
| 5 | POST | `/auth/google` | ❌ | Google OAuth |
| 6 | POST | `/auth/apple` | ❌ | Apple Sign-In (stub) |
| 7 | POST | `/auth/refresh` | 🔑 | Refresh token rotation |
| 8 | POST | `/auth/logout` | 🔒 | Revoke tokens |
| 9 | POST | `/auth/forgot-password` | ❌ | Gửi email reset |
| 10 | POST | `/auth/reset-password` | ❌ | Reset với token |

#### Users — 6 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 11 | GET | `/users/me` | 🔒 | Lấy profile |
| 12 | PUT | `/users/me` | 🔒 | Cập nhật profile |
| 13 | GET | `/users/me/devices` | 🔒 | Danh sách devices |
| 14 | DELETE | `/users/me/devices/:id` | 🔒 | Xóa device |
| 15 | GET | `/users/me/subscription` | 🔒 | Thông tin subscription |
| 16 | DELETE | `/users/me` | 🔒 | Xóa tài khoản |

#### Playback — 4 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 17 | GET | `/playback/stream/:youtubeId` | 🔒 | Stream URL (ytdl→youtubei fallback) |
| 18 | GET | `/playback/info/:youtubeId` | 🔒 | Track metadata |
| 19 | GET | `/playback/formats/:youtubeId` | 🔒 | Available qualities |
| 20 | POST | `/playback/batch-info` | 🔒 | Batch info (max 50) |

#### Search — 2 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 21 | GET | `/search?q=&type=&limit=` | 🔒 | YouTube search |
| 22 | GET | `/search/suggest?q=` | 🔒 | Autocomplete |

#### Discovery — 10 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 23 | GET | `/discovery/trending?country=` | 🔒 | Trending |
| 24 | GET | `/discovery/popular?country=` | 🔒 | Popular |
| 25 | GET | `/discovery/new-tracks?country=` | 🔒 | New releases |
| 26 | GET | `/discovery/charts?country=` | 🔒 | Top charts |
| 27 | GET | `/discovery/artists?country=` | 🔒 | Top artists |
| 28 | GET | `/discovery/playlists?country=` | 🔒 | Top playlists |
| 29 | GET | `/discovery/genres` | 🔒 | Genre list |
| 30 | GET | `/discovery/genres/:code/videos` | 🔒 | Videos by genre |
| 31 | GET | `/discovery/mood/categories` | 🔒 | Mood categories |
| 32 | GET | `/discovery/mood/:id/playlists` | 🔒 | Mood playlists |

#### Playlists — 11 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 33 | POST | `/playlists` | 🔒 | Tạo playlist |
| 34 | GET | `/playlists` | 🔒 | List playlists |
| 35 | GET | `/playlists/:id` | 🔒 | Chi tiết + tracks |
| 36 | PUT | `/playlists/:id` | 🔒 | Update |
| 37 | DELETE | `/playlists/:id` | 🔒 | Delete |
| 38 | POST | `/playlists/:id/tracks` | 🔒 | Add tracks |
| 39 | DELETE | `/playlists/:id/tracks/:trackId` | 🔒 | Remove track |
| 40 | PUT | `/playlists/:id/tracks/reorder` | 🔒 | Reorder |
| 41 | POST | `/playlists/:id/share` | 🔒 | Generate share code |
| 42 | GET | `/playlists/shared/:code` | ❌ | Get by share code |
| 43 | POST | `/playlists/import` | 🔒 | Import YouTube playlist |

#### Library — 9 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 44 | GET | `/library/favorites` | 🔒 | List favorites |
| 45 | POST | `/library/favorites/:youtubeId` | 🔒 | Add favorite |
| 46 | DELETE | `/library/favorites/:youtubeId` | 🔒 | Remove favorite |
| 47 | GET | `/library/history?limit=&offset=` | 🔒 | Listening history |
| 48 | POST | `/library/history` | 🔒 | Record listen |
| 49 | DELETE | `/library/history` | 🔒 | Clear history |
| 50 | GET | `/library/queue` | 🔒 | Current queue |
| 51 | PUT | `/library/queue` | 🔒 | Update queue |
| 52 | POST | `/library/backup` | 🔒 | Create backup |
| 53 | POST | `/library/restore` | 🔒 | Restore backup |

---

### Phase 2 — Intelligence (21 endpoints)

#### AI Recommendation — 6 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 54 | GET | `/ai/recommend/for-you?limit=` | 🔒 | Free | Gợi ý cá nhân hóa |
| 55 | GET | `/ai/recommend/radio?seed=&type=` | 🔒 | Free | Radio mode |
| 56 | GET | `/ai/recommend/discover-weekly` | 🔒 | Free | Discover Weekly |
| 57 | GET | `/ai/recommend/similar/:youtubeId` | 🔒 | Free | Tracks tương tự |
| 58 | GET | `/ai/recommend/because-you-listened` | 🔒 | Premium | "Vì bạn đã nghe..." |
| 59 | POST | `/ai/recommend/feedback` | 🔒 | Free | Like/dislike feedback |

#### AI Mood — 5 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 60 | POST | `/ai/mood/detect` | 🔒 | Premium | Detect mood từ text |
| 61 | POST | `/ai/mood/playlist` | 🔒 | Premium | Playlist theo mood |
| 62 | GET | `/ai/mood/history` | 🔒 | Premium | Lịch sử mood |
| 63 | GET | `/ai/mood/suggestion` | 🔒 | Premium | Mood of the day |
| 64 | POST | `/ai/mood/progression` | 🔒 | Premium | Mood transition |

#### AI Context — 2 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 65 | POST | `/ai/context/report` | 🔒 | Free | Report context |
| 66 | GET | `/ai/context/suggest` | 🔒 | Premium | Context suggestion |

#### Smart Playback — 5 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 67 | GET | `/playback/smart-shuffle?playlist=` | 🔒 | Free | Smart shuffle |
| 68 | GET | `/playback/next-track?current=&mode=` | 🔒 | Premium | AI next track |
| 69 | POST | `/playback/session/start` | 🔒 | Free | Start session |
| 70 | POST | `/playback/session/event` | 🔒 | Free | Track event |
| 71 | POST | `/playback/session/end` | 🔒 | Free | End session |

#### Lyrics — 3 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 72 | GET | `/lyrics/:youtubeId` | 🔒 | Free | Time-synced lyrics |
| 73 | GET | `/lyrics/search?q=` | 🔒 | Free | Search lyrics |
| 74 | POST | `/lyrics/:youtubeId/translate?lang=` | 🔒 | Premium | AI translate |

---

### Phase 3 — AI WOW (19 endpoints)

#### AI DJ — 6 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 75 | POST | `/ai/dj/start` | 🔒 | Premium | Start DJ session |
| 76 | GET | `/ai/dj/next` | 🔒 | Premium | Next track |
| 77 | POST | `/ai/dj/command` | 🔒 | Premium | NL command |
| 78 | POST | `/ai/dj/feedback` | 🔒 | Premium | Thumbs up/down |
| 79 | GET | `/ai/dj/commentary/:trackId` | 🔒 | Premium | TTS commentary |
| 80 | POST | `/ai/dj/stop` | 🔒 | Premium | Stop session |

#### Voice Assistant — 3 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 81 | POST | `/ai/voice/command` | 🔒 | Pro | Audio → STT → action |
| 82 | POST | `/ai/voice/text-command` | 🔒 | Pro | Text command |
| 83 | GET | `/ai/voice/response/:id` | 🔒 | Pro | TTS response |

#### AI Karaoke — 4 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 84 | POST | `/ai/karaoke/prepare/:youtubeId` | 🔒 | Pro | Vocal separation |
| 85 | GET | `/ai/karaoke/status/:jobId` | 🔒 | Pro | Job status |
| 86 | GET | `/ai/karaoke/stream/:jobId` | 🔒 | Pro | Stream result |
| 87 | POST | `/ai/karaoke/transpose` | 🔒 | Pro | Transpose pitch |

#### Hum to Search — 2 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 88 | POST | `/ai/hum/recognize` | 🔒 | Free | Upload humming |
| 89 | GET | `/ai/hum/result/:id` | 🔒 | Free | Recognition result |

#### Memory Music — 4 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 90 | GET | `/ai/memory/on-this-day` | 🔒 | Premium | On this day |
| 91 | GET | `/ai/memory/nostalgia?period=` | 🔒 | Premium | Nostalgia mix |
| 92 | GET | `/ai/memory/patterns` | 🔒 | Premium | Listening patterns |
| 93 | GET | `/ai/memory/seasonal` | 🔒 | Free | Seasonal suggestion |

---

### Phase 4 — Social (19 REST + 8 WebSocket)

#### Rooms — 6 REST endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 94 | POST | `/rooms` | 🔒 | Pro | Tạo phòng |
| 95 | GET | `/rooms` | 🔒 | Free | List public rooms |
| 96 | GET | `/rooms/:id` | 🔒 | Free | Room detail |
| 97 | POST | `/rooms/:id/join` | 🔒 | Pro | Join room |
| 98 | POST | `/rooms/:id/leave` | 🔒 | Pro | Leave room |
| 99 | DELETE | `/rooms/:id` | 🔒 | Pro | Delete room |

#### WebSocket Events — 8 events

| # | Event | Direction | Mô tả |
|---|-------|-----------|-------|
| W1 | `room:sync` | S→C | Sync playback state |
| W2 | `room:track-changed` | S→C | Track changed |
| W3 | `room:chat` | Both | Chat message |
| W4 | `room:vote` | C→S | Vote next track |
| W5 | `room:vote-result` | S→C | Vote result |
| W6 | `room:user-joined` | S→C | User joined |
| W7 | `room:user-left` | S→C | User left |
| W8 | `room:kick` | C→S | Host kick user |

#### Profiles — 3 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 100 | GET | `/profiles/:id` | 🔒 | Public profile |
| 101 | GET | `/profiles/:id/taste-card` | 🔒 | Music taste card |
| 102 | GET | `/profiles/:id/playlists` | 🔒 | Public playlists |

#### Follows — 6 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 103 | POST | `/follows/:userId` | 🔒 | Follow |
| 104 | DELETE | `/follows/:userId` | 🔒 | Unfollow |
| 105 | GET | `/follows/following` | 🔒 | Following list |
| 106 | GET | `/follows/followers` | 🔒 | Followers list |
| 107 | GET | `/follows/feed` | 🔒 | Activity feed |
| 108 | POST | `/follows/blend/:userId` | 🔒 | Blend playlist |

#### Notifications — 4 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 109 | GET | `/notifications` | 🔒 | List notifications |
| 110 | PUT | `/notifications/:id/read` | 🔒 | Mark read |
| 111 | PUT | `/notifications/read-all` | 🔒 | Mark all read |
| 112 | PUT | `/notifications/settings` | 🔒 | Notification settings |

---

### Phase 5 — Advanced (9 endpoints)

#### Subscriptions — 6 endpoints

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|-------|
| 113 | GET | `/subscriptions/plans` | ❌ | List plans (3 tiers) |
| 114 | POST | `/subscriptions/purchase` | 🔒 | Purchase subscription |
| 115 | POST | `/subscriptions/cancel` | 🔒 | Cancel |
| 116 | POST | `/subscriptions/restore` | 🔒 | Restore purchase |
| 117 | GET | `/subscriptions/referral` | 🔒 | Get referral code |
| 118 | POST | `/subscriptions/referral/apply` | 🔒 | Apply referral |

#### Auto Play — 3 endpoints

| # | Method | Endpoint | Auth | Tier | Mô tả |
|---|--------|----------|------|------|-------|
| 119 | GET | `/ai/auto/play` | 🔒 | Premium | AI auto-select |
| 120 | GET | `/ai/auto/settings` | 🔒 | Premium | Get auto settings |
| 121 | POST | `/ai/auto/settings` | 🔒 | Premium | Save auto settings |

---

## Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| `Cannot find module '@prisma/client'` | `npx prisma generate` |
| DB connection refused | `cd ../vibemusic-infra && docker-compose up -d` |
| Redis connection refused | Check Docker + `REDIS_HOST` in `.env` |
| YouTube stream 403 | IP rate limited, đợi hoặc đổi IP |
| Port 3000 in use | `lsof -i :3000` → kill hoặc đổi `PORT` |
| AI endpoints 500 | Kiểm tra `AI_API_KEY` trong `.env` |
| Prisma migration drift | `npx prisma migrate reset` (⚠️ xóa data) |
| Discovery trả empty `[]` | Chạy `POST /discovery/sync/all` hoặc chờ cronjob tự chạy |

---

## Discovery Cronjobs

### 8 Scheduled Jobs

| Schedule | Job | Source | Mô tả |
|----------|-----|--------|-------|
| Mỗi 6h | `trending` | YouTube Charts TRENDING_CHART | Trending videos 30 countries |
| Mỗi 6h | `popular` | YouTube Charts TopSongs | Most popular songs 30 countries |
| Mỗi 12h | `charts` | YouTube Charts BiggestMovers | Top charts 30 countries + Global |
| Mỗi 12h | `new-tracks` | YouTube Charts TopDebuts | New releases 30 countries |
| Daily 1:00 | `artists` | YouTube Charts TopArtists | Top artists 30 countries |
| Daily 2:00 | `playlists` | youtubei search | Top playlists 30 countries |
| Daily 3:00 | `genres` | Seed 16 genres + youtubei | Genre videos 5 regions |
| Daily 4:00 | `moods` | Seed 11 categories + youtubei | Mood playlists |

### Countries (30)

`VN, US, GB, KR, JP, IN, BR, DE, FR, MX, ID, TH, PH, ES, IT, CA, AU, TW, TR, RU, AR, CO, CL, PE, SA, EG, NG, ZA, SE, NL`

### Seed on Startup

Khi app khởi động lần đầu (DB empty), tự động chạy tất cả cronjobs để seed dữ liệu.

### Manual Trigger

```bash
# Trigger 1 job
curl -X POST http://localhost:3000/discovery/sync/trending
curl -X POST http://localhost:3000/discovery/sync/popular
curl -X POST http://localhost:3000/discovery/sync/genres

# Trigger tất cả
curl -X POST http://localhost:3000/discovery/sync/all

# Xem trạng thái
curl http://localhost:3000/discovery/sync/status

# Xem danh sách jobs
curl http://localhost:3000/discovery/sync/jobs
```
