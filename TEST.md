# 🧪 VibeMusic API — Test Plan

> Test toàn bộ API theo Phase. Mỗi Phase test xong 100% mới chuyển Phase tiếp.
>
> **Quy trình**: Infrastructure → Phase 1 → Fix → Phase 2 → Fix → ... → Phase 5

---

## Chuẩn bị chung

```bash
# 1. Start infrastructure
cd ../vibemusic-infra && docker-compose up -d

# 2. Verify
docker exec vibemusic-postgres pg_isready -U vibemusic
docker exec vibemusic-redis redis-cli ping

# 3. Setup API (APP_ROLE=all cho dev)
cd ../vibemusic-api
npm install
cp .env.example .env  # → sửa AI_API_KEY
npx prisma generate
npx prisma migrate dev
npm run start:dev

# 4. Verify
curl http://localhost:3000/health
```

### Biến test

```bash
BASE=http://localhost:3000
EMAIL="test_$(date +%s)@test.com"
PASS="Test123456"
```

### Lấy token

```bash
RESULT=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Tester\"}")
TOKEN=$(echo $RESULT | jq -r '.accessToken')
REFRESH=$(echo $RESULT | jq -r '.refreshToken')
AUTH="Authorization: Bearer $TOKEN"
```

---

## PHASE 0: INFRASTRUCTURE & ARCHITECTURE

> Verify new production architecture: APP_ROLE, env validation, security middleware

### 0.1 Infrastructure (5 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 0.1.1 | Docker running | `docker-compose ps` | postgres + redis Up |
| 0.1.2 | PostgreSQL ready | `docker exec vibemusic-postgres pg_isready -U vibemusic` | accepting connections |
| 0.1.3 | Redis ready | `docker exec vibemusic-redis redis-cli ping` | PONG |
| 0.1.4 | Prisma migrate | `npx prisma migrate dev` | All migrations applied |
| 0.1.5 | Build passes | `npm run build` | No errors |

### 0.2 App Startup & Health (6 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 0.2.1 | App starts (all) | `npm run start:dev` | `🎵 VibeMusic [ALL] running` |
| 0.2.2 | Health check | `curl $BASE/health` | `{status:"ok", database:"connected", redis:"connected", appRole:"all", version:"0.0.1"}` |
| 0.2.3 | Config flags | `curl $BASE/config` | `{version, features:{...}}` |
| 0.2.4 | Swagger UI | Open `$BASE/api-docs` | Page loads (dev only) |
| 0.2.5 | Env validation | Remove JWT_SECRET from .env → restart | App fails fast with clear error |
| 0.2.6 | Security headers | `curl -I $BASE/health` | `x-content-type-options`, `x-frame-options` (helmet) |

### 0.3 APP_ROLE Modes (3 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 0.3.1 | API mode | `APP_ROLE=api npm run start:dev` | HTTP works, NO cron logs |
| 0.3.2 | Worker mode | `APP_ROLE=worker npm run start:dev` | `🔧 VibeMusic [WORKER]`, NO HTTP |
| 0.3.3 | All mode (default) | `npm run start:dev` | HTTP + cron both active |

**Tổng Phase 0: 14 tests**

---

## PHASE 1: FOUNDATION (52 endpoints)

> Core API: auth, users, playback, search, discovery, playlists, library

### 1.1 Auth (13 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.1.1 | Register | `POST /auth/register` `{email,password,name}` | 201, `{accessToken, refreshToken, user}` |
| 1.1.2 | Register duplicate | Same email | 409 Conflict |
| 1.1.3 | Register weak pwd | `{password:"123"}` | 400 Validation |
| 1.1.4 | Login | `POST /auth/login` `{email,password}` | 200, `{accessToken, refreshToken}` |
| 1.1.5 | Login wrong pwd | `{password:"wrong"}` | 401 |
| 1.1.6 | Login unknown | `{email:"no@exist.com"}` | 401 |
| 1.1.7 | Refresh token | `POST /auth/refresh` `{refreshToken}` | 200, new tokens |
| 1.1.8 | Refresh invalid | `{refreshToken:"invalid"}` | 401 |
| 1.1.9 | Forgot password | `POST /auth/forgot-password` `{email}` | 200 |
| 1.1.10 | No token | `GET /users/me` (no auth) | 401 |
| 1.1.11 | Google OAuth | `POST /auth/google` | Stub response |
| 1.1.12 | Logout | `POST /auth/logout` | 200 |
| 1.1.13 | Refresh after logout | Old refresh → fail | 401 |

### 1.2 Users (6 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.2.1 | Get profile | `GET /users/me` | 200, `{id, email, name, tier}` |
| 1.2.2 | Update name | `PUT /users/me` `{name:"New"}` | 200 |
| 1.2.3 | Update avatar | `PUT /users/me` `{avatarUrl:"https://..."}` | 200 |
| 1.2.4 | Get devices | `GET /users/me/devices` | 200, array |
| 1.2.5 | Get subscription | `GET /users/me/subscription` | 200, `{tier:"FREE"}` |
| 1.2.6 | Delete account | `DELETE /users/me` | 200 |

### 1.3 Playback (7 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.3.1 | Stream URL | `GET /playback/stream/dQw4w9WgXcQ` | 200, `{url, quality}` |
| 1.3.2 | Cached stream | Same request again | Faster (Redis) |
| 1.3.3 | Track info | `GET /playback/info/dQw4w9WgXcQ` | 200, `{title, artist}` |
| 1.3.4 | Formats | `GET /playback/formats/dQw4w9WgXcQ` | 200, array |
| 1.3.5 | Batch info | `POST /playback/batch-info` `{youtubeIds:[...]}` | 200, array |
| 1.3.6 | Invalid ID | `GET /playback/stream/INVALID` | Error |
| 1.3.7 | Quality param | `GET /playback/stream/dQw4w9WgXcQ?quality=128k` | 200 |

### 1.4 Search (6 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.4.1 | Search videos | `GET /search?q=nhạc trẻ` | 200, results |
| 1.4.2 | Search playlists | `GET /search?q=lofi&type=playlist` | 200 |
| 1.4.3 | With limit | `GET /search?q=pop&limit=5` | 200, max 5 |
| 1.4.4 | Empty query | `GET /search?q=` | 200, empty |
| 1.4.5 | Autocomplete | `GET /search/suggest?q=son tung` | 200, suggestions |
| 1.4.6 | Cached | Same query again | Faster |

### 1.5 Discovery (16 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.5.1 | Trending VN | `GET /discovery/trending?country=VN` | 200, array |
| 1.5.2 | Trending US | `GET /discovery/trending?country=US` | 200 |
| 1.5.3 | Popular | `GET /discovery/popular?country=VN` | 200 |
| 1.5.4 | New tracks | `GET /discovery/new-tracks?country=VN` | 200 |
| 1.5.5 | Charts global | `GET /discovery/charts?country=ZZ` | 200 |
| 1.5.6 | Artists | `GET /discovery/artists?country=VN` | 200 |
| 1.5.7 | Playlists | `GET /discovery/playlists?country=VN` | 200 |
| 1.5.8 | Genres | `GET /discovery/genres` | 200, 16 genres |
| 1.5.9 | Genre videos | `GET /discovery/genres/pop/videos?region=VN` | 200 |
| 1.5.10 | Mood categories | `GET /discovery/mood/categories` | 200, 11 cats |
| 1.5.11 | Mood playlists | `GET /discovery/mood/:id/playlists` | 200 |
| 1.5.12 | Cache verify | Same endpoint 2× | 2nd faster |
| 1.5.13 | Sync jobs (🔒 JWT) | `GET /discovery/sync/jobs` (with $AUTH) | 200, 9 jobs |
| 1.5.14 | Sync trigger (🔒) | `POST /discovery/sync/genres` (with $AUTH) | 200, `{status}` |
| 1.5.15 | Sync status (🔒) | `GET /discovery/sync/status` (with $AUTH) | 200, `{runs}` |
| 1.5.16 | Sync no auth | `POST /discovery/sync/genres` (no auth) | 401 Unauthorized |

> **Note**: Discovery auto-seeds on first startup (DB empty). Sync endpoints now require JWT auth.

### 1.6 Playlists (15 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.6.1 | Create | `POST /playlists` `{title:"My Playlist"}` | 201 |
| 1.6.2 | List | `GET /playlists` | 200, array |
| 1.6.3 | Get detail | `GET /playlists/:id` | 200, +tracks |
| 1.6.4 | Update title | `PUT /playlists/:id` `{title:"Renamed"}` | 200 |
| 1.6.5 | Make public | `PUT /playlists/:id` `{isPublic:true}` | 200 |
| 1.6.6 | Add tracks | `POST /playlists/:id/tracks` `{youtubeIds:[...]}` | 200 |
| 1.6.7 | No duplicate | Same track again | No dup |
| 1.6.8 | Remove track | `DELETE /playlists/:id/tracks/:trackId` | 200 |
| 1.6.9 | Reorder | `PUT /playlists/:id/tracks/reorder` | 200 |
| 1.6.10 | Share code | `POST /playlists/:id/share` | 200, `{shareCode}` |
| 1.6.11 | Get shared (❌) | `GET /playlists/shared/:code` | 200, no auth |
| 1.6.12 | Invalid share | `GET /playlists/shared/invalid` | 404 |
| 1.6.13 | Import YT | `POST /playlists/import` `{youtubeUrl}` | 200 |
| 1.6.14 | Delete | `DELETE /playlists/:id` | 200 |
| 1.6.15 | Other user | `GET /playlists/:otherId` | 403 |

### 1.7 Library (12 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.7.1 | Add favorite | `POST /library/favorites/dQw4w9WgXcQ` | 200 |
| 1.7.2 | List favorites | `GET /library/favorites` | 200, array |
| 1.7.3 | Dup favorite | Same ID | 200, no error |
| 1.7.4 | Remove fav | `DELETE /library/favorites/dQw4w9WgXcQ` | 200 |
| 1.7.5 | Record history | `POST /library/history` `{youtubeId, durationPlayed}` | 200 |
| 1.7.6 | Get history | `GET /library/history?limit=10` | 200 |
| 1.7.7 | Clear history | `DELETE /library/history` | 200 |
| 1.7.8 | Update queue | `PUT /library/queue` `{tracks, currentIndex}` | 200 |
| 1.7.9 | Get queue | `GET /library/queue` | 200 |
| 1.7.10 | Backup | `POST /library/backup` | 200, `{code}` |
| 1.7.11 | Restore | `POST /library/restore` `{code}` | 200 |
| 1.7.12 | Invalid backup | `POST /library/restore` `{code:"invalid"}` | 404 |

### 1.8 E2E Flow

```
1. POST /auth/register → tokens
2. GET /users/me → profile
3. GET /search?q=nhạc trẻ → YouTube IDs
4. GET /playback/stream/:id → streaming
5. POST /playlists → create
6. POST /playlists/:id/tracks → add
7. POST /library/favorites/:id → fav
8. POST /library/history → record
9. POST /library/backup → backup
10. POST /playlists/:id/share → share
11. GET /playlists/shared/:code → public
12. POST /auth/logout
13. GET /users/me → 401
```

**Tổng Phase 1: ~89 tests**

---

## PHASE 2: INTELLIGENCE (21 endpoints)

> Prerequisite: Phase 1 pass 100%

### 2.1 AI Recommendation (9 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 2.1.1 | For you (no history) | `GET /ai/recommend/for-you` | 200, fallback |
| 2.1.2 | Seed history | `POST /library/history` × 10 | Data seeded |
| 2.1.3 | For you (history) | `GET /ai/recommend/for-you` | 200, AI source |
| 2.1.4 | Radio | `GET /ai/recommend/radio?seed=dQw4w9WgXcQ&type=track` | 200 |
| 2.1.5 | Discover weekly | `GET /ai/recommend/discover-weekly` | 200 |
| 2.1.6 | Similar | `GET /ai/recommend/similar/:id` | 200 |
| 2.1.7 | Feedback | `POST /ai/recommend/feedback` `{trackId,type:"like"}` | 200 |
| 2.1.8 | Because (Free→403) | `GET /ai/recommend/because-you-listened` | 403 |
| 2.1.9 | Because (Premium) | Same, Premium user | 200 |

### 2.2 AI Mood (6 tests) — Premium

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 2.2.0 | Detect (Free→403) | `POST /ai/mood/detect` | 403 |
| 2.2.1 | Detect mood | `POST /ai/mood/detect` `{text:"buồn quá"}` | 200, `{mood}` |
| 2.2.2 | Mood playlist | `POST /ai/mood/playlist` `{description}` | 200, tracks |
| 2.2.3 | History | `GET /ai/mood/history` | 200 |
| 2.2.4 | Suggestion | `GET /ai/mood/suggestion` | 200 |
| 2.2.5 | Progression | `POST /ai/mood/progression` `{from,to}` | 200 |

### 2.3 AI Context (2 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 2.3.1 | Report | `POST /ai/context/report` `{timeOfDay,activity}` | 200 |
| 2.3.2 | Suggest (Premium) | `GET /ai/context/suggest` | 200 |

### 2.4 Smart Playback (5 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 2.4.1 | Start session | `POST /playback/session/start` | 200, sessionId |
| 2.4.2 | Track event | `POST /playback/session/event` | 200 |
| 2.4.3 | Smart shuffle | `GET /playback/smart-shuffle?playlist=:id` | 200 |
| 2.4.4 | Next track (Premium) | `GET /playback/next-track?current=:id` | 200 |
| 2.4.5 | End session | `POST /playback/session/end` | 200 |

### 2.5 Lyrics (4 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 2.5.1 | Get lyrics | `GET /lyrics/:youtubeId` | 200 |
| 2.5.2 | Invalid ID | `GET /lyrics/INVALID` | 404 |
| 2.5.3 | Search | `GET /lyrics/search?q=never gonna` | 200 |
| 2.5.4 | Translate (Premium) | `POST /lyrics/:id/translate?lang=vi` | 200 |

**Tổng Phase 2: 26 tests**

---

## PHASE 3: AI WOW (19 endpoints)

> Prerequisite: Phase 2 pass 100%

### 3.1 AI DJ (6 tests) — Premium

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 3.1.1 | Start | `POST /ai/dj/start` | 200, sessionId |
| 3.1.2 | Next | `GET /ai/dj/next` | 200 |
| 3.1.3 | Command | `POST /ai/dj/command` `{text:"chill hơn"}` | 200 |
| 3.1.4 | Commentary | `GET /ai/dj/commentary/:trackId` | 200 |
| 3.1.5 | Feedback | `POST /ai/dj/feedback` `{trackId,type:"up"}` | 200 |
| 3.1.6 | Stop | `POST /ai/dj/stop` | 200 |

### 3.2 Voice (4 tests) — Pro

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 3.2.1 | Text cmd | `POST /ai/voice/text-command` `{text:"phát nhạc chill"}` | 200 |
| 3.2.2 | Audio cmd | `POST /ai/voice/command` (upload) | 200 |
| 3.2.3 | Response | `GET /ai/voice/response/:id` | 200 |
| 3.2.4 | VN slang | `POST /ai/voice/text-command` `{text:"nhạc bolero"}` | 200 |

### 3.3 Karaoke (4 tests) — Pro

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 3.3.1 | Prepare | `POST /ai/karaoke/prepare/:id` | 200, jobId |
| 3.3.2 | Status | `GET /ai/karaoke/status/:jobId` | 200 |
| 3.3.3 | Stream | `GET /ai/karaoke/stream/:jobId` | 200 |
| 3.3.4 | Transpose | `POST /ai/karaoke/transpose` `{semitones:2}` | 200 |

### 3.4 Hum (2 tests) — Free

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 3.4.1 | Recognize | `POST /ai/hum/recognize` `{description}` | 200 |
| 3.4.2 | Result | `GET /ai/hum/result/:id` | 200 |

### 3.5 Memory (4 tests) — Premium

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 3.5.1 | On this day | `GET /ai/memory/on-this-day` | 200 |
| 3.5.2 | Nostalgia | `GET /ai/memory/nostalgia?period=2024` | 200 |
| 3.5.3 | Patterns | `GET /ai/memory/patterns` | 200 |
| 3.5.4 | Seasonal | `GET /ai/memory/seasonal` | 200 |

### 3.6 TierGuard (Free→403)

| Endpoint | Free | Expected |
|----------|------|----------|
| `POST /ai/dj/start` | 403 | ✅ |
| `POST /ai/voice/text-command` | 403 | ✅ |
| `POST /ai/karaoke/prepare/test` | 403 | ✅ |
| `GET /ai/memory/on-this-day` | 403 | ✅ |
| `GET /ai/auto/play` | 403 | ✅ |

**Tổng Phase 3: 25 tests**

---

## PHASE 4: SOCIAL (19 REST + 8 WS)

> Prerequisite: Phase 3 pass 100%

### 4.1 Rooms REST (6 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 4.1.1 | Create room | `POST /rooms` `{name:"Test Room"}` | 201 |
| 4.1.2 | List rooms | `GET /rooms` | 200, public rooms |
| 4.1.3 | Get room | `GET /rooms/:id` | 200, detail |
| 4.1.4 | Join | `POST /rooms/:id/join` | 200 |
| 4.1.5 | Leave | `POST /rooms/:id/leave` | 200 |
| 4.1.6 | Delete | `DELETE /rooms/:id` | 200 |

### 4.2 Rooms WebSocket (6 tests)

| # | Test | Event | Expected |
|---|------|-------|----------|
| 4.2.1 | Connect | `room:join` | `room:sync` received |
| 4.2.2 | Track change | `room:track-change` | All get `room:track-changed` |
| 4.2.3 | Chat | `room:chat` | All receive message |
| 4.2.4 | Vote | `room:vote` | `room:vote-result` broadcast |
| 4.2.5 | Kick | `room:kick` | Target gets `room:kicked` |
| 4.2.6 | Leave | `room:leave` | `room:user-left` broadcast |

### 4.3 Follows (6 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 4.3.1 | Follow | `POST /follows/:userId` | 200 |
| 4.3.2 | Following | `GET /follows/following` | 200, array |
| 4.3.3 | Followers | `GET /follows/followers` | 200, array |
| 4.3.4 | Unfollow | `DELETE /follows/:userId` | 200 |
| 4.3.5 | Feed | `GET /follows/feed` | 200 |
| 4.3.6 | Blend | `POST /follows/blend/:userId` | 200 |

### 4.4 Profiles (3 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 4.4.1 | Profile | `GET /profiles/:id` | 200 |
| 4.4.2 | Taste card | `GET /profiles/:id/taste-card` | 200 |
| 4.4.3 | Playlists | `GET /profiles/:id/playlists` | 200 |

### 4.5 Notifications (4 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 4.5.1 | List | `GET /notifications` | 200, array |
| 4.5.2 | Mark read | `PUT /notifications/:id/read` | 200 |
| 4.5.3 | Read all | `PUT /notifications/read-all` | 200 |
| 4.5.4 | Settings | `PUT /notifications/settings` | 200 |

**Tổng Phase 4: 25 tests**

---

## PHASE 5: ADVANCED (9 endpoints)

> Prerequisite: Phase 4 pass 100%

### 5.1 Subscriptions (6 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 5.1.1 | Plans (❌ public) | `GET /subscriptions/plans` | 200, 3 tiers |
| 5.1.2 | Purchase | `POST /subscriptions/purchase` `{tier:"PREMIUM"}` | 200 |
| 5.1.3 | Premium unlocked | Premium endpoints → 200 | Works |
| 5.1.4 | Cancel | `POST /subscriptions/cancel` | 200 |
| 5.1.5 | Referral | `GET /subscriptions/referral` | 200, `{code}` |
| 5.1.6 | Apply referral | `POST /subscriptions/referral/apply` `{code}` | 200 |

### 5.2 Auto Play (3 tests) — Premium

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 5.2.1 | Auto play | `GET /ai/auto/play` | 200, AI track |
| 5.2.2 | Get settings | `GET /ai/auto/settings` | 200 |
| 5.2.3 | Save settings | `POST /ai/auto/settings` `{genres,mood}` | 200 |

### 5.3 Tier Access (4 tests)

| # | Test | Expected |
|---|------|----------|
| 5.3.1 | Free → Premium endpoint | 403 |
| 5.3.2 | Premium → Pro endpoint | 403 |
| 5.3.3 | Pro → all endpoints | 200 |
| 5.3.4 | Expired → Free | Tier reverts |

**Tổng Phase 5: 13 tests**

---

## Tổng kết

| Phase | Tests | Endpoints | Trạng thái |
|-------|-------|-----------|------------|
| Phase 0 — Infrastructure | 14 | Health + Config | ⬜ Chờ test |
| Phase 1 — Foundation | ~89 | 52 REST + 3 sync | ⬜ Chờ test |
| Phase 2 — Intelligence | 26 | 21 REST | ⬜ Chờ test |
| Phase 3 — AI WOW | 25 | 19 REST | ⬜ Chờ test |
| Phase 4 — Social | 25 | 19 REST + 8 WS | ⬜ Chờ test |
| Phase 5 — Advanced | 13 | 9 REST | ⬜ Chờ test |
| **Tổng** | **~192** | **~123 REST + 8 WS** | |

> Sẵn sàng test? Yêu cầu: **"Test Phase 0"** → chạy test, fix lỗi, confirm pass → next.
