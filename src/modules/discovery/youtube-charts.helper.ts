/**
 * YouTube Charts Scraper
 * =====================================================
 * Scrape data from charts.youtube.com using InnerTube browse API
 * Ported from Upbeat's youtube_charts_scraper.js → TypeScript
 *
 * API returns all chart types in 1 response:
 *   - artists[0].artistViews[]      → Top Artists
 *   - trackTypes[0].trackViews[]    → Top Songs (tracks)
 *   - videos[0].videoViews[]        → Top Videos (TOP_VIEWS_CHART)
 *   - videos[1].videoViews[]        → Trending Videos (TRENDING_CHART)
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('YouTubeCharts');

// ─── Constants ────────────────────────────────────────
const CHARTS_BASE_URL = 'https://charts.youtube.com';
const BROWSE_ENDPOINT = '/youtubei/v1/browse';
const BROWSE_ID = 'FEmusic_analytics_charts_home';

const REQUEST_DELAY = 1500;
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 2;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

// ─── Types ────────────────────────────────────────────

export interface ChartVideo {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  rank: number;
  trend: string;
  viewCount?: number;
  countryCode: string;
}

export interface ChartArtist {
  name: string;
  channelId: string;
  thumbnail: string;
  rank: number;
  countryCode: string;
}

// ─── Internal Helpers ─────────────────────────────────

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const determineTrend = (currentRank: number, previousRank: number): string => {
  if (!previousRank || previousRank === 0) return 'new';
  if (currentRank < previousRank) return 'up';
  if (currentRank > previousRank) return 'down';
  return 'neutral';
};

const thumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

// ─── Cache InnerTube context ──────────────────────────

let _cachedContext: any = null;
let _cachedContextTime = 0;
const CONTEXT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getInnertubeContext(): Promise<any> {
  if (_cachedContext && (Date.now() - _cachedContextTime) < CONTEXT_CACHE_TTL) {
    return _cachedContext;
  }

  const pageUrl = `${CHARTS_BASE_URL}/charts/TopSongs/us/weekly`;
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    const html = await response.text();

    const ytcfgStart = html.indexOf('ytcfg.set({');
    if (ytcfgStart < 0) {
      logger.error('getInnertubeContext: ytcfg.set not found in HTML');
      return null;
    }

    let depth = 0;
    const startPos = ytcfgStart + 'ytcfg.set('.length;
    let endPos = startPos;
    for (let i = startPos; i < html.length; i++) {
      if (html[i] === '{') depth++;
      if (html[i] === '}') depth--;
      if (depth === 0) { endPos = i + 1; break; }
    }

    const ytcfgData = JSON.parse(html.substring(startPos, endPos));
    const context = ytcfgData.INNERTUBE_CONTEXT;

    if (!context) {
      logger.error('getInnertubeContext: INNERTUBE_CONTEXT not found');
      return null;
    }

    _cachedContext = context;
    _cachedContextTime = Date.now();
    logger.log('InnerTube context fetched and cached');
    return context;
  } catch (e) {
    logger.error(`getInnertubeContext error: ${(e as Error).message}`);
    return null;
  }
}

async function fetchChartsData(countryCode: string): Promise<any> {
  const cc = (countryCode || 'us').toLowerCase();
  const context = await getInnertubeContext();
  if (!context) return null;

  const adjustedContext = JSON.parse(JSON.stringify(context));
  adjustedContext.client.gl = cc.toUpperCase();

  const query = `chart_params_type=WEEK&perspective=CHART&flags=viral_video_chart&selected_chart=TRACKS&chart_params_id=weekly:0:0:${cc}`;
  const browseUrl = `${CHARTS_BASE_URL}${BROWSE_ENDPOINT}?alt=json`;

  try {
    const response = await fetch(browseUrl, {
      method: 'POST',
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Content-Type': 'application/json',
        'Referer': `${CHARTS_BASE_URL}/charts/TopSongs/${cc}/weekly`,
        'Origin': CHARTS_BASE_URL,
      },
      body: JSON.stringify({
        context: adjustedContext,
        browseId: BROWSE_ID,
        query,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    return await response.json();
  } catch (e) {
    logger.error(`fetchChartsData error (${cc}): ${(e as Error).message}`);
    return null;
  }
}

function extractSectionContent(data: any): any {
  if (!data) return null;
  const sections = data?.contents?.sectionListRenderer?.contents || [];
  for (const section of sections) {
    const renderer = section?.musicAnalyticsSectionRenderer;
    if (renderer?.content) return renderer.content;
  }
  return null;
}

// ─── Public API ───────────────────────────────────────

/**
 * Get Trending Videos by country
 * Source: videos[1] (TRENDING_CHART) or videos[0] fallback
 */
export async function getTrendingVideos(countryCode: string): Promise<ChartVideo[]> {
  const cc = countryCode.toUpperCase();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchChartsData(countryCode);
      const content = extractSectionContent(data);

      if (!content) {
        if (attempt < MAX_RETRIES) { await delay(REQUEST_DELAY); continue; }
        return [];
      }

      let videoViews = null;
      if (content.videos?.length > 1 && content.videos[1].listType === 'TRENDING_CHART') {
        videoViews = content.videos[1].videoViews;
      } else if (content.videos?.length > 0) {
        videoViews = content.videos[0].videoViews;
      }

      if (!videoViews?.length) {
        if (attempt < MAX_RETRIES) { await delay(REQUEST_DELAY); continue; }
        return [];
      }

      return videoViews.map((entry: any, i: number) => {
        const videoId = entry.id || '';
        const artistNames = (entry.artists || []).map((a: any) => a.name).filter(Boolean).join(', ');
        const thumbnails = entry.thumbnail?.thumbnails || [];
        const hqThumb = thumbnails.find((t: any) => t.width === 480) || thumbnails[thumbnails.length - 1] || {};

        return {
          videoId,
          title: entry.title || '',
          artist: entry.channelName || artistNames || '',
          thumbnail: hqThumb.url || thumbnailUrl(videoId),
          rank: entry.chartEntryMetadata?.currentPosition || (i + 1),
          trend: determineTrend(
            entry.chartEntryMetadata?.currentPosition || (i + 1),
            entry.chartEntryMetadata?.previousPosition || 0,
          ),
          countryCode: cc,
        };
      });
    } catch (e) {
      logger.error(`getTrendingVideos error (${cc}, attempt ${attempt + 1}): ${(e as Error).message}`);
      if (attempt < MAX_RETRIES) await delay(REQUEST_DELAY);
    }
  }
  return [];
}

/**
 * Get Top Songs "Most Popular" by country
 * Source: trackTypes[0].trackViews, sorted by viewCount
 */
export async function getTopSongsMostPopular(countryCode: string): Promise<ChartVideo[]> {
  const cc = countryCode.toUpperCase();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchChartsData(countryCode);
      const content = extractSectionContent(data);

      if (!content?.trackTypes?.[0]?.trackViews) {
        if (attempt < MAX_RETRIES) { await delay(REQUEST_DELAY); continue; }
        return [];
      }

      const trackViews = content.trackTypes[0].trackViews;
      return trackViews.map((entry: any, i: number) => {
        const meta = entry.chartEntryMetadata || {};
        const currentPos = meta.currentPosition || (i + 1);
        const prevPos = meta.previousPosition || 0;
        const videoId = entry.encryptedVideoId || '';
        const artistNames = (entry.artists || []).map((a: any) => a.name).filter(Boolean).join(', ');
        const thumbnails = entry.thumbnail?.thumbnails || [];
        const hqThumb = thumbnails.find((t: any) => t.width === 480) || thumbnails[thumbnails.length - 1] || {};

        return {
          videoId,
          title: entry.name || '',
          artist: artistNames || '',
          thumbnail: hqThumb.url || thumbnailUrl(videoId),
          viewCount: parseInt(entry.viewCount || '0', 10),
          rank: currentPos,
          trend: determineTrend(currentPos, prevPos),
          countryCode: cc,
        };
      });
    } catch (e) {
      logger.error(`getTopSongsMostPopular error (${cc}): ${(e as Error).message}`);
      if (attempt < MAX_RETRIES) await delay(REQUEST_DELAY);
    }
  }
  return [];
}

/**
 * Get Top Songs "Biggest Movers" by country
 * Source: trackTypes[0].trackViews, filtered/sorted by rank change
 */
export async function getTopSongsBiggestMovers(countryCode: string): Promise<ChartVideo[]> {
  const cc = countryCode.toUpperCase();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchChartsData(countryCode);
      const content = extractSectionContent(data);

      if (!content?.trackTypes?.[0]?.trackViews) {
        if (attempt < MAX_RETRIES) { await delay(REQUEST_DELAY); continue; }
        return [];
      }

      const trackViews = content.trackTypes[0].trackViews;

      const movers = trackViews
        .filter((entry: any) => {
          const meta = entry.chartEntryMetadata || {};
          return meta.previousPosition > 0 && meta.currentPosition < meta.previousPosition;
        })
        .sort((a: any, b: any) => {
          const moveA = (a.chartEntryMetadata?.previousPosition || 0) - (a.chartEntryMetadata?.currentPosition || 0);
          const moveB = (b.chartEntryMetadata?.previousPosition || 0) - (b.chartEntryMetadata?.currentPosition || 0);
          return moveB - moveA;
        });

      const entries = movers.length > 0 ? movers : trackViews.sort((a: any, b: any) => {
        return (b.chartEntryMetadata?.percentViewsChange || 0) - (a.chartEntryMetadata?.percentViewsChange || 0);
      });

      return entries.map((entry: any, i: number) => {
        const meta = entry.chartEntryMetadata || {};
        const currentPos = meta.currentPosition || (i + 1);
        const prevPos = meta.previousPosition || 0;
        const videoId = entry.encryptedVideoId || '';
        const artistNames = (entry.artists || []).map((a: any) => a.name).filter(Boolean).join(', ');
        const thumbnails = entry.thumbnail?.thumbnails || [];
        const hqThumb = thumbnails.find((t: any) => t.width === 480) || thumbnails[thumbnails.length - 1] || {};

        return {
          videoId,
          title: entry.name || '',
          artist: artistNames || '',
          thumbnail: hqThumb.url || thumbnailUrl(videoId),
          viewCount: parseInt(entry.viewCount || '0', 10),
          rank: currentPos,
          trend: determineTrend(currentPos, prevPos),
          countryCode: cc,
        };
      });
    } catch (e) {
      logger.error(`getTopSongsBiggestMovers error (${cc}): ${(e as Error).message}`);
      if (attempt < MAX_RETRIES) await delay(REQUEST_DELAY);
    }
  }
  return [];
}

/**
 * Get Top Songs "Top Debuts" by country
 * Source: trackTypes[0].trackViews, filtered by periodsOnChart === 1
 */
export async function getTopSongsTopDebuts(countryCode: string): Promise<ChartVideo[]> {
  const cc = countryCode.toUpperCase();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchChartsData(countryCode);
      const content = extractSectionContent(data);

      if (!content?.trackTypes?.[0]?.trackViews) {
        if (attempt < MAX_RETRIES) { await delay(REQUEST_DELAY); continue; }
        return [];
      }

      const trackViews = content.trackTypes[0].trackViews;
      const debuts = trackViews.filter((entry: any) => {
        const meta = entry.chartEntryMetadata || {};
        return meta.periodsOnChart === 1 || meta.previousPosition === 0 || !meta.previousPosition;
      });

      const entries = debuts.length > 0 ? debuts : trackViews.slice(-20);

      return entries.map((entry: any, i: number) => {
        const meta = entry.chartEntryMetadata || {};
        const currentPos = meta.currentPosition || (i + 1);
        const videoId = entry.encryptedVideoId || '';
        const artistNames = (entry.artists || []).map((a: any) => a.name).filter(Boolean).join(', ');
        const thumbnails = entry.thumbnail?.thumbnails || [];
        const hqThumb = thumbnails.find((t: any) => t.width === 480) || thumbnails[thumbnails.length - 1] || {};

        return {
          videoId,
          title: entry.name || '',
          artist: artistNames || '',
          thumbnail: hqThumb.url || thumbnailUrl(videoId),
          viewCount: parseInt(entry.viewCount || '0', 10),
          rank: currentPos,
          trend: 'new',
          countryCode: cc,
        };
      });
    } catch (e) {
      logger.error(`getTopSongsTopDebuts error (${cc}): ${(e as Error).message}`);
      if (attempt < MAX_RETRIES) await delay(REQUEST_DELAY);
    }
  }
  return [];
}

/**
 * Get Top Artists by country
 * Source: artists[0].artistViews
 */
export async function getTopArtists(countryCode: string): Promise<ChartArtist[]> {
  const cc = countryCode.toUpperCase();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchChartsData(countryCode);
      const content = extractSectionContent(data);

      if (!content?.artists?.[0]?.artistViews) {
        if (attempt < MAX_RETRIES) { await delay(REQUEST_DELAY); continue; }
        return [];
      }

      const artistViews = content.artists[0].artistViews;
      return artistViews.map((entry: any, i: number) => {
        const meta = entry.chartEntryMetadata || {};
        const thumbnails = entry.thumbnail?.thumbnails || [];
        const thumb = thumbnails[0] || {};

        return {
          name: entry.name || '',
          channelId: entry.externalChannelId || '',
          thumbnail: thumb.url || '',
          rank: meta.currentPosition || (i + 1),
          countryCode: cc,
        };
      });
    } catch (e) {
      logger.error(`getTopArtists error (${cc}): ${(e as Error).message}`);
      if (attempt < MAX_RETRIES) await delay(REQUEST_DELAY);
    }
  }
  return [];
}
