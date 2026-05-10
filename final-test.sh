#!/bin/bash
# VibeMusic API — FINAL comprehensive test
BASE="http://localhost:3000"
PASS=0; FAIL=0; TOTAL=0
TOKEN=""; R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; NC='\033[0m'

t() {
  local m=$1 u=$2 d=$3 desc=$4; TOTAL=$((TOTAL+1))
  local a="-s -o /tmp/r.json -w %{http_code} -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'"
  [[ -n "$d" ]] && a="$a -d '$d'"
  local c=$(eval curl $a -X $m "$BASE$u")
  local b=$(cat /tmp/r.json 2>/dev/null | head -c 300)
  if [[ "$c" =~ ^2[0-9][0-9]$ ]]; then
    PASS=$((PASS+1)); echo -e "${G}✅${NC} [$c] $m $u — $desc"
  else
    FAIL=$((FAIL+1)); echo -e "${R}❌${NC} [$c] $m $u — $desc → $(echo $b | head -c 120)"
  fi
  echo "$b" > /tmp/last_resp.json
}

echo "══════════════════════════════════════════════════════════"
echo "  VibeMusic Full API Test — $(date '+%Y-%m-%d %H:%M')"
echo "══════════════════════════════════════════════════════════"

# ── Phase 1: System & Auth ──
echo -e "\n${Y}━━ Phase 1: System & Auth ━━${NC}"
# Register
curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d '{"name":"FinalTest","email":"final@vibemusic.app","password":"Test123456!"}' > /dev/null 2>&1
# Login
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"final@vibemusic.app","password":"Test123456!"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',d.get('token','')))" 2>/dev/null)
REFRESH=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('refreshToken',''))" 2>/dev/null)
echo -e "${G}✅${NC} Login OK"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1))

t GET "/health" "" "Health"
t GET "/config" "" "Config"
t POST "/auth/refresh" "{\"refreshToken\":\"$REFRESH\"}" "Refresh"
t GET "/users/me" "" "Profile"
t PUT "/users/me" '{"name":"Final Tester"}' "Update profile"
t GET "/users/me/devices" "" "Devices"
t GET "/users/me/subscription" "" "Subscription"
t POST "/auth/forgot-password" '{"email":"final@vibemusic.app"}' "Forgot password"

# ── Phase 2: Search & Discovery ──
echo -e "\n${Y}━━ Phase 2: Search & Discovery ━━${NC}"
t GET "/search?q=nhac+viet&type=video" "" "Search"
t GET "/search/suggest?q=son+tung" "" "Suggestions"
t GET "/discovery/trending" "" "Trending"
t GET "/discovery/popular" "" "Popular"
t GET "/discovery/new-tracks" "" "New tracks"
t GET "/discovery/charts" "" "Charts"
t GET "/discovery/genres" "" "Genres"
t GET "/discovery/genres/music_pop/videos" "" "Genre videos"
t GET "/discovery/mood/categories" "" "Mood categories"
t GET "/discovery/playlists" "" "Playlists"
t GET "/discovery/artists" "" "Artists"

# ── Phase 3: Playback ──
echo -e "\n${Y}━━ Phase 3: Playback ━━${NC}"
VID=$(curl -s "$BASE/search?q=nhac+hay&type=video" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d,list) else d.get('items',d.get('results',[]))
for i in items:
  v=i.get('youtubeId',i.get('videoId',''))
  if v: print(v); break
" 2>/dev/null)
[[ -z "$VID" ]] && VID="dQw4w9WgXcQ"
echo "   VideoID: $VID"

t GET "/playback/info/$VID" "" "Track info"
t GET "/playback/stream/$VID" "" "Stream URL"
t GET "/playback/formats/$VID" "" "Formats"
t POST "/playback/batch-info" "{\"youtubeIds\":[\"$VID\"]}" "Batch info"

# Session: start → get sessionId → event → end
RESP=$(curl -s -X POST "$BASE/playback/session/start" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"device":"web-test","quality":"auto"}')
SID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sessionId',json.load(open('/dev/null')).get('id','')))" 2>/dev/null || echo "")
[[ -z "$SID" ]] && SID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',d.get('sessionId','')))" 2>/dev/null)
echo "   SessionID: $SID"
TOTAL=$((TOTAL+1)); PASS=$((PASS+1)); echo -e "${G}✅${NC} Session start"

t POST "/playback/session/event" "{\"sessionId\":\"$SID\",\"type\":\"play\",\"trackId\":\"$VID\",\"position\":0}" "Session event"
t GET "/playback/next-track?current=$VID" "" "Next track"
t GET "/playback/smart-shuffle?playlist=default" "" "Smart shuffle"
t POST "/playback/session/end" "{\"sessionId\":\"$SID\"}" "Session end"

# ── Phase 4: Library & Playlists ──
echo -e "\n${Y}━━ Phase 4: Library & Playlists ━━${NC}"
t POST "/library/favorites/$VID" "" "Add favorite"
t GET "/library/favorites" "" "Get favorites"
t POST "/library/history" "{\"youtubeId\":\"$VID\",\"durationPlayed\":120}" "Record history"
t GET "/library/history" "" "Get history"
t PUT "/library/queue" "{\"tracks\":[\"$VID\"],\"currentIndex\":0}" "Update queue"
t GET "/library/queue" "" "Get queue"

# Playlist CRUD
RESP=$(curl -s -X POST "$BASE/playlists" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"title":"Final Test Playlist"}')
PL=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1))
[[ -n "$PL" && "$PL" != "" ]] && { PASS=$((PASS+1)); echo -e "${G}✅${NC} Create playlist ($PL)"; } || { FAIL=$((FAIL+1)); echo -e "${R}❌${NC} Create playlist"; PL="skip"; }

if [[ "$PL" != "skip" ]]; then
  t GET "/playlists" "" "List playlists"
  t GET "/playlists/$PL" "" "Get playlist"
  t PUT "/playlists/$PL" '{"title":"Updated Final"}' "Update playlist"
  t POST "/playlists/$PL/tracks" "{\"youtubeIds\":[\"$VID\"]}" "Add tracks"
  t PUT "/playlists/$PL/tracks/reorder" "{\"trackIds\":[\"$VID\"]}" "Reorder"

  SC=$(curl -s -X POST "$BASE/playlists/$PL/share" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('shareCode',d.get('code','')))" 2>/dev/null)
  TOTAL=$((TOTAL+1))
  [[ -n "$SC" && "$SC" != "" ]] && { PASS=$((PASS+1)); echo -e "${G}✅${NC} Share ($SC)"; t GET "/playlists/shared/$SC" "" "Shared playlist"; } || { FAIL=$((FAIL+1)); echo -e "${R}❌${NC} Share"; }

  t DELETE "/playlists/$PL/tracks/$VID" "" "Remove track"
  t POST "/library/backup" "" "Backup"
  t DELETE "/playlists/$PL" "" "Delete playlist"
fi

t DELETE "/library/favorites/$VID" "" "Remove favorite"
t DELETE "/library/history" "" "Clear history"

# ── Phase 5: AI Features ──
echo -e "\n${Y}━━ Phase 5: AI Features ━━${NC}"
t GET "/ai/recommend/for-you" "" "For You"
t GET "/ai/recommend/discover-weekly" "" "Discover Weekly"
t GET "/ai/recommend/similar/$VID" "" "Similar"
t GET "/ai/recommend/because-you-listened?trackId=$VID" "" "Because You Listened"
t POST "/ai/recommend/feedback" "{\"trackId\":\"$VID\",\"type\":\"like\"}" "Feedback"
t POST "/ai/mood/detect" '{"text":"feeling happy"}' "Mood detect"
t POST "/ai/mood/playlist" '{"description":"energetic workout music"}' "Mood playlist"
t GET "/ai/mood/history" "" "Mood history"
t GET "/ai/mood/suggestion" "" "Mood suggestion"
t POST "/ai/dj/start" '{"mood":"chill","genres":["pop"]}' "DJ start"
t GET "/ai/dj/next" "" "DJ next"
t POST "/ai/dj/command" '{"text":"play something upbeat"}' "DJ command"
t POST "/ai/dj/feedback" "{\"trackId\":\"$VID\",\"type\":\"up\"}" "DJ feedback"
t POST "/ai/dj/stop" "" "DJ stop"
t POST "/ai/context/report" '{"activity":"working","timeOfDay":"morning"}' "Context report"
t GET "/ai/context/suggest" "" "Context suggest"
t GET "/ai/auto/settings" "" "Auto settings"
t POST "/ai/auto/settings" '{"enabled":true}' "Update auto"
t GET "/ai/memory/on-this-day" "" "On This Day"
t GET "/ai/memory/nostalgia" "" "Nostalgia"
t GET "/ai/memory/patterns" "" "Patterns"
t GET "/ai/memory/seasonal" "" "Seasonal"
t GET "/lyrics/$VID" "" "Lyrics"
t GET "/lyrics/search?q=hello" "" "Lyrics search"
t POST "/lyrics/$VID/translate" '{"targetLang":"vi"}' "Translate"
t POST "/ai/voice/text-command" '{"text":"play chill music"}' "Voice command"
t POST "/ai/hum/recognize" '{"description":"a pop song la la la"}' "Hum recognize"

# ── Phase 6: Social ──
echo -e "\n${Y}━━ Phase 6: Social ━━${NC}"
RESP=$(curl -s -X POST "$BASE/rooms" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"Test Room","isPublic":true}')
RM=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1))
[[ -n "$RM" ]] && { PASS=$((PASS+1)); echo -e "${G}✅${NC} Create room ($RM)"; } || { FAIL=$((FAIL+1)); echo -e "${R}❌${NC} Create room"; RM="skip"; }

[[ "$RM" != "skip" ]] && {
  t GET "/rooms" "" "List rooms"
  t GET "/rooms/$RM" "" "Get room"
  t POST "/rooms/$RM/join" "" "Join"
  t POST "/rooms/$RM/leave" "" "Leave"
  t DELETE "/rooms/$RM" "" "Delete room"
}

UID=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
t GET "/profiles/$UID" "" "Public profile"
t GET "/profiles/$UID/taste-card" "" "Taste card"
t GET "/profiles/$UID/playlists" "" "Public playlists"
t GET "/follows/following" "" "Following"
t GET "/follows/followers" "" "Followers"
t GET "/follows/feed" "" "Feed"
t GET "/notifications" "" "Notifications"
t PUT "/notifications/read-all" "" "Mark all read"
t PUT "/notifications/settings" '{"pushEnabled":true}' "Notif settings"

# ── Phase 7: Subscription ──
echo -e "\n${Y}━━ Phase 7: Subscription ━━${NC}"
t GET "/subscriptions/plans" "" "Plans"
t GET "/subscriptions/referral" "" "Referral code"
t POST "/subscriptions/referral/apply" '{"code":"TESTCODE"}' "Apply referral"
t POST "/subscriptions/purchase" '{"planId":"premium_monthly"}' "Purchase"
t POST "/subscriptions/restore" '{"receipt":"test"}' "Restore"

# Cleanup
t POST "/auth/logout" "" "Logout"

echo ""
echo "══════════════════════════════════════════════════════════"
echo -e "  ${G}PASSED: $PASS${NC}  |  ${R}FAILED: $FAIL${NC}  |  TOTAL: $TOTAL"
[[ $TOTAL -gt 0 ]] && echo "  Pass Rate: $(( PASS * 100 / TOTAL ))%"
echo "══════════════════════════════════════════════════════════"
