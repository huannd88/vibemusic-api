#!/bin/bash
# VibeMusic API — Comprehensive Test Script
BASE="http://localhost:3000"
PASS=0; FAIL=0; TOTAL=0
TOKEN=""
REFRESH=""
PLAYLIST_ID=""
SHARE_CODE=""
ROOM_ID=""

R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; NC='\033[0m'

test_ep() {
  local method=$1 url=$2 data=$3 desc=$4 expect_code=${5:-200}
  TOTAL=$((TOTAL+1))
  local args="-s -o /tmp/api_resp.json -w %{http_code}"
  [[ -n "$TOKEN" ]] && args="$args -H 'Authorization: Bearer $TOKEN'"
  args="$args -H 'Content-Type: application/json'"
  [[ -n "$data" ]] && args="$args -d '$data'"
  
  local code=$(eval curl $args -X $method "$BASE$url")
  local body=$(cat /tmp/api_resp.json 2>/dev/null | head -c 200)
  
  if [[ "$code" =~ ^($expect_code)$ ]] || [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    PASS=$((PASS+1))
    echo -e "${G}✅ PASS${NC} [$code] $method $url — $desc"
  else
    FAIL=$((FAIL+1))
    echo -e "${R}❌ FAIL${NC} [$code] $method $url — $desc"
    echo "   Response: $body"
  fi
}

echo "═══════════════════════════════════════════════════"
echo "  VibeMusic API Test Suite — $(date)"
echo "═══════════════════════════════════════════════════"

# ━━━ PHASE 1: System & Auth ━━━
echo -e "\n${Y}▸ Phase 1: System & Auth${NC}"
test_ep GET "/health" "" "Health check"
test_ep GET "/config" "" "App config"

# Register
RESP=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d '{"name":"API Tester","email":"apitest@vibemusic.app","password":"Test123456!"}')
echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Register:', 'OK' if 'accessToken' in d or 'token' in d else d.get('message','?'))" 2>/dev/null || echo "Register: $RESP" | head -c 100
TOTAL=$((TOTAL+1))

# Login
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"apitest@vibemusic.app","password":"Test123456!"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',d.get('token','')))" 2>/dev/null)
REFRESH=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('refreshToken',''))" 2>/dev/null)

if [[ -n "$TOKEN" && "$TOKEN" != "" ]]; then
  PASS=$((PASS+2)); echo -e "${G}✅ PASS${NC} Register + Login OK (token received)"
else
  FAIL=$((FAIL+2)); echo -e "${R}❌ FAIL${NC} Login failed: $RESP"
  # Try register again with different email
  RESP=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
    -d '{"name":"API Tester2","email":"apitest2@vibemusic.app","password":"Test123456!"}')
  TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',d.get('token','')))" 2>/dev/null)
  REFRESH=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('refreshToken',''))" 2>/dev/null)
fi

echo "   Token: ${TOKEN:0:30}..."

# Auth endpoints
test_ep POST "/auth/refresh" "{\"refreshToken\":\"$REFRESH\"}" "Refresh token"
test_ep GET "/users/me" "" "Get profile"
test_ep PUT "/users/me" '{"name":"API Tester Updated"}' "Update profile"
test_ep GET "/users/me/devices" "" "List devices"
test_ep GET "/users/me/subscription" "" "Get subscription"
test_ep POST "/auth/forgot-password" '{"email":"apitest@vibemusic.app"}' "Forgot password"

# ━━━ PHASE 2: Search & Discovery ━━━
echo -e "\n${Y}▸ Phase 2: Search & Discovery${NC}"
test_ep GET "/search?q=Sơn+Tùng+MTP" "" "Search tracks"
test_ep GET "/search/suggest?q=son+tung" "" "Search suggestions"
test_ep GET "/discovery/trending" "" "Trending"
test_ep GET "/discovery/popular" "" "Popular"
test_ep GET "/discovery/new-tracks" "" "New tracks"
test_ep GET "/discovery/charts" "" "Charts"
test_ep GET "/discovery/genres" "" "Genres list"
test_ep GET "/discovery/genres/music_pop/videos" "" "Genre videos"
test_ep GET "/discovery/mood/categories" "" "Mood categories"
test_ep GET "/discovery/playlists" "" "Top playlists"
test_ep GET "/discovery/artists" "" "Top artists"

# ━━━ PHASE 3: Playback ━━━
echo -e "\n${Y}▸ Phase 3: Playback${NC}"
# Get a real video ID from search
VID=$(curl -s "$BASE/search?q=music" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('items',d.get('results',[]))
for i in items:
  vid=i.get('youtubeId',i.get('videoId',i.get('id','')))
  if vid: print(vid); break
" 2>/dev/null)
[[ -z "$VID" ]] && VID="dQw4w9WgXcQ"
echo "   Using video: $VID"

test_ep GET "/playback/info/$VID" "" "Track info"
test_ep GET "/playback/stream/$VID" "" "Stream URL"
test_ep GET "/playback/formats/$VID" "" "Audio formats"
test_ep POST "/playback/batch-info" "{\"ids\":[\"$VID\"]}" "Batch info"
test_ep POST "/playback/session/start" "{\"youtubeId\":\"$VID\"}" "Session start"
test_ep POST "/playback/session/event" "{\"type\":\"play\",\"youtubeId\":\"$VID\",\"position\":0}" "Session event"
test_ep GET "/playback/next-track?currentId=$VID" "" "Next track AI"
test_ep GET "/playback/smart-shuffle" "" "Smart shuffle"
test_ep POST "/playback/session/end" "{\"youtubeId\":\"$VID\"}" "Session end"

# ━━━ PHASE 4: Library & Playlists ━━━
echo -e "\n${Y}▸ Phase 4: Library & Playlists${NC}"
test_ep POST "/library/favorites/$VID" "" "Add favorite"
test_ep GET "/library/favorites" "" "Get favorites"
test_ep POST "/library/history" "{\"youtubeId\":\"$VID\"}" "Record history"
test_ep GET "/library/history" "" "Get history"
test_ep GET "/library/queue" "" "Get queue"
test_ep PUT "/library/queue" "{\"tracks\":[\"$VID\"]}" "Update queue"

# Playlist CRUD
RESP=$(curl -s -X POST "$BASE/playlists" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"Test Playlist","description":"API test"}')
PLAYLIST_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1))
if [[ -n "$PLAYLIST_ID" ]]; then
  PASS=$((PASS+1)); echo -e "${G}✅ PASS${NC} Create playlist (id=$PLAYLIST_ID)"
else
  FAIL=$((FAIL+1)); echo -e "${R}❌ FAIL${NC} Create playlist: $RESP"
  PLAYLIST_ID="test-pl"
fi

test_ep GET "/playlists" "" "List playlists"
test_ep GET "/playlists/$PLAYLIST_ID" "" "Get playlist"
test_ep PUT "/playlists/$PLAYLIST_ID" '{"name":"Updated Playlist"}' "Update playlist"
test_ep POST "/playlists/$PLAYLIST_ID/tracks" "{\"youtubeId\":\"$VID\"}" "Add track"
test_ep PUT "/playlists/$PLAYLIST_ID/tracks/reorder" "{\"trackIds\":[\"$VID\"]}" "Reorder tracks"

# Share
RESP=$(curl -s -X POST "$BASE/playlists/$PLAYLIST_ID/share" -H "Authorization: Bearer $TOKEN")
SHARE_CODE=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
TOTAL=$((TOTAL+1))
[[ -n "$SHARE_CODE" ]] && { PASS=$((PASS+1)); echo -e "${G}✅ PASS${NC} Share playlist (code=$SHARE_CODE)"; } || { FAIL=$((FAIL+1)); echo -e "${R}❌ FAIL${NC} Share: $RESP"; }

[[ -n "$SHARE_CODE" ]] && test_ep GET "/playlists/shared/$SHARE_CODE" "" "Get shared playlist"
test_ep POST "/playlists/import" '{"url":"https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"}' "Import YouTube"
test_ep POST "/library/backup" "" "Backup library"
test_ep DELETE "/playlists/$PLAYLIST_ID/tracks/$VID" "" "Remove track"
test_ep DELETE "/library/favorites/$VID" "" "Remove favorite"
test_ep DELETE "/library/history" "" "Clear history"
test_ep DELETE "/playlists/$PLAYLIST_ID" "" "Delete playlist"

# ━━━ PHASE 5: AI Features ━━━
echo -e "\n${Y}▸ Phase 5: AI Features${NC}"
test_ep POST "/ai/recommend" "{\"seedTrackIds\":[\"$VID\"],\"limit\":5}" "AI recommend"
test_ep GET "/ai/recommend/for-you" "" "For You"
test_ep GET "/ai/recommend/discover-weekly" "" "Discover Weekly"
test_ep GET "/ai/recommend/similar/$VID" "" "Similar tracks"
test_ep GET "/ai/recommend/because-you-listened?trackId=$VID" "" "Because You Listened"
test_ep POST "/ai/recommend/feedback" "{\"trackId\":\"$VID\",\"action\":\"like\"}" "Recommend feedback"
test_ep POST "/ai/mood/detect" '{"text":"I feel happy today"}' "Mood detect"
test_ep POST "/ai/mood/playlist" '{"mood":"happy","limit":10}' "Mood playlist"
test_ep GET "/ai/mood/history" "" "Mood history"
test_ep GET "/ai/mood/suggestion" "" "Mood suggestion"
test_ep POST "/ai/dj/start" '{"genres":["pop"],"mood":"energetic"}' "DJ start"
test_ep GET "/ai/dj/next" "" "DJ next track"
test_ep POST "/ai/dj/command" '{"command":"play something chill"}' "DJ command"
test_ep POST "/ai/dj/feedback" '{"trackId":"'$VID'","liked":true}' "DJ feedback"
test_ep POST "/ai/dj/stop" "" "DJ stop"
test_ep POST "/ai/context/report" '{"activity":"working","time":"morning"}' "Context report"
test_ep GET "/ai/context/suggest" "" "Context suggest"
test_ep GET "/ai/auto/settings" "" "Auto settings"
test_ep POST "/ai/auto/settings" '{"enabled":true}' "Update auto settings"
test_ep GET "/ai/auto/play" "" "Auto play next"
test_ep GET "/ai/memory/on-this-day" "" "Memory: On This Day"
test_ep GET "/ai/memory/nostalgia" "" "Memory: Nostalgia"
test_ep GET "/ai/memory/patterns" "" "Memory: Patterns"
test_ep GET "/ai/memory/seasonal" "" "Memory: Seasonal"
test_ep GET "/lyrics/$VID" "" "Get lyrics"
test_ep GET "/lyrics/search?q=hello" "" "Search lyrics"

# ━━━ PHASE 6: Social ━━━
echo -e "\n${Y}▸ Phase 6: Social${NC}"
# Rooms
RESP=$(curl -s -X POST "$BASE/rooms" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"Test Room","isPublic":true}')
ROOM_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1))
[[ -n "$ROOM_ID" ]] && { PASS=$((PASS+1)); echo -e "${G}✅ PASS${NC} Create room (id=$ROOM_ID)"; } || { FAIL=$((FAIL+1)); echo -e "${R}❌ FAIL${NC} Create room: $RESP"; ROOM_ID="test-room"; }

test_ep GET "/rooms" "" "List rooms"
test_ep GET "/rooms/$ROOM_ID" "" "Get room"
test_ep POST "/rooms/$ROOM_ID/join" "" "Join room"
test_ep POST "/rooms/$ROOM_ID/leave" "" "Leave room"

# Profiles & Follows
USER_ID=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
test_ep GET "/profiles/$USER_ID" "" "Public profile"
test_ep GET "/profiles/$USER_ID/taste-card" "" "Taste card"
test_ep GET "/profiles/$USER_ID/playlists" "" "Public playlists"
test_ep GET "/follows/following" "" "Following list"
test_ep GET "/follows/followers" "" "Followers list"
test_ep GET "/follows/feed" "" "Activity feed"

# Notifications
test_ep GET "/notifications" "" "List notifications"
test_ep PUT "/notifications/read-all" "" "Mark all read"

# Cleanup room
test_ep DELETE "/rooms/$ROOM_ID" "" "Delete room"

# ━━━ PHASE 7: Subscription ━━━
echo -e "\n${Y}▸ Phase 7: Subscription${NC}"
test_ep GET "/subscriptions/plans" "" "List plans"
test_ep GET "/subscriptions/referral" "" "Get referral code"
test_ep POST "/subscriptions/referral/apply" '{"code":"TESTCODE"}' "Apply referral"
test_ep POST "/subscriptions/purchase" '{"planId":"premium_monthly"}' "Purchase sub"
test_ep POST "/subscriptions/restore" '{"receipt":"test_receipt"}' "Restore purchase"

# ━━━ CLEANUP ━━━
echo -e "\n${Y}▸ Cleanup${NC}"
test_ep POST "/auth/logout" "" "Logout"

# ━━━ SUMMARY ━━━
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  ${G}PASSED: $PASS${NC}  |  ${R}FAILED: $FAIL${NC}  |  TOTAL: $TOTAL"
echo "  Pass Rate: $(( PASS * 100 / TOTAL ))%"
echo "═══════════════════════════════════════════════════"
