#!/bin/bash
# VibeMusic API — FIX & RETEST Failed Endpoints
BASE="http://localhost:3000"
PASS=0; FAIL=0; TOTAL=0
TOKEN=""
R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; NC='\033[0m'

test_ep() {
  local method=$1 url=$2 data=$3 desc=$4
  TOTAL=$((TOTAL+1))
  local args="-s -o /tmp/api_resp.json -w %{http_code}"
  [[ -n "$TOKEN" ]] && args="$args -H 'Authorization: Bearer $TOKEN'"
  args="$args -H 'Content-Type: application/json'"
  [[ -n "$data" ]] && args="$args -d '$data'"
  local code=$(eval curl $args -X $method "$BASE$url")
  local body=$(cat /tmp/api_resp.json 2>/dev/null | head -c 300)
  if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    PASS=$((PASS+1)); echo -e "${G}✅ PASS${NC} [$code] $method $url — $desc"
  else
    FAIL=$((FAIL+1)); echo -e "${R}❌ FAIL${NC} [$code] $method $url — $desc"
    echo "   → $body"
  fi
}

echo "═══════════════════════════════════════════════════"
echo "  RETEST: Fixed Endpoints — $(date)"
echo "═══════════════════════════════════════════════════"

# Login first
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"apitest@vibemusic.app","password":"Test123456!"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',d.get('token','')))" 2>/dev/null)
echo -e "${G}✅${NC} Logged in (token: ${TOKEN:0:20}...)"

# ━━━ FIX: Search needs auth ━━━
echo -e "\n${Y}▸ Fix: Search${NC}"
test_ep GET "/search?q=son+tung+mtp&type=video" "" "Search (with auth)"

# ━━━ FIX: Playback - try different video ━━━
echo -e "\n${Y}▸ Fix: Playback (get real video from search)${NC}"
VID=$(curl -s "$BASE/search?q=nhac+viet&type=video" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items = d if isinstance(d,list) else d.get('items',d.get('results',[]))
for i in items:
  v=i.get('youtubeId',i.get('videoId',i.get('id',{}).get('videoId','')))
  if v: print(v); break
" 2>/dev/null)
[[ -z "$VID" ]] && VID="ICjyAe9S54c"
echo "   Video ID: $VID"

test_ep GET "/playback/info/$VID" "" "Track info"
test_ep GET "/playback/stream/$VID" "" "Stream URL"
test_ep GET "/playback/formats/$VID" "" "Audio formats"
test_ep POST "/playback/batch-info" "{\"ids\":[\"$VID\"]}" "Batch info"
test_ep POST "/playback/session/start" "{\"youtubeId\":\"$VID\"}" "Session start"
test_ep POST "/playback/session/event" "{\"type\":\"play\",\"youtubeId\":\"$VID\",\"position\":0}" "Session event"
test_ep GET "/playback/next-track?currentId=$VID" "" "Next track AI"
test_ep POST "/playback/session/end" "{\"youtubeId\":\"$VID\"}" "Session end"

# ━━━ FIX: Queue (needs currentIndex) ━━━
echo -e "\n${Y}▸ Fix: Queue${NC}"
test_ep PUT "/library/queue" "{\"tracks\":[\"$VID\"],\"currentIndex\":0}" "Update queue"

# ━━━ FIX: Playlist CRUD (title not name, youtubeIds not youtubeId) ━━━
echo -e "\n${Y}▸ Fix: Playlist CRUD${NC}"
RESP=$(curl -s -X POST "$BASE/playlists" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"title":"Test Playlist API"}')
PL_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
TOTAL=$((TOTAL+1))
if [[ -n "$PL_ID" && "$PL_ID" != "" ]]; then
  PASS=$((PASS+1)); echo -e "${G}✅ PASS${NC} Create playlist (id=$PL_ID)"
else
  FAIL=$((FAIL+1)); echo -e "${R}❌ FAIL${NC} Create: $(echo $RESP | head -c 200)"
  PL_ID="skip"
fi

if [[ "$PL_ID" != "skip" ]]; then
  test_ep GET "/playlists/$PL_ID" "" "Get playlist"
  test_ep PUT "/playlists/$PL_ID" '{"title":"Updated Title"}' "Update playlist"
  test_ep POST "/playlists/$PL_ID/tracks" "{\"youtubeIds\":[\"$VID\"]}" "Add tracks"
  test_ep PUT "/playlists/$PL_ID/tracks/reorder" "{\"trackIds\":[\"$VID\"]}" "Reorder"

  # Share
  RESP=$(curl -s -X POST "$BASE/playlists/$PL_ID/share" -H "Authorization: Bearer $TOKEN")
  SC=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
  TOTAL=$((TOTAL+1))
  if [[ -n "$SC" && "$SC" != "" ]]; then
    PASS=$((PASS+1)); echo -e "${G}✅ PASS${NC} Share playlist (code=$SC)"
    test_ep GET "/playlists/shared/$SC" "" "Get shared playlist"
  else
    FAIL=$((FAIL+1)); echo -e "${R}❌ FAIL${NC} Share: $RESP"
  fi

  test_ep DELETE "/playlists/$PL_ID/tracks/$VID" "" "Remove track"
  test_ep DELETE "/playlists/$PL_ID" "" "Delete playlist"
fi

# ━━━ FIX: Import (youtubeUrl not url) ━━━
test_ep POST "/playlists/import" '{"youtubeUrl":"https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"}' "Import YouTube"

# ━━━ FIX: AI - correct DTO fields ━━━
echo -e "\n${Y}▸ Fix: AI Features${NC}"
test_ep POST "/ai/recommend/feedback" "{\"trackId\":\"$VID\",\"type\":\"like\"}" "Recommend feedback"
test_ep POST "/ai/mood/playlist" '{"description":"happy upbeat music for workout"}' "Mood playlist"
test_ep POST "/ai/dj/start" '{"mood":"energetic","genres":["pop"]}' "DJ restart"
test_ep POST "/ai/dj/command" '{"text":"play something chill"}' "DJ command"
test_ep POST "/ai/dj/feedback" "{\"trackId\":\"$VID\",\"type\":\"up\"}" "DJ feedback"
test_ep POST "/ai/context/report" '{"activity":"working","timeOfDay":"morning"}' "Context report"
test_ep GET "/ai/auto/play" "" "Auto play"

# ━━━ FIX: Voice & Karaoke & Hum ━━━
echo -e "\n${Y}▸ Fix: Voice, Karaoke, Hum, Lyrics${NC}"
test_ep POST "/ai/voice/text-command" '{"text":"play something relaxing"}' "Voice text command"
test_ep POST "/ai/karaoke/prepare/$VID" "" "Karaoke prepare"
test_ep POST "/ai/hum/recognize" '{"description":"a pop song with la la la"}' "Hum recognize"
test_ep POST "/lyrics/$VID/translate" '{"targetLang":"vi"}' "Translate lyrics"
test_ep POST "/ai/mood/progression" '{"from":"sad","to":"happy"}' "Mood progression"

# ━━━ FIX: Follows ━━━
echo -e "\n${Y}▸ Fix: Follow/Unfollow${NC}"
USER_ID=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
# Can't follow self, so just test the endpoint exists
test_ep POST "/follows/$USER_ID" "" "Follow (self—expect error)"
test_ep POST "/follows/blend/$USER_ID" "" "Blend (self)"

# ━━━ FIX: Notification settings ━━━
test_ep PUT "/notifications/settings" '{"pushEnabled":true,"emailEnabled":false}' "Notification settings"

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  ${G}PASSED: $PASS${NC}  |  ${R}FAILED: $FAIL${NC}  |  TOTAL: $TOTAL"
echo "  Pass Rate: $(( PASS * 100 / TOTAL ))%"
echo "═══════════════════════════════════════════════════"
