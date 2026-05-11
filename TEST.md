# 🧪 VibeMusic API — Test Plan

> Hướng dẫn test toàn bộ API theo Phase. Mỗi Phase test xong 100% mới chuyển Phase tiếp.
>
> **Quy trình**: Chạy infrastructure → Test từng Phase → Fix lỗi → Confirm pass → Next Phase

---

## Chuẩn bị chung

```bash
# 1. Start infrastructure
cd ../vibemusic-infra && docker-compose up -d

# 2. Verify infrastructure
docker exec vibemusic-postgres pg_isready -U vibemusic   # → accepting connections
docker exec vibemusic-redis redis-cli ping                # → PONG

# 3. Setup API
cd ../vibemusic-api
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run start:dev

# 4. Verify API running
curl http://localhost:3000/health
```

### Biến môi trường test

```bash
BASE=http://localhost:3000
EMAIL="test_$(date +%s)@test.com"
PASS="Test123456"
```

### Lấy token helper

```bash
# Register + lấy token
RESULT=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Tester\"}")
TOKEN=$(echo $RESULT | jq -r '.accessToken')
REFRESH=$(echo $RESULT | jq -r '.refreshToken')

# Header helper
AUTH="Authorization: Bearer $TOKEN"
```

---

## PHASE 1: FOUNDATION (52 endpoints)

> Mục tiêu: Xác nhận toàn bộ core API hoạt động — auth, playback, search, discovery, playlists, library

### 1.0 Infrastructure (9 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.0.1 | Docker running | `docker-compose ps` | postgres + redis Up |
| 1.0.2 | PostgreSQL ready | `docker exec vibemusic-postgres pg_isready -U vibemusic` | accepting connections |
| 1.0.3 | Redis ready | `docker exec vibemusic-redis redis-cli ping` | PONG |
| 1.0.4 | Prisma migrate | `npx prisma migrate dev` | All migrations applied |
| 1.0.5 | Prisma generate | `npx prisma generate` | Client generated |
| 1.0.6 | App starts | `npm run start:dev` | "VibeMusic API running" |
| 1.0.7 | Health check | `curl $BASE/health` | `{"status":"ok","database":"connected","redis":"connected"}` |
| 1.0.8 | Swagger UI | Open `$BASE/api-docs` | Swagger page loads |
| 1.0.9 | Config | `curl $BASE/config` | Feature flags JSON |

### 1.1 Auth Module (13 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.1.1 | Register | `curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"Test123456","name":"Test"}'` | 201, `{accessToken, refreshToken, user}` |
| 1.1.2 | Register duplicate | Same email lần 2 | 409 Conflict |
| 1.1.3 | Register weak password | `{"password":"123"}` | 400 Validation error |
| 1.1.4 | Login | `curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"Test123456"}'` | 200, `{accessToken, refreshToken}` |
| 1.1.5 | Login wrong password | `{"password":"wrong"}` | 401 Unauthorized |
| 1.1.6 | Login unknown email | `{"email":"no@exist.com"}` | 401 |
| 1.1.7 | Refresh token | `curl -s -X POST $BASE/auth/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"<token>"}'` | 200, new tokens |
| 1.1.8 | Refresh invalid | `{"refreshToken":"invalid"}` | 401 |
| 1.1.9 | Forgot password | `curl -s -X POST $BASE/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"test@test.com"}'` | 200 |
| 1.1.10 | Access without token | `curl -s $BASE/users/me` | 401 |
| 1.1.11 | Access expired token | Expired JWT | 401 |
| 1.1.12 | Logout | `curl -s -X POST $BASE/auth/logout -H "$AUTH"` | 200 |
| 1.1.13 | Refresh after logout | Old refresh token | 401 |

### 1.2 Users Module (6 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.2.1 | Get profile | `curl -s -H "$AUTH" $BASE/users/me` | 200, `{id, email, name, tier}` |
| 1.2.2 | Update name | `curl -s -X PUT -H "$AUTH" -H 'Content-Type: application/json' $BASE/users/me -d '{"name":"New Name"}'` | 200 |
| 1.2.3 | Update avatar | `curl -s -X PUT -H "$AUTH" -H 'Content-Type: application/json' $BASE/users/me -d '{"avatarUrl":"https://example.com/avatar.jpg"}'` | 200 |
| 1.2.4 | Get devices | `curl -s -H "$AUTH" $BASE/users/me/devices` | 200, array |
| 1.2.5 | Get subscription | `curl -s -H "$AUTH" $BASE/users/me/subscription` | 200, `{tier:"FREE"}` |
| 1.2.6 | Delete account | `curl -s -X DELETE -H "$AUTH" $BASE/users/me` | 200, sau đó login fails |

### 1.3 Playback Module (7 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.3.1 | Get stream URL | `curl -s -H "$AUTH" $BASE/playback/stream/dQw4w9WgXcQ` | 200, `{url, quality}` |
| 1.3.2 | Stream cached | Same request lần 2 | Faster (Redis hit) |
| 1.3.3 | Get track info | `curl -s -H "$AUTH" $BASE/playback/info/dQw4w9WgXcQ` | 200, `{title, artist, duration}` |
| 1.3.4 | Get formats | `curl -s -H "$AUTH" $BASE/playback/formats/dQw4w9WgXcQ` | 200, array |
| 1.3.5 | Batch info | `curl -s -X POST -H "$AUTH" -H 'Content-Type: application/json' $BASE/playback/batch-info -d '{"youtubeIds":["dQw4w9WgXcQ"]}'` | 200, array |
| 1.3.6 | Invalid YouTube ID | `curl -s -H "$AUTH" $BASE/playback/stream/INVALID` | Error response |
| 1.3.7 | Quality param | `curl -s -H "$AUTH" "$BASE/playback/stream/dQw4w9WgXcQ?quality=128k"` | 200 |

### 1.4 Search Module (6 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.4.1 | Search videos | `curl -s -H "$AUTH" "$BASE/search?q=nhạc trẻ"` | 200, `{results:[...]}` |
| 1.4.2 | Search playlists | `curl -s -H "$AUTH" "$BASE/search?q=lofi&type=playlist"` | 200 |
| 1.4.3 | Search with limit | `curl -s -H "$AUTH" "$BASE/search?q=pop&limit=5"` | 200, max 5 |
| 1.4.4 | Empty query | `curl -s -H "$AUTH" "$BASE/search?q="` | 200, empty |
| 1.4.5 | Autocomplete | `curl -s -H "$AUTH" "$BASE/search/suggest?q=son tung"` | 200, suggestions |
| 1.4.6 | Cached search | Same query lần 2 | Faster |

### 1.5 Discovery Module (12 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.5.1 | Trending VN | `curl -s -H "$AUTH" "$BASE/discovery/trending?country=VN"` | 200, array |
| 1.5.2 | Trending US | `curl -s -H "$AUTH" "$BASE/discovery/trending?country=US"` | 200 |
| 1.5.3 | Popular | `curl -s -H "$AUTH" "$BASE/discovery/popular?country=VN"` | 200 |
| 1.5.4 | New tracks | `curl -s -H "$AUTH" "$BASE/discovery/new-tracks?country=VN"` | 200 |
| 1.5.5 | Charts | `curl -s -H "$AUTH" "$BASE/discovery/charts?country=ZZ"` | 200 |
| 1.5.6 | Artists | `curl -s -H "$AUTH" "$BASE/discovery/artists?country=VN"` | 200 |
| 1.5.7 | Playlists | `curl -s -H "$AUTH" "$BASE/discovery/playlists?country=VN"` | 200 |
| 1.5.8 | Genres | `curl -s -H "$AUTH" $BASE/discovery/genres` | 200, array |
| 1.5.9 | Genre videos | `curl -s -H "$AUTH" "$BASE/discovery/genres/pop/videos?region=VN"` | 200 |
| 1.5.10 | Mood categories | `curl -s -H "$AUTH" $BASE/discovery/mood/categories` | 200 |
| 1.5.11 | Mood playlists | `curl -s -H "$AUTH" $BASE/discovery/mood/<id>/playlists` | 200 |
| 1.5.12 | Cache verify | Same endpoint 2 lần | 2nd faster |
| 1.5.13 | Sync jobs list | `curl -s $BASE/discovery/sync/jobs` | 200, 9 jobs listed |
| 1.5.14 | Manual trigger | `curl -s -X POST $BASE/discovery/sync/genres` | 200, `{status:"success"}` |
| 1.5.15 | Sync status | `curl -s $BASE/discovery/sync/status` | 200, `{runs:[...]}` |
| 1.5.16 | Data populated | `curl -s -H "$AUTH" $BASE/discovery/genres` sau khi sync | 200, non-empty array |

> **Note**: Discovery tự seed data khi app khởi động lần đầu (DB empty). Nếu muốn force re-sync: `POST /discovery/sync/all`

### 1.6 Playlists Module (15 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.6.1 | Create playlist | `POST /playlists` `{"title":"My Playlist"}` | 201, `{id, title}` |
| 1.6.2 | List playlists | `GET /playlists` | 200, array |
| 1.6.3 | Get playlist | `GET /playlists/:id` | 200, playlist+tracks |
| 1.6.4 | Update title | `PUT /playlists/:id` `{"title":"Renamed"}` | 200 |
| 1.6.5 | Make public | `PUT /playlists/:id` `{"isPublic":true}` | 200 |
| 1.6.6 | Add tracks | `POST /playlists/:id/tracks` `{"youtubeIds":["dQw4w9WgXcQ"]}` | 200 |
| 1.6.7 | Add duplicate | Same track again | No duplicate |
| 1.6.8 | Remove track | `DELETE /playlists/:id/tracks/:trackId` | 200 |
| 1.6.9 | Reorder | `PUT /playlists/:id/tracks/reorder` `{"trackIds":["b","a"]}` | 200 |
| 1.6.10 | Generate share | `POST /playlists/:id/share` | 200, `{shareCode}` |
| 1.6.11 | Get shared (no auth) | `GET /playlists/shared/:code` | 200 |
| 1.6.12 | Invalid share code | `GET /playlists/shared/invalid` | 404 |
| 1.6.13 | Import YouTube | `POST /playlists/import` `{"youtubeUrl":"..."}` | 200 |
| 1.6.14 | Delete playlist | `DELETE /playlists/:id` | 200 |
| 1.6.15 | Other user private | `GET /playlists/:otherId` | 403 |

### 1.7 Library Module (12 tests)

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.7.1 | Add favorite | `POST /library/favorites/dQw4w9WgXcQ` | 200 |
| 1.7.2 | List favorites | `GET /library/favorites` | 200, array |
| 1.7.3 | Duplicate favorite | Same ID again | 200 (no error) |
| 1.7.4 | Remove favorite | `DELETE /library/favorites/dQw4w9WgXcQ` | 200 |
| 1.7.5 | Record history | `POST /library/history` `{"youtubeId":"dQw4w9WgXcQ","durationPlayed":120}` | 200 |
| 1.7.6 | Get history | `GET /library/history?limit=10` | 200, `{items, total}` |
| 1.7.7 | Clear history | `DELETE /library/history` | 200 |
| 1.7.8 | Update queue | `PUT /library/queue` `{"tracks":["id1","id2"],"currentIndex":0}` | 200 |
| 1.7.9 | Get queue | `GET /library/queue` | 200, `{tracks, currentIndex}` |
| 1.7.10 | Create backup | `POST /library/backup` | 200, `{code}` |
| 1.7.11 | Restore backup | `POST /library/restore` `{"code":"<code>"}` | 200 |
| 1.7.12 | Invalid backup | `POST /library/restore` `{"code":"invalid"}` | 404 |

### 1.8 E2E Flow (14 steps)

```
1. POST /auth/register → get tokens
2. GET /users/me → verify profile
3. GET /search?q=nhạc trẻ → get YouTube IDs
4. GET /playback/stream/:id → verify streaming
5. POST /playlists → create playlist
6. POST /playlists/:id/tracks → add tracks
7. POST /library/favorites/:id → favorite
8. POST /library/history → record listen
9. GET /library/history → verify
10. POST /library/backup → backup
11. POST /playlists/:id/share → share code
12. GET /playlists/shared/:code → public access
13. POST /auth/logout → logout
14. GET /users/me → should 401
```

**Tổng Phase 1: ~80 tests**

---

## PHASE 2: INTELLIGENCE (21 endpoints)

> Prerequisite: Phase 1 pass 100%

### 2.1 AI Recommendation (9 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 2.1.1 | For you (no history) | `GET /ai/recommend/for-you` | 200, popular fallback |
| 2.1.2 | Seed data | `POST /library/history` × 10 lần | Seed listening data |
| 2.1.3 | For you (with history) | `GET /ai/recommend/for-you` | 200, personalized |
| 2.1.4 | Radio from seed | `GET /ai/recommend/radio?seed=dQw4w9WgXcQ&type=track` | 200 |
| 2.1.5 | Discover weekly | `GET /ai/recommend/discover-weekly` | 200 |
| 2.1.6 | Similar tracks | `GET /ai/recommend/similar/:id` | 200 |
| 2.1.7 | Feedback | `POST /ai/recommend/feedback` `{"trackId":"...","type":"like"}` | 200 |
| 2.1.8 | Because you listened (Premium) | `GET /ai/recommend/because-you-listened` | 200 (Premium) |
| 2.1.9 | Because (Free blocked) | Same, Free user | 403 |

### 2.2 AI Mood (5 tests)

| # | Test | Method + Endpoint | Body | Expected |
|---|------|-------------------|------|----------|
| 2.2.1 | Detect mood | `POST /ai/mood/detect` | `{"text":"buồn quá"}` | 200, `{mood:"sad"}` |
| 2.2.2 | Mood playlist | `POST /ai/mood/playlist` | `{"description":"chill buổi tối"}` | 200 |
| 2.2.3 | Mood history | `GET /ai/mood/history` | — | 200, array |
| 2.2.4 | Mood suggestion | `GET /ai/mood/suggestion` | — | 200 |
| 2.2.5 | Progression | `POST /ai/mood/progression` | `{"from":"sad","to":"happy"}` | 200 |

### 2.3 AI Context (2 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 2.3.1 | Report context | `POST /ai/context/report` `{"timeOfDay":"evening","activity":"relaxing"}` | 200 |
| 2.3.2 | Context suggest | `GET /ai/context/suggest` | 200 |

### 2.4 Smart Playback (5 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 2.4.1 | Start session | `POST /playback/session/start` | 200, `{sessionId}` |
| 2.4.2 | Track event | `POST /playback/session/event` `{"type":"play","trackId":"..."}` | 200 |
| 2.4.3 | Smart shuffle | `GET /playback/smart-shuffle?playlist=:id` | 200 |
| 2.4.4 | AI next track | `GET /playback/next-track?current=:id` | 200 |
| 2.4.5 | End session | `POST /playback/session/end` | 200 |

### 2.5 Lyrics (4 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 2.5.1 | Get lyrics | `GET /lyrics/:youtubeId` | 200 |
| 2.5.2 | No lyrics | `GET /lyrics/INVALID` | 404 or empty |
| 2.5.3 | Search lyrics | `GET /lyrics/search?q=see you again` | 200 |
| 2.5.4 | Translate | `POST /lyrics/:id/translate?lang=vi` | 200 (Premium) |

**Tổng Phase 2: ~25 tests**

---

## PHASE 3: AI WOW (19 endpoints)

> Prerequisite: Phase 2 pass 100%

### 3.1 AI DJ (6 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 3.1.1 | Start DJ | `POST /ai/dj/start` | 200, `{sessionId, firstTrack}` |
| 3.1.2 | Next track | `GET /ai/dj/next` | 200, contextual track |
| 3.1.3 | Command | `POST /ai/dj/command` `{"text":"chill hơn đi"}` | 200, mood shifts |
| 3.1.4 | Commentary | `GET /ai/dj/commentary/:trackId` | 200, `{audioUrl}` |
| 3.1.5 | Feedback | `POST /ai/dj/feedback` `{"trackId":"...","type":"up"}` | 200 |
| 3.1.6 | Stop DJ | `POST /ai/dj/stop` | 200 |

### 3.2 Voice Assistant (4 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 3.2.1 | Text command | `POST /ai/voice/text-command` `{"text":"phát nhạc chill"}` | 200, action |
| 3.2.2 | Audio command | `POST /ai/voice/command` (upload audio) | 200, STT→action |
| 3.2.3 | Get response | `GET /ai/voice/response/:id` | Audio file |
| 3.2.4 | Vietnamese slang | `POST /ai/voice/text-command` `{"text":"nhạc bolero cho mẹ"}` | Correct intent |

### 3.3 AI Karaoke (4 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 3.3.1 | Prepare | `POST /ai/karaoke/prepare/:id` | 200, `{jobId}` |
| 3.3.2 | Check status | `GET /ai/karaoke/status/:jobId` | `{status:"processing"|"done"}` |
| 3.3.3 | Stream result | `GET /ai/karaoke/stream/:jobId` | Audio stream |
| 3.3.4 | Transpose | `POST /ai/karaoke/transpose` `{"semitones":2}` | 200 |

### 3.4 Hum to Search (2 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 3.4.1 | Recognize | `POST /ai/hum/recognize` (upload audio) | 200, `{id}` |
| 3.4.2 | Get result | `GET /ai/hum/result/:id` | Matched songs |

### 3.5 Memory Music (4 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 3.5.1 | On this day | `GET /ai/memory/on-this-day` | 200 |
| 3.5.2 | Nostalgia | `GET /ai/memory/nostalgia?period=2024` | 200 |
| 3.5.3 | Patterns | `GET /ai/memory/patterns` | 200 |
| 3.5.4 | Seasonal | `GET /ai/memory/seasonal` | 200 |

**Tổng Phase 3: ~20 tests**

---

## PHASE 4: SOCIAL (19 REST + 8 WS)

> Prerequisite: Phase 3 pass 100%

### 4.1 Listening Rooms (10 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 4.1.1 | Create room | `POST /rooms` `{"name":"Test Room"}` | 201, `{id, name}` |
| 4.1.2 | List rooms | `GET /rooms` | 200, public rooms |
| 4.1.3 | Get room | `GET /rooms/:id` | 200, room detail |
| 4.1.4 | Join room | `POST /rooms/:id/join` | 200 |
| 4.1.5 | WS connect | Socket.io connect → `room:sync` | Sync event |
| 4.1.6 | WS track change | Host plays → `room:track-changed` | All clients get event |
| 4.1.7 | WS chat | Send `room:chat` | All receive |
| 4.1.8 | WS vote | Send `room:vote` → `room:vote-result` | Vote result |
| 4.1.9 | Leave room | `POST /rooms/:id/leave` → `room:user-left` | Left event |
| 4.1.10 | Delete room | `DELETE /rooms/:id` | All disconnected |

### 4.2 Social Features (8 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 4.2.1 | Follow user | `POST /follows/:id` | 200 |
| 4.2.2 | Following list | `GET /follows/following` | 200, array |
| 4.2.3 | Followers list | `GET /follows/followers` | 200, array |
| 4.2.4 | Unfollow | `DELETE /follows/:id` | 200 |
| 4.2.5 | Activity feed | `GET /follows/feed` | 200 |
| 4.2.6 | Blend playlist | `POST /follows/blend/:id` | 200 |
| 4.2.7 | Public profile | `GET /profiles/:id` | 200 |
| 4.2.8 | Taste card | `GET /profiles/:id/taste-card` | 200 |

### 4.3 Notifications (4 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 4.3.1 | List notifications | `GET /notifications` | 200, array |
| 4.3.2 | Mark read | `PUT /notifications/:id/read` | 200 |
| 4.3.3 | Mark all read | `PUT /notifications/read-all` | 200 |
| 4.3.4 | Settings | `PUT /notifications/settings` | 200 |

**Tổng Phase 4: ~22 tests**

---

## PHASE 5: ADVANCED (9 endpoints)

> Prerequisite: Phase 4 pass 100%

### 5.1 Subscriptions (6 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 5.1.1 | List plans (no auth) | `GET /subscriptions/plans` | 200, 3 tiers |
| 5.1.2 | Purchase | `POST /subscriptions/purchase` `{"tier":"PREMIUM"}` | 200 |
| 5.1.3 | Premium unlocked | Premium endpoints → 200 (not 403) | Features work |
| 5.1.4 | Cancel | `POST /subscriptions/cancel` | 200, tier reverts |
| 5.1.5 | Referral code | `GET /subscriptions/referral` | 200, `{code}` |
| 5.1.6 | Apply referral | `POST /subscriptions/referral/apply` `{"code":"..."}` | 200 |

### 5.2 Auto Play (3 tests)

| # | Test | Method + Endpoint | Expected |
|---|------|-------------------|----------|
| 5.2.1 | Auto play | `GET /ai/auto/play` | 200, AI-selected track |
| 5.2.2 | Get settings | `GET /ai/auto/settings` | 200 |
| 5.2.3 | Save settings | `POST /ai/auto/settings` `{"genres":["pop"],"mood":"chill"}` | 200 |

### 5.3 Tier Access Control (4 tests)

| # | Test | Expected |
|---|------|----------|
| 5.3.1 | Free user → Premium endpoint | 403 |
| 5.3.2 | Premium user → Pro endpoint | 403 |
| 5.3.3 | Pro user → all endpoints | 200 |
| 5.3.4 | Expired subscription → Free | Tier reverts |

**Tổng Phase 5: ~13 tests**

---

## Tổng kết

| Phase | Tests | Endpoints | Trạng thái |
|-------|-------|-----------|------------|
| Phase 1 — Foundation | ~84 | 52 REST + 3 sync | ⬜ Chờ test |
| Phase 2 — Intelligence | ~25 | 21 REST | ⬜ Chờ test |
| Phase 3 — AI WOW | ~20 | 19 REST | ⬜ Chờ test |
| Phase 4 — Social | ~22 | 19 REST + 8 WS | ⬜ Chờ test |
| Phase 5 — Advanced | ~13 | 9 REST | ⬜ Chờ test |
| **Tổng** | **~164** | **~123 REST + 8 WS** | |

> Khi sẵn sàng test, yêu cầu: **"Test Phase 1"** → tôi sẽ chạy từng test, fix lỗi, và confirm pass.
