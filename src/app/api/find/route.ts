import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "@/lib/rate-limiter";
import {
  getPoliticalLean,
  getFullSourceInfo,
  BALANCED_DOMAINS,
  LEFT_DOMAINS,
  CENTER_DOMAINS,
  RIGHT_DOMAINS,
  type SourceType,
  type OwnershipInfo,
  type FundingInfo,
  type PoliticalLean,
  type FullSourceInfo,
} from "@/lib/sourceData";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// =============================================================================
// SIMPLE IN-MEMORY CACHE (1 hour TTL, resets on cold start)
// Uses globalThis to persist across Next.js dev mode hot reloads
// =============================================================================
const globalForCache = globalThis as unknown as {
  searchCache: Map<string, { data: any; timestamp: number }>;
  braveCache: Map<string, { results: any[]; timestamp: number }>;
};
globalForCache.searchCache = globalForCache.searchCache || new Map();
globalForCache.braveCache = globalForCache.braveCache || new Map();

const searchCache = globalForCache.searchCache;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedResult(query: string): any | null {
  console.log('[Cache] Checking cache, size:', searchCache.size, 'key:', query.toLowerCase().substring(0, 40));
  const cached = searchCache.get(query.toLowerCase());
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    searchCache.delete(query.toLowerCase());
    console.log('[Cache] Expired:', query);
    return null;
  }

  console.log('[Cache] HIT:', query);
  return cached.data;
}

function setCachedResult(query: string, data: any): void {
  // Limit cache size to prevent memory issues
  if (searchCache.size > 500) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }

  searchCache.set(query.toLowerCase(), { data, timestamp: Date.now() });
  console.log('[Cache] SET:', query);
}

// =============================================================================
// BRAVE RESPONSE CACHE (15 min TTL) - Caches raw Brave API responses
// Reduces API calls for repeated/similar searches and helps during rate limits
// =============================================================================
const braveCache = globalForCache.braveCache;
const BRAVE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes (news freshness)
const BRAVE_CACHE_MAX_SIZE = 200;

function getBraveCached(query: string): any[] | null {
  const cached = braveCache.get(query.toLowerCase());
  if (!cached) return null;

  if (Date.now() - cached.timestamp > BRAVE_CACHE_TTL_MS) {
    braveCache.delete(query.toLowerCase());
    console.log('[BraveCache] Expired:', query.substring(0, 50));
    return null;
  }

  console.log('[BraveCache] HIT:', query.substring(0, 50), `(${cached.results.length} results)`);
  return cached.results;
}

function setBraveCached(query: string, results: any[]): void {
  // Limit cache size
  if (braveCache.size >= BRAVE_CACHE_MAX_SIZE) {
    const oldest = braveCache.keys().next().value;
    if (oldest) braveCache.delete(oldest);
  }

  braveCache.set(query.toLowerCase(), { results, timestamp: Date.now() });
  console.log('[BraveCache] SET:', query.substring(0, 50), `(${results.length} results)`);
}

// =============================================================================
// RSS FEED AGGREGATION - For domains poorly indexed by Brave (SR&ED E7/E8)
// Fetches RSS feeds in parallel, filters by keyword matching
// =============================================================================
const RSS_GAP_FEEDS = [
  { domain: 'dailywire.com', url: 'https://www.dailywire.com/feeds/rss.xml', lean: 'right' as const },
  { domain: 'breitbart.com', url: 'http://feeds.feedburner.com/breitbart', lean: 'right' as const },
  // E9b: Use politics-specific feeds to eliminate sports/entertainment noise
  { domain: 'nypost.com', url: 'https://nypost.com/news/feed/', lean: 'center-right' as const },
  { domain: 'washingtonexaminer.com', url: 'https://www.washingtonexaminer.com/feed', lean: 'center-right' as const },
];

// Domains with confirmed Brave Search coverage (from E7 testing)
// Note: washingtonexaminer.com moved to RSS_GAP_FEEDS for more reliable coverage
const INDEXED_RIGHT_DOMAINS = [
  'foxnews.com',
  'thefederalist.com',
  'washingtontimes.com',
  'townhall.com',
  'thefp.com',
  'nationalreview.com',
];

interface RSSItem {
  title: string;
  link: string;
  description: string;
  domain: string;
}

async function fetchRSSFeed(feedUrl: string, domain: string): Promise<RSSItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // E9b: Increased from 5s to 10s for slow feeds

  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'MirrorSource/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[RSS] ${domain} returned ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items: RSSItem[] = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    for (const itemXml of itemMatches) {
      const title = (itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || '';
      const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
      const desc = (itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1] || '';
      const content = (itemXml.match(/<content:encoded>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i) || [])[1] || '';

      // Clean HTML entities and tags
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&#\d+;/g, ' ').replace(/<[^>]*>/g, '').trim();
      const cleanDesc = (desc + ' ' + content).replace(/<[^>]*>/g, ' ').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

      if (cleanTitle && link) {
        items.push({
          title: cleanTitle,
          link: link.trim(),
          description: cleanDesc.substring(0, 500),
          domain,
        });
      }
    }

    return items;
  } catch (error: any) {
    clearTimeout(timeout);
    console.log(`[RSS] ${domain} fetch failed:`, error.message);
    return [];
  }
}

function matchRSSByKeywords(items: RSSItem[], keywords: string[], debug = false): RSSItem[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once', 'its', 'about', 'after', 'says', 'new', 'into', 'over']);

  // Filter to meaningful keywords
  const meaningfulKeywords = keywords
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length > 2 && !stopWords.has(k));

  console.log(`[RSS-DEBUG] Meaningful keywords (${meaningfulKeywords.length}): ${meaningfulKeywords.join(', ')}`);

  if (meaningfulKeywords.length === 0) return [];

  const matches: { item: RSSItem; score: number; matchedKws: string[] }[] = [];

  // Group items by domain for logging
  const itemsByDomain: Record<string, RSSItem[]> = {};
  for (const item of items) {
    if (!itemsByDomain[item.domain]) itemsByDomain[item.domain] = [];
    itemsByDomain[item.domain].push(item);
  }

  // Log first 3 items from each feed
  for (const [domain, domainItems] of Object.entries(itemsByDomain)) {
    console.log(`[RSS-DEBUG] ${domain} feed (${domainItems.length} items):`);
    domainItems.slice(0, 3).forEach((item, i) => {
      console.log(`[RSS-DEBUG]   ${i + 1}. "${item.title.substring(0, 60)}..."`);
    });
  }

  for (const item of items) {
    const searchText = (item.title + ' ' + item.description).toLowerCase();
    let score = 0;
    const matchedKws: string[] = [];

    for (const kw of meaningfulKeywords) {
      if (searchText.includes(kw)) {
        score++;
        matchedKws.push(kw);
      }
    }

    // E9b FIX: Require just 1 keyword match for RSS (we're already searching specific political feeds)
    // Previous threshold of 2+ was too strict - "Minnesota" vs "Minneapolis" caused failures
    const threshold = 1;

    // Log items that have at least 1 match (potential near-misses)
    if (score > 0) {
      const passedStr = score >= threshold ? '✓ PASS' : '✗ FAIL';
      console.log(`[RSS-DEBUG] ${item.domain}: score=${score}/${threshold} ${passedStr} matched=[${matchedKws.join(',')}] "${item.title.substring(0, 40)}..."`);
    }

    if (score >= threshold) {
      matches.push({ item, score, matchedKws });
    }
  }

  console.log(`[RSS-DEBUG] Total matches: ${matches.length}`);

  // E9b FIX: Return top 2 per DOMAIN to ensure diversity, not just top 5 overall
  // Previous bug: all top 5 were from one domain (dailywire), missing nypost/washingtonexaminer
  const matchesByDomain: Record<string, typeof matches> = {};
  for (const m of matches) {
    if (!matchesByDomain[m.item.domain]) matchesByDomain[m.item.domain] = [];
    matchesByDomain[m.item.domain].push(m);
  }

  const result: RSSItem[] = [];
  for (const [domain, domainMatches] of Object.entries(matchesByDomain)) {
    // Sort by score desc, take top 2 per domain
    const topTwo = domainMatches.sort((a, b) => b.score - a.score).slice(0, 2);
    console.log(`[RSS-DEBUG] ${domain}: returning ${topTwo.length} best matches`);
    result.push(...topTwo.map(m => m.item));
  }

  return result;
}

interface RSSFetchResult {
  matched: CSEResult[];
  fallback: CSEResult[];  // Top item from each feed, even if no keyword match
}

// =============================================================================
// GEMINI GROUNDED SEARCH - Supplementary source discovery via Google Search
// SR&ED E10: Gap-targeted search for outlets poorly indexed by Brave
// Symmetric gap-fill: triggers for BOTH right-side AND left-side gaps
// =============================================================================

// Right-leaning outlets to target with site: operators
const RIGHT_GROUNDED_SITES = [
  'dailywire.com',
  'washingtonexaminer.com',
  'freebeacon.com',
  'nationalreview.com',
  'thefederalist.com',
  'townhall.com',
  'redstate.com',
  'pjmedia.com',
];

// Left-leaning outlets to target with site: operators
const LEFT_GROUNDED_SITES = [
  'theintercept.com',
  'jacobin.com',
  'commondreams.org',
  'truthout.org',
  'currentaffairs.org',
  'prospect.org',      // The American Prospect
  'thenation.com',
  'motherjones.com',
];

interface GroundingChunk {
  web?: {
    uri: string;
    title?: string;
  };
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
}

type GapSide = 'right' | 'left';

async function geminiGroundedSearch(keywords: string, side: GapSide): Promise<CSEResult[]> {
  const sites = side === 'right' ? RIGHT_GROUNDED_SITES : LEFT_GROUNDED_SITES;
  const sideLabel = side === 'right' ? 'conservative/right-leaning' : 'progressive/left-leaning';

  console.log(`[GeminiGrounded] Starting ${side.toUpperCase()} gap-fill search for: "${keywords.substring(0, 60)}..."`);

  // Build site-specific query to target outlets
  const siteOperators = sites.slice(0, 5).map(d => `site:${d}`).join(' OR ');
  const searchQuery = `${keywords} (${siteOperators})`;

  try {
    const response: any = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `Find recent news articles about this topic from ${sideLabel} news outlets: ${searchQuery}

Return a brief summary of what you found. The grounding metadata will contain the actual URLs.`
        }]
      }],
      // Enable Google Search grounding via config
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Extract grounding metadata from response
    const candidate = response?.candidates?.[0];
    const groundingMetadata: GroundingMetadata = candidate?.groundingMetadata || {};
    const chunks = groundingMetadata.groundingChunks || [];

    console.log(`[GeminiGrounded] Received ${chunks.length} grounding chunks`);
    if (groundingMetadata.webSearchQueries?.length) {
      console.log(`[GeminiGrounded] Search queries used: ${groundingMetadata.webSearchQueries.join(', ')}`);
    }

    const results: CSEResult[] = [];
    const seenDomains = new Set<string>();

    for (const chunk of chunks) {
      if (!chunk.web?.uri) continue;

      let domain = '';
      try {
        domain = new URL(chunk.web.uri).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }

      // Skip duplicates
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);

      // Check if this is a known source or unknown (for logging)
      const sourceInfo = getSourceInfo(domain);
      if (!sourceInfo.displayName || sourceInfo.displayName === domain.toUpperCase()) {
        // Unknown source - log for database expansion
        console.log(`[GeminiGrounded] UNKNOWN SOURCE FOUND: ${domain} - ${chunk.web.title || 'No title'}`);
      }

      results.push({
        url: chunk.web.uri,
        title: chunk.web.title || '',
        snippet: '', // Grounding chunks don't include snippets
        domain,
        source: 'google' as const,
      });
    }

    console.log(`[GeminiGrounded] Returning ${results.length} unique results from domains: ${Array.from(seenDomains).join(', ')}`);
    return results;

  } catch (error: any) {
    console.error('[GeminiGrounded] Search failed:', error?.message);
    return [];
  }
}

async function fetchAndFilterRSS(keywords: string[]): Promise<RSSFetchResult> {
  const startTime = Date.now();
  console.log(`[RSS] Fetching ${RSS_GAP_FEEDS.length} gap feeds with keywords: ${keywords.slice(0, 5).join(', ')}...`);

  // Fetch all feeds in parallel
  const feedPromises = RSS_GAP_FEEDS.map(feed =>
    fetchRSSFeed(feed.url, feed.domain)
  );
  const feedResults = await Promise.all(feedPromises);

  // Collect fallbacks (most recent item from each feed) BEFORE flattening
  const fallbackItems: CSEResult[] = [];
  for (let i = 0; i < feedResults.length; i++) {
    const items = feedResults[i];
    if (items.length > 0) {
      fallbackItems.push({
        url: items[0].link,
        title: items[0].title,
        snippet: items[0].description,
        domain: items[0].domain,
        source: 'brave' as const,
      });
    }
  }

  // Flatten and match by keywords
  const allItems = feedResults.flat();
  const matched = matchRSSByKeywords(allItems, keywords);

  // Convert matched to CSEResult format
  const matchedResults: CSEResult[] = matched.map(item => ({
    url: item.link,
    title: item.title,
    snippet: item.description,
    domain: item.domain,
    source: 'brave' as const,
  }));

  console.log(`[RSS] Fetched ${allItems.length} items, matched ${matchedResults.length}, fallbacks ${fallbackItems.length} in ${Date.now() - startTime}ms`);
  if (matchedResults.length > 0) {
    console.log(`[RSS] Matched domains: ${matchedResults.map(r => r.domain).join(', ')}`);
  }

  return { matched: matchedResults, fallback: fallbackItems };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// --- Error Types ---
type ErrorType = 'INVALID_URL' | 'INVALID_KEYWORDS' | 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMITED' | 'API_ERROR' | 'NO_RESULTS';

interface AppError {
  type: ErrorType;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
}

function createError(type: ErrorType, details?: string): AppError {
  const errors: Record<ErrorType, Omit<AppError, 'type'>> = {
    INVALID_URL: {
      userMessage: 'Please enter a valid news article URL (must start with http:// or https://)',
      statusCode: 400,
      retryable: false,
    },
    INVALID_KEYWORDS: {
      userMessage: 'Please enter some keywords to search for.',
      statusCode: 400,
      retryable: false,
    },
    NETWORK_ERROR: {
      userMessage: 'Unable to connect. Please check your internet connection and try again.',
      statusCode: 503,
      retryable: true,
    },
    TIMEOUT: {
      userMessage: 'The search took too long. Please try again.',
      statusCode: 504,
      retryable: true,
    },
    RATE_LIMITED: {
      userMessage: details || 'You\'ve reached your daily limit. Try again tomorrow!',
      statusCode: 429,
      retryable: false,
    },
    API_ERROR: {
      userMessage: 'Search failed. Please try again.',
      statusCode: 500,
      retryable: true,
    },
    NO_RESULTS: {
      userMessage: 'No coverage found on trusted news sources. Try different keywords.',
      statusCode: 200,
      retryable: true,
    },
  };
  
  return { type, ...errors[type] };
}

// --- Paywall Detection ---
const PAYWALLED_DOMAINS = new Set([
  'wsj.com', 'nytimes.com', 'washingtonpost.com', 'ft.com', 
  'economist.com', 'bloomberg.com', 'theatlantic.com', 'newyorker.com',
  'barrons.com', 'thetimes.co.uk',
]);

function isPaywalledSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    return Array.from(PAYWALLED_DOMAINS).some(domain => hostname.includes(domain));
  } catch { return false; }
}

// Gap Fill Domains now imported from @/lib/sourceData
// Source classification types and data now imported from @/lib/sourceData
// getFullSourceInfo function is imported from @/lib/sourceData

// Helper alias for backward compatibility with existing code
const getSourceInfo = getFullSourceInfo;

// =============================================================================
// YOUTUBE CHANNEL ATTRIBUTION
// Maps known news YouTube channels to their parent outlet for proper bias/transparency
// =============================================================================
const YOUTUBE_CHANNEL_MAP: Record<string, string> = {
  // Major News Networks
  'nbc news': 'nbcnews.com',
  'cbs news': 'cbsnews.com',
  'abc news': 'abcnews.go.com',
  'cnn': 'cnn.com',
  'fox news': 'foxnews.com',
  'msnbc': 'msnbc.com',
  'fox business': 'foxbusiness.com',
  'cnbc': 'cnbc.com',
  'bloomberg': 'bloomberg.com',
  // Wire Services
  'associated press': 'apnews.com',
  'reuters': 'reuters.com',
  'afp': 'afp.com',
  // International
  'bbc news': 'bbc.com',
  'bbc': 'bbc.com',
  'sky news': 'news.sky.com',
  'al jazeera english': 'aljazeera.com',
  'al jazeera': 'aljazeera.com',
  'dw news': 'dw.com',
  'france 24': 'france24.com',
  'channel 4 news': 'channel4.com',
  'global news': 'globalnews.ca',
  'cbc news': 'cbc.ca',
  'ctv news': 'ctvnews.ca',
  // Print / Digital
  'the washington post': 'washingtonpost.com',
  'washington post': 'washingtonpost.com',
  'the new york times': 'nytimes.com',
  'new york times': 'nytimes.com',
  'wall street journal': 'wsj.com',
  'the guardian': 'theguardian.com',
  'the telegraph': 'telegraph.co.uk',
  'los angeles times': 'latimes.com',
  'usa today': 'usatoday.com',
  'politico': 'politico.com',
  'the hill': 'thehill.com',
  'axios': 'axios.com',
  'vox': 'vox.com',
  // Independent / Commentary
  'breaking points': 'breakingpoints.com',
  'the young turks': 'tyt.com',
  'daily wire': 'dailywire.com',
  'the daily wire': 'dailywire.com',
  'rebel news': 'rebelnews.com',
  'the free press': 'thefp.com',
  'real clear politics': 'realclearpolitics.com',
  'newsmax': 'newsmax.com',
  'newsnation': 'newsnationnow.com',
  'newsnation live': 'newsnationnow.com',
  'newsnation now': 'newsnationnow.com',
  // Canadian
  'true north': 'tnc.news',
  'true north centre': 'tnc.news',
  // PBS
  'pbs newshour': 'pbs.org',
  'pbs': 'pbs.org',
  // C-SPAN
  'c-span': 'c-span.org',
  'cspan': 'c-span.org',
};

// Extract YouTube channel name from video title
// Common formats: "Video Title | Channel Name", "Video Title - Channel Name"
function extractYouTubeChannel(title: string): string | null {
  if (!title) return null;

  // Try common separators: |, -, –, —
  const separators = [' | ', ' - ', ' – ', ' — '];
  for (const sep of separators) {
    const idx = title.lastIndexOf(sep);
    if (idx > 0) {
      let channel = title.substring(idx + sep.length).trim();
      // Strip common YouTube suffixes
      channel = channel.replace(/\s*-?\s*YouTube$/i, '').trim();
      // Validate it looks like a channel name (not too long, not too short)
      if (channel.length >= 2 && channel.length <= 50) {
        return channel;
      }
    }
  }
  return null;
}

// Look up YouTube channel to get actual source domain
function resolveYouTubeChannel(channelName: string): string | null {
  if (!channelName) return null;
  const normalized = channelName.toLowerCase().trim();
  return YOUTUBE_CHANNEL_MAP[normalized] || null;
}
// --- Fetch Article Title from URL ---
async function fetchArticleTitle(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    // Extract <title> tag content
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      // Clean up: remove site name suffixes like " - CNN" or " | BBC"
      let title = titleMatch[1].trim();
      title = title.replace(/\s*[\|\-–—]\s*[^|\-–—]+$/, '').trim();
      return title.length > 10 ? title : null;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// QUERY NEUTRALIZATION (H2 Fix) - Extract entities to overcome framing bias
// SR&ED E6: Article titles carry source-specific framing that biases right-side results
// =============================================================================
async function extractNeutralKeywords(title: string): Promise<string> {
  const prompt = `Extract the key factual entities from this news headline for a search query.

MUST INCLUDE:
- All organization acronyms (ICE, FBI, DHS, CDC, etc.)
- All location names (cities, states, countries)
- All person names
- Key event nouns (shooting, arrest, raid, etc.)

DO NOT INCLUDE:
- Adjectives (fatal, massive, controversial)
- Framing words (slams, destroys, admits)
- Common verbs (says, reports, claims)

Headline: "${title}"

Return 4-10 keywords separated by spaces. Be thorough - include ALL entities.

Keywords:`;

  try {
    const response: any = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let text: string | undefined;
    if (response?.response && typeof response.response.text === 'function') {
      text = response.response.text();
    } else if (Array.isArray(response?.candidates)) {
      text = response.candidates[0]?.content?.parts?.[0]?.text;
    }

    if (text && text.trim().length > 5) {
      const neutralized = text.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const wordCount = neutralized.split(/\s+/).length;

      // If extraction is too short, supplement with key terms from original title
      if (wordCount < 4) {
        // Extract key entities: known acronyms and longer nouns
        const knownEntities = new Set(['ice', 'fbi', 'dhs', 'cdc', 'doj', 'epa', 'cia', 'nsa', 'atf', 'dea', 'hhs', 'usda', 'trump', 'biden', 'shooting', 'raid', 'arrest', 'immigration', 'border', 'tariffs', 'iran', 'protest', 'minnesota', 'minneapolis', 'renee', 'good', 'portland', 'protests']);
        const stopWords = new Set(['says', 'say', 'cant', 'wont', 'after', 'they', 'that', 'this', 'with', 'from', 'have', 'will', 'would', 'could', 'their', 'about', 'been', 'being', 'were', 'fatal', 'jointly', 'work', 'access', 'evidence', 'officials']);
        const words = title.toLowerCase().split(/[\s\-]+/).filter(w => w.length > 0);
        console.log(`[QueryNeutral] Title words: ${words.slice(0, 15).join(', ')}`);
        const keyTerms = words.filter(w =>
          knownEntities.has(w) ||
          (w.length > 5 && !stopWords.has(w) && /^[a-z]+$/.test(w))
        );
        console.log(`[QueryNeutral] Key terms found: ${keyTerms.join(', ')}`);
        const supplemented = neutralized + ' ' + keyTerms.slice(0, 6).join(' ');
        console.log(`[QueryNeutral] Supplemented query: "${supplemented}"`);
        return supplemented.trim();
      }

      console.log(`[QueryNeutral] Original: "${title.substring(0, 60)}..."`);
      console.log(`[QueryNeutral] Extracted (${wordCount} words): "${neutralized}"`);
      return neutralized;
    }
  } catch (error) {
    console.log(`[QueryNeutral] Extraction failed, using original:`, error);
  }

  // Fallback: extract key terms from title (works with lowercase)
  const knownAcronyms = ['ice', 'fbi', 'dhs', 'cdc', 'doj', 'epa', 'cia', 'nsa', 'atf', 'dea', 'hhs', 'usda', 'trump', 'biden'];
  const stopWords = new Set(['says', 'say', 'cant', 'wont', 'after', 'they', 'that', 'this', 'with', 'from', 'have', 'will', 'would', 'could', 'their', 'about', 'been', 'being', 'were', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'got', 'him', 'let', 'put', 'too', 'use']);

  const words = title.toLowerCase().split(/\s+/);
  const keyTerms = words.filter(w =>
    (knownAcronyms.includes(w)) ||
    (w.length > 4 && !stopWords.has(w) && /^[a-z]+$/.test(w))
  );

  if (keyTerms.length >= 3) {
    const fallback = Array.from(new Set(keyTerms)).slice(0, 8).join(' ');
    console.log(`[QueryNeutral] Using fallback extraction: "${fallback}"`);
    return fallback;
  }

  return title;
}

// --- URL to Keywords Extraction ---
function extractKeywordsFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const segments = path.split('/').filter(s => s.length > 0);

    const noiseWords = new Set([
      'article', 'articles', 'news', 'story', 'stories', 'post', 'posts',
      'content', 'index', 'page', 'html', 'htm', 'php', 'aspx', 'amp',
      'live', 'video', 'watch', 'read', 'the', 'and', 'for', 'with',
      'from', 'that', 'this', 'have', 'has', 'are', 'was', 'were',
      'been', 'will', 'would', 'could', 'should', 'into', 'over',
      'after', 'before', 'id', 'newsfront'
    ]);

    // Find best slug
    let bestSlug = '';
    for (const segment of segments) {
      if (/^\d+$/.test(segment)) continue;
      if (/^\d{2,4}$/.test(segment)) continue;
      if (noiseWords.has(segment.toLowerCase())) continue;
      if (segment.toLowerCase() === 'us' || segment.toLowerCase() === 'uk') continue;

      if (segment.includes('-') && segment.length > bestSlug.length) {
        bestSlug = segment;
      }
    }

    if (!bestSlug) return null;

    const words = bestSlug
      .toLowerCase()
      .split(/[-_]/)
      .filter(w => w.length > 2)
      .filter(w => !noiseWords.has(w))
      .slice(0, 12);  // Increased from 6 to capture more keywords like ICE, FBI

    return words.length >= 2 ? words.join(' ') : null;
  } catch {
    return null;
  }
}

// --- Helpers ---
function extractJson(text: string): any {
  let cleaned = text.trim().replace(/^```[a-z]*\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

// --- URL Validation ---
function validateUrl(url: string): { valid: boolean; error?: AppError } {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: createError('INVALID_URL') };
  }
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: createError('INVALID_URL') };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: createError('INVALID_URL') };
  }
}

// =============================================================================
// STEP 1: THE EYES - Google Custom Search
// =============================================================================
interface CSEResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  source?: 'google' | 'brave';
}

// =============================================================================
// BRAVE SEARCH - Primary search engine with retry + exponential backoff + caching
// =============================================================================
async function searchWithBrave(query: string, maxRetries = 2): Promise<CSEResult[]> {
  if (!BRAVE_API_KEY) {
    console.log('[Brave] No API key configured, skipping');
    return [];
  }

  // Check cache first
  const cached = getBraveCached(query);
  if (cached) {
    return cached;
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20&search_lang=en&country=us&freshness=pw`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': BRAVE_API_KEY,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`[Brave] Rate limited (429). Attempt ${attempt + 1}/${maxRetries + 1}. Waiting ${waitMs}ms...`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue; // Retry
        }
        console.log('[Brave] Rate limit retries exhausted');
        return [];
      }

      if (!response.ok) {
        console.log('[Brave] API error:', response.status);
        return [];
      }

      const data = await response.json();

      const results: CSEResult[] = (data.web?.results || []).map((item: any) => {
        let domain = '';
        try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}

        return {
          url: item.url,
          title: item.title || '',
          snippet: item.description || '',
          domain,
          source: 'brave' as const,
        };
      });

      console.log('[Brave] Found', results.length, 'results');

      // Cache successful results
      if (results.length > 0) {
        setBraveCached(query, results);
      }

      return results;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[Brave] Search timeout');
      } else {
        console.error('[Brave] Search error:', error);
      }
      // Don't retry on timeout/network errors - just fail
      return [];
    }
  }

  return [];
}

// Filter out low-quality results using 50% keyword match ratio
function filterQualityResults(results: CSEResult[], searchQuery: string): CSEResult[] {
  if (!results || !Array.isArray(results)) return [];
  if (!searchQuery || typeof searchQuery !== 'string') return results;

  const stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'about', 'which', 'would', 'could', 'should', 'there', 'where', 'when', 'what', 'news', 'report', 'story'];

  const SPAM_KEYWORDS = [
    'crossword', 'puzzle', 'clue', 'wordle', 'answer key', 'cheat',
    'coupon', 'promo code', 'discount code',
    'essay', 'homework help',
    'lyrics', 'chords', 'tabs',
    'horoscope', 'zodiac',
    'recipe', 'calories'
  ];

  const SPAM_DOMAINS = [
    // Gaming guides & walkthroughs
    'tryhardguides.com', 'progameguides.com', 'gamerjournalist.com',
    'attackofthefanboy.com', 'gamerant.com', 'screenrant.com',
    // Gaming & entertainment (not news)
    'fandomwire.com', 'fandom.com', 'gosugamers.net', 'biztoc.com',
    'cbr.com', 'polygon.com', 'kotaku.com', 'ign.com', 'pcgamer.com',
    // Homework & reference
    'quizlet.com', 'brainly.com', 'chegg.com', 'coursehero.com',
    'genius.com', 'azlyrics.com',
    // Recipes & lifestyle
    'allrecipes.com', 'food.com', 'delish.com',
    // Shopping & social
    'pinterest.com', 'etsy.com', 'amazon.com',
    // Reference (not news)
    'wikipedia.org', 'en.wikipedia.org', 'britannica.com',
    'merriam-webster.com', 'investopedia.com'
  ];

  const queryWords = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !stopWords.includes(w));

  if (queryWords.length === 0) return results;

  const scored = results.map(result => {
    if (!result || !result.url) return { result, score: 0, passed: false };

    const urlLower = (result.url || '').toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    const snippetLower = (result.snippet || '').toLowerCase();

    // Block known spam domains
    if (SPAM_DOMAINS.some(d => urlLower.includes(d))) {
      console.log(`[Spam Filter] Blocked domain: ${result.url}`);
      return { result, score: 0, passed: false };
    }

    // Block spam content types by title/snippet keywords
    if (SPAM_KEYWORDS.some(k => titleLower.includes(k) || snippetLower.includes(k))) {
      console.log(`[Spam Filter] Blocked keyword in: ${result.title}`);
      return { result, score: 0, passed: false };
    }

    try {
      const path = new URL(result.url).pathname;
      if (path === '/' || path === '') return { result, score: 0, passed: false };
    } catch { return { result, score: 0, passed: false }; }

    // RSS results from gap feeds already passed keyword matching - be lenient
    const rssGapDomains = ['dailywire.com', 'breitbart.com', 'nypost.com', 'washingtonexaminer.com'];
    const isRSSResult = rssGapDomains.some(d => (result.domain || '').includes(d));
    if (isRSSResult) {
      // RSS results just need any keyword match to pass
      const text = ((result.title || '') + ' ' + (result.snippet || '')).toLowerCase();
      const hasAnyMatch = queryWords.some(w => text.includes(w));
      return { result, score: hasAnyMatch ? 10 : 0, passed: hasAnyMatch };
    }

    const text = ((result.title || '') + ' ' + (result.snippet || '')).toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (text.includes(word)) matches++;
    }

    const matchRatio = matches / queryWords.length;

    let passed = false;
    if (queryWords.length <= 2) {
      passed = matches >= 1;
    } else if (queryWords.length <= 4) {
      passed = matchRatio >= 0.5;
    } else {
      passed = matchRatio >= 0.4;
    }

    // Only require title match for short queries (2-3 words)
    // Longer queries from article titles often don't match alternative headlines
    const titleHasMatch = queryWords.some(w => titleLower.includes(w));
    if (queryWords.length >= 2 && queryWords.length <= 3 && !titleHasMatch) {
      passed = false;
    }

    return { result, score: matches, passed };
  });

  const passing = scored
    .filter(s => s.passed)
    .sort((a, b) => b.score - a.score)
    .map(s => s.result);

  console.log(`[Quality Filter] Query: "${searchQuery}" | Words: ${queryWords.length} | In: ${results.length} -> Out: ${passing.length}`);

  return passing;
}

// Diversify results by source type using round-robin
function diversifyResults(results: CSEResult[], maxResults: number = 15): CSEResult[] {
  // Defensive null checks
  if (!results || !Array.isArray(results) || results.length === 0) return [];

  // Group by political lean instead of just type
  const byLean: Record<string, CSEResult[]> = {
    'right': [],
    'center-right': [],
    'center': [],
    'center-left': [],
    'left': [],
    'unknown': []
  };

  for (const result of results) {
    if (!result || !result.domain) continue;
    const lean = getPoliticalLean(result.domain);
    byLean[lean].push(result);
  }

  // Round-robin from each lean category across the political spectrum
  const diverse: CSEResult[] = [];
  const leans = ['left', 'center-left', 'center', 'center-right', 'right', 'unknown'];
  let added = true;
  let round = 0;

  while (added && diverse.length < maxResults) {
    added = false;
    for (const lean of leans) {
      if (byLean[lean][round]) {
        // Avoid duplicates by domain
        if (!diverse.find(d => d.domain === byLean[lean][round].domain)) {
          diverse.push(byLean[lean][round]);
          added = true;
        }
        if (diverse.length >= maxResults) break;
      }
    }
    round++;
  }

  // Log lean breakdown for debugging
  console.log('[CSE] Lean breakdown:', {
    right: diverse.filter(r => getPoliticalLean(r.domain) === 'right').length,
    centerRight: diverse.filter(r => getPoliticalLean(r.domain) === 'center-right').length,
    center: diverse.filter(r => getPoliticalLean(r.domain) === 'center').length,
    centerLeft: diverse.filter(r => getPoliticalLean(r.domain) === 'center-left').length,
    left: diverse.filter(r => getPoliticalLean(r.domain) === 'left').length,
  });

  return diverse;
}

// =============================================================================
// STEP 2: THE BRAIN - Gemini Synthesis
// =============================================================================
interface CommonGroundFact {
  label: string;
  value: string;
}

interface KeyDifference {
  label: string;
  value: string;
}

// NEW: Story Provenance tracking - identifies where news stories originate
interface ProvenanceInfo {
  origin: 'wire_service' | 'single_outlet' | 'press_release' | 'unknown';
  originSource: string | null;
  originConfidence: 'high' | 'medium' | 'low';
  originalReporting: string[];
  aggregators: string[];
  explanation: string;
}

// NEW: Narrative Analysis - tone and coverage type
type NarrativeType = 'policy' | 'horse_race' | 'culture_war' | 'scandal' | 'human_interest';

interface NarrativeAnalysis {
  emotionalIntensity: number; // 1-10
  narrativeType: NarrativeType;
  isClickbait: boolean;
}

// Author info for per-source bylines
interface AuthorInfo {
  name: string;
  isStaff: boolean;
}

interface IntelBrief {
  summary: string;
  commonGround: CommonGroundFact[] | string;  // Array preferred, string for backward compatibility
  keyDifferences: KeyDifference[] | string;   // Array for differences, string for consensus message
  provenance?: ProvenanceInfo;  // Story origin tracking
  narrative?: NarrativeAnalysis;  // NEW: Narrative tone analysis
  authors?: Record<string, AuthorInfo>;  // NEW: Per-source author bylines
}

async function synthesizeWithGemini(searchResults: CSEResult[], originalQuery: string, timeoutMs: number = 18000): Promise<IntelBrief | null> {
  // Limit sources to prevent timeout - use first 10 for synthesis
  const sourcesForSynthesis = searchResults.slice(0, 10);
  console.log(`[Gemini] Using ${sourcesForSynthesis.length} of ${searchResults.length} sources for synthesis`);

  const context = sourcesForSynthesis.map((r, i) =>
    `[Source ${i + 1}: ${r.domain}]\nTitle: ${r.title}\nSnippet: ${r.snippet}`
  ).join('\n\n');

  const prompt = `You are a news intelligence analyst. Based ONLY on the sources provided below, write a brief analysis.

CRITICAL: First, identify the PRIMARY EVENT the user is researching. Then ONLY analyze coverage of that specific event. Ignore tangential events.

STORY QUERY: "${originalQuery}"

SOURCES:
${context}

RESPOND IN JSON FORMAT:
{
  "summary": "3-4 sentences summarizing THE PRIMARY EVENT ONLY. Grade 6-8 reading level. Bold only the KEY TAKEAWAY of each sentence using **bold** syntax. Max 4 bold phrases. Do NOT include unrelated historical events.",
  "commonGround": [{"label": "Short category", "value": "What sources agree on ABOUT THE PRIMARY EVENT"}, ...],
  "keyDifferences": [{"label": "Topic", "value": "How sources differ ON THE PRIMARY EVENT"}, ...] OR "Sources present a consistent narrative on this story.",
  "provenance": {
    "origin": "wire_service" | "single_outlet" | "press_release" | "unknown",
    "originSource": "AP" | "Reuters" | "Wall Street Journal" | null,
    "originConfidence": "high" | "medium" | "low",
    "originalReporting": ["outlet1", "outlet2"],
    "aggregators": ["outlet3", "outlet4"],
    "explanation": "Brief explanation of how you determined origin"
  },
  "narrative": {
    "emotionalIntensity": <number 1-10>,
    "narrativeType": "policy" | "horse_race" | "culture_war" | "scandal" | "human_interest",
    "isClickbait": <boolean>
  }
}

RULES:
- ABSOLUTE PROHIBITION: Never write "(Source X)", "[Source X]", "Source 1", or any variation. No source numbers anywhere. Use Publisher Names ONLY (e.g., "Reuters", "CNN", "Fox News").
- ONLY use information from the sources above.
- TIME AWARENESS: If sources differ because some are older (e.g., "Manhunt underway" vs "Suspect caught"), trust the latest status. Do NOT list outdated early reports as a "Key Difference". Only list genuine conflicts where sources disagree on the *same* facts at the *same* time.
- CITATION STYLE: Refer to sources by their Publisher Name as written in the text (e.g., "**Reuters**", "**CNN**", "**Al Jazeera**").
- Bold publisher names in keyDifferences using **markdown**.
- commonGround: 2-4 fact objects.
- keyDifferences: Look for differences in FACTS, FRAMING, and TONE across sources. Do NOT just check factual agreement.
  * Factual difference: Source A says "9 killed", Source B says "15 killed" → KEY DIFFERENCE
  * Framing difference: Source A says "Politician defends policy", Source B says "Politician under fire for policy" → KEY DIFFERENCE
  * Tone difference: Source A uses "crisis" framing, Source B uses "routine" framing → KEY DIFFERENCE
  * Omission difference: Source A mentions the cost, Source B omits it entirely → KEY DIFFERENCE
  Return 1-3 difference objects highlighting the most significant divergences. Keep each "value" under 25 words.
  ONLY return a consensus string if tone, framing, AND facts are nearly identical across ALL sources. This should be rare.
- CONSENSUS RULE: Only return a consensus string when there are genuinely NO meaningful differences in framing or tone. If you identified ANY keyDifferences, do NOT also claim consensus. Default to finding differences - consensus should be rare.
- Use simple language
- Be concise - prioritize speed over length.

STORY PROVENANCE ANALYSIS:
Analyze the sources to determine where this story originated:
1. WIRE SERVICE: Is this wire service content? Look for verbatim text across multiple sources, "(AP)", "(Reuters)", "(AFP)" markers, or identical quotes/phrasing.
2. SINGLE OUTLET: Can you identify which outlet broke the story? Look for "first reported by", "exclusive", unique interviews, or original investigation.
3. PRESS RELEASE: Is this from a press release? Look for PR Newswire, Business Wire, official statements, or corporate newsroom language.
4. ORIGINAL vs AGGREGATOR: Which outlets have ORIGINAL reporting (unique quotes, interviews, on-the-ground coverage)? Which are AGGREGATING (rewriting wire copy, no original content)?

Set originConfidence based on evidence strength:
- "high": Clear wire markers, explicit attribution, or obvious original scoop
- "medium": Strong indicators but not definitive
- "low": Best guess based on limited evidence

NARRATIVE ANALYSIS:
Analyze the tone and type of coverage:

1. EMOTIONAL INTENSITY (1-10):
   - 1-3: Neutral, factual, measured ("reported," "announced," "said")
   - 4-6: Some perspective, moderate language ("claimed," "argued," "warned")
   - 7-10: Charged, inflammatory ("slammed," "destroyed," "catastrophic")

2. NARRATIVE TYPE (pick the dominant one):
   - "policy": Substantive focus on legislation, regulations, policy details
   - "horse_race": Focus on polls, strategy, who's winning/losing, optics
   - "culture_war": Focus on identity, values, tribal divisions
   - "scandal": Focus on wrongdoing, accusations, investigations
   - "human_interest": Focus on personal stories, emotional impact

3. CLICKBAIT CHECK:
   - true if: Question headlines, "BREAKING", superlatives, emotional hooks
   - false if: Straightforward factual headlines

AUTHOR/BYLINE EXTRACTION:
For each source, look for author bylines in the title or snippet:
- Common patterns: "By John Smith", "John Smith reports", author names at end of snippets
- If byline is "Staff", "Staff Report", "AP", "Reuters", "AFP", or similar wire/staff attribution, set isStaff: true
- If a real person's name is found, set isStaff: false
- If no byline is detectable, omit that source from the authors object

Add to your JSON response:
"authors": {
  "domain.com": {"name": "Author Name", "isStaff": false},
  "reuters.com": {"name": "Reuters Staff", "isStaff": true}
}

FINAL CHECK: Before responding, verify you have not included any "(Source" or "Source 1" text anywhere in your response.`.trim();

  // Create timeout promise
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.log(`[Gemini] Request timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
  });

  try {
    // Race between Gemini call and timeout
    const geminiPromise = genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const geminiResponse: any = await Promise.race([geminiPromise, timeoutPromise]);

    // Check if timeout won
    if (geminiResponse === null) {
      return null; // Timeout - caller handles fallback
    }

    let text: string | undefined;
    if (geminiResponse?.response && typeof geminiResponse.response.text === 'function') {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
    }

    if (!text) {
      return {
        summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
        commonGround: [],
        keyDifferences: '',
      };
    }

    const parsed = extractJson(text);
    if (!parsed) {
      return {
        summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
        commonGround: [],
        keyDifferences: '',
      };
    }

    // Handle commonGround as array or string for backward compatibility
    let commonGround: CommonGroundFact[] | string = [];
    if (Array.isArray(parsed.commonGround)) {
      commonGround = parsed.commonGround.filter((f: any) => f.label && f.value);
    } else if (typeof parsed.commonGround === 'string') {
      commonGround = parsed.commonGround.trim();
    }

    // Handle keyDifferences as array (conflicts) or string (consensus)
    let keyDifferences: KeyDifference[] | string = '';
    if (Array.isArray(parsed.keyDifferences)) {
      keyDifferences = parsed.keyDifferences.filter((f: any) => f.label && f.value);
    } else if (typeof parsed.keyDifferences === 'string') {
      keyDifferences = parsed.keyDifferences.trim();
    }

    // Parse provenance data (handle missing/malformed gracefully)
    let provenance: ProvenanceInfo | undefined;
    if (parsed.provenance && typeof parsed.provenance === 'object') {
      const p = parsed.provenance;
      // Validate origin type
      const validOrigins = ['wire_service', 'single_outlet', 'press_release', 'unknown'];
      const origin = validOrigins.includes(p.origin) ? p.origin : 'unknown';

      // Validate confidence level
      const validConfidence = ['high', 'medium', 'low'];
      const confidence = validConfidence.includes(p.originConfidence) ? p.originConfidence : 'low';

      provenance = {
        origin: origin as ProvenanceInfo['origin'],
        originSource: typeof p.originSource === 'string' ? p.originSource : null,
        originConfidence: confidence as ProvenanceInfo['originConfidence'],
        originalReporting: Array.isArray(p.originalReporting) ? p.originalReporting.filter((s: any) => typeof s === 'string') : [],
        aggregators: Array.isArray(p.aggregators) ? p.aggregators.filter((s: any) => typeof s === 'string') : [],
        explanation: typeof p.explanation === 'string' ? p.explanation.trim() : 'Unable to determine story origin.',
      };
      console.log('[Gemini] Provenance detected:', provenance.origin, '->', provenance.originSource || 'unknown source');
    }

    // Parse narrative analysis (handle missing/malformed gracefully)
    let narrative: NarrativeAnalysis | undefined;
    if (parsed.narrative && typeof parsed.narrative === 'object') {
      const n = parsed.narrative;
      // Validate narrative type
      const validTypes: NarrativeType[] = ['policy', 'horse_race', 'culture_war', 'scandal', 'human_interest'];
      const narrativeType = validTypes.includes(n.narrativeType) ? n.narrativeType : 'policy';

      // Clamp intensity to 1-10
      const intensity = typeof n.emotionalIntensity === 'number'
        ? Math.max(1, Math.min(10, Math.round(n.emotionalIntensity)))
        : 5;

      narrative = {
        emotionalIntensity: intensity,
        narrativeType: narrativeType as NarrativeType,
        isClickbait: n.isClickbait === true,
      };
      console.log('[Gemini] Narrative detected:', narrative.narrativeType, `intensity=${narrative.emotionalIntensity}`, narrative.isClickbait ? 'CLICKBAIT' : '');
    }

    // Parse author bylines (handle missing/malformed gracefully)
    let authors: Record<string, AuthorInfo> | undefined;
    if (parsed.authors && typeof parsed.authors === 'object') {
      authors = {};
      for (const [domain, authorData] of Object.entries(parsed.authors)) {
        if (authorData && typeof authorData === 'object') {
          const a = authorData as { name?: string; isStaff?: boolean };
          if (typeof a.name === 'string' && a.name.trim()) {
            authors[domain] = {
              name: a.name.trim(),
              isStaff: a.isStaff === true,
            };
          }
        }
      }
      console.log('[Gemini] Authors detected:', Object.keys(authors).length, 'sources with bylines');
    }

    return {
      summary: (parsed.summary || '').trim(),
      commonGround,
      keyDifferences,
      provenance,
      narrative,
      authors,
    };
  } catch (error: any) {
    console.error('[Gemini] Synthesis error:', error?.message);
    return null; // Return null so caller can handle fallback
  }
}

// =============================================================================
// STEP 3: PROCESS RESULTS - Apply badges, transparency, and sort
// =============================================================================
interface ProcessedSource {
  uri: string;
  title: string;
  snippet: string;
  displayName: string;
  sourceDomain: string;
  sourceType: SourceType;
  countryCode: string;
  isSyndicated: boolean;
  // NEW: Transparency data
  ownership?: OwnershipInfo;
  funding?: FundingInfo;
  // Political lean for comparison feature
  politicalLean?: PoliticalLean;
  // Author Intelligence
  author?: AuthorInfo;
  // Independent/creator-driven media
  isIndependent?: boolean;
}

// Detect opinion-laden or characterization language in search query
function detectQueryBias(query: string): string | null {
  if (!query) return null;

  const opinionPatterns = [
    // Negative characterizations
    /\b(maniac|lunatic|crazy|insane|unhinged|deranged|mad|nuts)\b/i,
    /\b(liar|fraud|criminal|corrupt|evil|dangerous|extremist)\b/i,
    /\b(failed|failing|disaster|catastrophe|worst|terrible)\b/i,
    // Positive characterizations
    /\b(genius|brilliant|amazing|best|greatest|hero)\b/i,
    // Clickbait framing words
    /\b(slams?|destroys?|obliterates?|owns?|wrecks?|eviscerates?)\b/i,
    /\b(exposed|busted|caught|admits?|confesses?)\b/i,
    /\b(humiliates?|embarrasses?|shocks?|stuns?)\b/i,
  ];

  for (const pattern of opinionPatterns) {
    if (pattern.test(query)) {
      console.log(`[QueryBias] Detected opinion language in query: "${query}"`);
      return 'This search includes opinion language which may limit perspective diversity.';
    }
  }
  return null;
}

// Analyze political diversity of results
// inputUrl: the user's input URL (if provided) - included in coverage calculation
function analyzePoliticalDiversity(
  results: ProcessedSource[],
  _gapFillInfo?: unknown, // Deprecated - kept for backward compatibility
  inputUrl?: string
): {
  isBalanced: boolean;
  leftCount: number;
  centerCount: number;
  rightCount: number;
  warning: string | null;
} {
  let leftCount = 0;    // left + center-left
  let centerCount = 0;  // center
  let rightCount = 0;   // right + center-right

  console.log(`[Diversity] Analyzing ${results.length} sources...`);

  // Include the INPUT source in the count (the URL the user pasted)
  let inputLean: PoliticalLean | undefined;
  if (inputUrl) {
    inputLean = getPoliticalLean(inputUrl);
    console.log(`[Diversity] Input source: ${inputUrl} -> lean: ${inputLean}`);
    if (inputLean === 'left' || inputLean === 'center-left') leftCount++;
    else if (inputLean === 'right' || inputLean === 'center-right') rightCount++;
    else centerCount++;
  }

  for (const result of results) {
    const domain = result.sourceDomain || '';
    const lean = getPoliticalLean(domain);

    console.log(`[Diversity] ${domain} -> lean: ${lean}`);

    if (lean === 'left' || lean === 'center-left') leftCount++;
    else if (lean === 'right' || lean === 'center-right') rightCount++;
    else centerCount++;
  }

  // Total includes input source if provided
  const total = results.length + (inputUrl ? 1 : 0);
  if (total === 0) return { isBalanced: true, leftCount: 0, centerCount: 0, rightCount: 0, warning: null };

  const leftPct = leftCount / total;
  const rightPct = rightCount / total;

  console.log(`[Diversity] Counts - Left: ${leftCount} (${(leftPct * 100).toFixed(0)}%), Center: ${centerCount}, Right: ${rightCount} (${(rightPct * 100).toFixed(0)}%)${inputUrl ? ' (includes input source)' : ''}`);

  // Check for imbalance (more than 60% from one side)
  let warning: string | null = null;
  let isBalanced = true;

  if (leftPct > 0.6 && rightCount < 2) {
    isBalanced = false;
    warning = `Sources lean left (${leftCount}/${total}). Right-leaning perspectives may be underrepresented.`;
    console.log(`[Diversity] WARNING: ${warning}`);
  } else if (rightPct > 0.6 && leftCount < 2) {
    isBalanced = false;
    warning = `Sources lean right (${rightCount}/${total}). Left-leaning perspectives may be underrepresented.`;
    console.log(`[Diversity] WARNING: ${warning}`);
  } else {
    console.log(`[Diversity] Sources are balanced - no warning`);
  }

  return { isBalanced, leftCount, centerCount, rightCount, warning };
}

function processSearchResults(cseResults: CSEResult[], authors?: Record<string, AuthorInfo>): ProcessedSource[] {
  const seen = new Set<string>();
  const processed: ProcessedSource[] = [];

  for (const result of cseResults) {
    if (!result.domain || seen.has(result.domain)) continue;

    let effectiveDomain = result.domain;
    let effectiveDisplayName: string | undefined;

    // YOUTUBE CHANNEL ATTRIBUTION
    // If this is a YouTube result, try to resolve the actual news channel
    if (result.domain === 'youtube.com' || result.domain === 'www.youtube.com') {
      const channelName = extractYouTubeChannel(result.title);
      if (channelName) {
        const resolvedDomain = resolveYouTubeChannel(channelName);
        if (resolvedDomain) {
          // Skip if we already have this source from their main domain
          if (seen.has(resolvedDomain)) {
            console.log(`[YouTube] Skipping duplicate - already have ${resolvedDomain}`);
            continue;
          }
          effectiveDomain = resolvedDomain;
          console.log(`[YouTube] Resolved "${channelName}" -> ${resolvedDomain}`);
        } else {
          // Unknown channel - use channel name as display name
          effectiveDisplayName = channelName.toUpperCase();
          console.log(`[YouTube] Unknown channel: "${channelName}" - keeping as YouTube`);
        }
      }
    }

    seen.add(effectiveDomain);
    const sourceInfo = getSourceInfo(effectiveDomain);

    // Find author for this domain (check both with and without www.)
    const domainVariants = [effectiveDomain, effectiveDomain.replace('www.', ''), 'www.' + effectiveDomain];
    let author: AuthorInfo | undefined;
    if (authors) {
      for (const variant of domainVariants) {
        if (authors[variant]) {
          author = authors[variant];
          break;
        }
      }
    }

    processed.push({
      uri: result.url,
      title: result.title,
      snippet: result.snippet || '',
      displayName: effectiveDisplayName || sourceInfo.displayName,
      sourceDomain: effectiveDomain,
      sourceType: sourceInfo.type,
      countryCode: sourceInfo.countryCode,
      isSyndicated: false,
      // Include transparency data
      ownership: sourceInfo.ownership,
      funding: sourceInfo.funding,
      politicalLean: sourceInfo.lean,
      isIndependent: sourceInfo.isIndependent,
      // Author Intelligence
      author,
    });
  }

  // Sort by source type priority
  const typePriority: Record<SourceType, number> = {
    'wire': 0,
    'specialized': 1,
    'national': 2,
    'international': 3,
    'public': 4,
    'public-trust': 4,
    'nonprofit': 5,
    'analysis': 6,
    'corporate': 7,
    'syndication': 8,
    'magazine': 9,
    'local': 10,
    'state': 11,
    'state-funded': 11,
    'reference': 12,
    'platform': 13,
  };

  processed.sort((a, b) => typePriority[a.sourceType] - typePriority[b.sourceType]);
  return processed;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limit Check
    const limitCheck = await checkRateLimit(req);
    if (!limitCheck.success) {
      const error = createError('RATE_LIMITED', `Daily limit reached. You have 0/${limitCheck.info.limit} remaining.`);
      return NextResponse.json(
        { error: error.userMessage, errorType: error.type, retryable: error.retryable },
        { status: error.statusCode, headers: corsHeaders }
      );
    }

    // 2. Parse Request Body
    let body: any;
    try { body = await req.json(); } catch { 
      return NextResponse.json(
        { error: 'Invalid request body', errorType: 'INVALID_URL', retryable: false },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Determine search query
    const hasKeywords = body.keywords && typeof body.keywords === 'string' && body.keywords.trim();
    const hasUrl = body.url && typeof body.url === 'string' && body.url.trim();

    if (!hasKeywords && !hasUrl) {
      const error = createError('INVALID_URL');
      return NextResponse.json(
        { error: error.userMessage, errorType: error.type, retryable: error.retryable },
        { status: error.statusCode, headers: corsHeaders }
      );
    }

    let searchQuery: string;
    let isPaywalled = false;

    if (hasKeywords) {
      searchQuery = body.keywords.trim();
      if (searchQuery.length < 3) {
        return NextResponse.json(
          { error: 'Please enter at least a few keywords to search.', errorType: 'INVALID_KEYWORDS', retryable: false },
          { status: 400, headers: corsHeaders }
        );
      }
      // Use keywords directly - no quote wrapping
    } else {
      const validation = validateUrl(body.url);
      if (!validation.valid && validation.error) {
        return NextResponse.json(
          { error: validation.error.userMessage, errorType: validation.error.type, retryable: validation.error.retryable },
          { status: validation.error.statusCode, headers: corsHeaders }
        );
      }

      const url = body.url.trim();
      isPaywalled = isPaywalledSource(url);

      // PRIORITY 1: Try to fetch the actual article title
      console.log(`[Query] Attempting to fetch article title from: ${url}`);
      const articleTitle = await fetchArticleTitle(url);

      if (articleTitle) {
        console.log(`[Query] Got article title: "${articleTitle}"`);
        // Use the title directly - no quote wrapping
        searchQuery = articleTitle;
      } else {
        // FALLBACK: Extract from URL slug
        console.log(`[Query] Title fetch failed, falling back to URL extraction`);
        const extractedKeywords = extractKeywordsFromUrl(url);
        console.log('[DEBUG] URL extraction result:', extractedKeywords);
        console.log('[DEBUG] extractedKeywords type:', typeof extractedKeywords);
        console.log('[DEBUG] extractedKeywords length:', extractedKeywords?.length);

        if (!extractedKeywords) {
          console.log('[DEBUG] EARLY EXIT: extractedKeywords is null/empty');
          return NextResponse.json({
            summary: null,
            commonGround: null,
            keyDifferences: null,
            alternatives: [],
            isPaywalled,
            needsKeywords: true,
            error: 'This link doesn\'t contain readable keywords. Please enter 3-5 key words from the story.',
            errorType: 'NEEDS_KEYWORDS',
            retryable: false,
          }, { headers: corsHeaders });
        }

        // Use extracted keywords directly - no quote wrapping
        searchQuery = extractedKeywords;
      }
    }

    // Final safeguard: ensure searchQuery is valid
    console.log('[DEBUG] Final safeguard check - searchQuery:', searchQuery);
    console.log('[DEBUG] Final safeguard - type:', typeof searchQuery, 'length:', searchQuery?.trim()?.length);
    if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length < 2) {
      console.log('[DEBUG] EARLY EXIT: searchQuery invalid at final safeguard');
      return NextResponse.json({
        summary: null,
        commonGround: null,
        keyDifferences: null,
        alternatives: [],
        isPaywalled,
        needsKeywords: true,
        error: 'Could not generate a valid search query. Please enter keywords manually.',
        errorType: 'NEEDS_KEYWORDS',
        retryable: false,
      }, { headers: corsHeaders });
    }

    // 4. Check cache BEFORE incrementing usage (cache hits don't cost API calls)
    // Support cache bypass for testing: { "nocache": true } in request body
    const bypassCache = body.nocache === true;
    if (bypassCache) {
      console.log('[Cache] BYPASS requested - skipping cache lookup');
    }

    if (!bypassCache) {
      const cachedResult = getCachedResult(searchQuery);
      if (cachedResult) {
        console.log('[Cache] Returning cached result for:', searchQuery);
        return NextResponse.json({ ...cachedResult, cached: true }, { headers: corsHeaders });
      }
    }

    // 5. Increment Usage (only for non-cached requests)
    const { info: usageInfo, cookieValue } = await incrementUsage(req);

    // Gap-fill status tracking for API response observability
    const gapFillStatus = {
      left: {
        triggered: false,
        reason: 'adequate' as string,
        sourceCount: 0,
        resultsFound: 0,
        domains: [] as string[],
      },
      right: {
        triggered: false,
        reason: 'adequate' as string,
        sourceCount: 0,
        resultsFound: 0,
        domains: [] as string[],
      },
    };

    // ==========================================================================
    // QUAD-QUERY HYBRID SEARCH: Brave + RSS for complete spectrum coverage
    // SR&ED E5: Triple-query addresses Brave API systematic bias (H3)
    // SR&ED E6: Neutral query for right-side overcomes framing bias (H2)
    // SR&ED E8: RSS feeds for gap domains (dailywire, breitbart, nypost) not indexed by Brave
    // ==========================================================================

    const leftFilters = LEFT_DOMAINS.map(d => `site:${d}`).join(' OR ');
    const centerFilters = CENTER_DOMAINS.map(d => `site:${d}`).join(' OR ');
    // Use only confirmed-indexed domains for Brave right-side query (E7 finding)
    const indexedRightFilters = INDEXED_RIGHT_DOMAINS.map(d => `site:${d}`).join(' OR ');

    // H2 FIX: Extract neutral keywords for right-side query to overcome framing mismatch
    // Left-framed titles ("fatal ICE shooting") don't match right-framed coverage ("ICE crackdown")
    const neutralQuery = await extractNeutralKeywords(searchQuery);
    const neutralKeywords = neutralQuery.split(/\s+/).filter(k => k.length > 2);

    console.log(`[QuadQuery] Running 4 parallel queries (3 Brave + 1 RSS)...`);
    console.log(`[QuadQuery] Left/CL: ${LEFT_DOMAINS.length} domains, Center: ${CENTER_DOMAINS.length} domains`);
    console.log(`[QuadQuery] Indexed Right: ${INDEXED_RIGHT_DOMAINS.length} domains, RSS Gap: ${RSS_GAP_FEEDS.length} feeds`);
    console.log(`[QuadQuery] Original query: "${searchQuery.substring(0, 60)}..."`);
    console.log(`[QuadQuery] Neutral query: "${neutralQuery.substring(0, 60)}..."`);

    // Run all 4 queries in parallel:
    // - LEFT/CENTER: Brave with original query (their framing matches)
    // - INDEXED_RIGHT: Brave with neutral query (for fox, federalist, etc.)
    // - RSS_GAP: Direct RSS fetch for dailywire, breitbart, nypost (not in Brave index)
    const [leftResults, centerResults, rightResults, rssData] = await Promise.all([
      searchWithBrave(`${searchQuery} (${leftFilters})`),
      searchWithBrave(`${searchQuery} (${centerFilters})`),
      searchWithBrave(`${neutralQuery} (${indexedRightFilters})`),
      fetchAndFilterRSS(neutralKeywords),
    ]);

    // E9: Force RSS fallback when RSS keyword matching is weak
    // Even if Brave returns results, they often get filtered out
    // So we trigger fallback based on RSS match count, not Brave count
    let rssResults = rssData.matched;

    // If RSS matched < 2 unique domains, add fallback articles
    const matchedDomains = new Set(rssResults.map(r => r.domain));
    if (matchedDomains.size < 2) {
      console.log(`[RSS] Only ${matchedDomains.size} unique domains matched, adding fallbacks`);
      // Add fallbacks that aren't already in matched (by domain)
      const fallbacksToAdd = rssData.fallback.filter(f => !matchedDomains.has(f.domain));
      rssResults = [...rssResults, ...fallbacksToAdd];
      console.log(`[RSS] Added ${fallbacksToAdd.length} fallback articles: ${fallbacksToAdd.map(f => f.domain).join(', ')}`);
    }

    console.log(`[QuadQuery] Results - Left/CL: ${leftResults.length}, Center: ${centerResults.length}, Indexed Right: ${rightResults.length}, RSS: ${rssResults.length}`);

    // Merge all results (Brave + RSS)
    const allResults = [...leftResults, ...centerResults, ...rightResults, ...rssResults];

    // Deduplicate by domain (RSS results may overlap with Brave)
    const seenDomains = new Set<string>();
    let qualityFiltered = allResults.filter(result => {
      if (!result.domain || seenDomains.has(result.domain)) return false;
      seenDomains.add(result.domain);
      return true;
    });
    console.log(`[QuadQuery] After deduplication: ${qualityFiltered.length}`);

    // Apply quality filter
    qualityFiltered = filterQualityResults(qualityFiltered, searchQuery);
    console.log(`[QuadQuery] After quality filter: ${qualityFiltered.length}`);

    // FALLBACK: If combined returns <10 results, run a broad search without site: filters
    if (qualityFiltered.length < 10) {
      console.log(`[QuadQuery] Combined returned <10 results. Running fallback broad search...`);

      const broadResults = await searchWithBrave(searchQuery);
      console.log(`[QuadQuery] Fallback returned ${broadResults.length} results`);

      // Merge results, deduplicating by URL
      const existingUrls = new Set(qualityFiltered.map(r => r.url));
      const newResults = broadResults.filter(r => !existingUrls.has(r.url));

      // Apply quality filter to new results
      const newFiltered = filterQualityResults(newResults, searchQuery);
      console.log(`[QuadQuery] Fallback added ${newFiltered.length} new results after quality filter`);

      qualityFiltered = [...qualityFiltered, ...newFiltered];

      // Re-deduplicate by domain after merge
      const finalDomains = new Set<string>();
      qualityFiltered = qualityFiltered.filter(result => {
        if (!result.domain || finalDomains.has(result.domain)) return false;
        finalDomains.add(result.domain);
        return true;
      });
      console.log(`[QuadQuery] After merge and dedup: ${qualityFiltered.length}`);
    }

    // 5-category political lean counter (for logging)
    type LeanCounts = {
      left: number;
      centerLeft: number;
      center: number;
      centerRight: number;
      right: number;
      sources: Record<string, string[]>;
    };

    const countPoliticalLean5 = (results: CSEResult[]): LeanCounts => {
      const counts: LeanCounts = {
        left: 0,
        centerLeft: 0,
        center: 0,
        centerRight: 0,
        right: 0,
        sources: { left: [], centerLeft: [], center: [], centerRight: [], right: [] }
      };

      for (const r of results) {
        const lean = getPoliticalLean(r.domain || '');
        const domain = r.domain || 'unknown';
        switch (lean) {
          case 'left':
            counts.left++;
            counts.sources.left.push(domain);
            break;
          case 'center-left':
            counts.centerLeft++;
            counts.sources.centerLeft.push(domain);
            break;
          case 'center-right':
            counts.centerRight++;
            counts.sources.centerRight.push(domain);
            break;
          case 'right':
            counts.right++;
            counts.sources.right.push(domain);
            break;
          default:
            counts.center++;
            counts.sources.center.push(domain);
        }
      }
      return counts;
    };

    const finalCounts = countPoliticalLean5(qualityFiltered);
    console.log(`[BalancedSearch] Final 5-category distribution:`);
    console.log(`  Left: ${finalCounts.left} [${finalCounts.sources.left.join(', ') || 'none'}]`);
    console.log(`  Center-Left: ${finalCounts.centerLeft} [${finalCounts.sources.centerLeft.join(', ') || 'none'}]`);
    console.log(`  Center: ${finalCounts.center} [${finalCounts.sources.center.join(', ') || 'none'}]`);
    console.log(`  Center-Right: ${finalCounts.centerRight} [${finalCounts.sources.centerRight.join(', ') || 'none'}]`);
    console.log(`  Right: ${finalCounts.right} [${finalCounts.sources.right.join(', ') || 'none'}]`);
    console.log(`[BalancedSearch] Total results: ${qualityFiltered.length}`);

    // ==========================================================================
    // GAP-TARGETED GEMINI GROUNDED SEARCH (SR&ED E10)
    // Symmetric gap-fill: triggers for BOTH right-side AND left-side gaps
    // Right: If Right + Center-Right < 2 sources
    // Left:  If Left + Center-Left < 2 sources
    // ==========================================================================
    const rightSideCount = finalCounts.right + finalCounts.centerRight;
    const leftSideCount = finalCounts.left + finalCounts.centerLeft;

    // Track initial counts for status
    gapFillStatus.right.sourceCount = rightSideCount;
    gapFillStatus.left.sourceCount = leftSideCount;

    // RIGHT-SIDE GAP DETECTION
    if (rightSideCount < 2) {
      console.log(`[GeminiGrounded] RIGHT-SIDE GAP DETECTED: Only ${rightSideCount} right/center-right sources. Triggering gap-fill search...`);
      gapFillStatus.right.triggered = true;
      gapFillStatus.right.reason = 'gap_detected';

      const groundedResults = await geminiGroundedSearch(neutralQuery, 'right');
      gapFillStatus.right.resultsFound = groundedResults.length;
      gapFillStatus.right.domains = groundedResults.map(r => r.domain);

      if (groundedResults.length > 0) {
        const existingDomains = new Set(qualityFiltered.map(r => r.domain));
        const newGroundedResults = groundedResults.filter(r => !existingDomains.has(r.domain));

        console.log(`[GeminiGrounded] Adding ${newGroundedResults.length} new RIGHT sources (${groundedResults.length} total, ${groundedResults.length - newGroundedResults.length} duplicates)`);

        qualityFiltered = [...qualityFiltered, ...newGroundedResults];

        const updatedCounts = countPoliticalLean5(qualityFiltered);
        const newRightSideCount = updatedCounts.right + updatedCounts.centerRight;
        gapFillStatus.right.sourceCount = newRightSideCount; // Update to final count
        console.log(`[GeminiGrounded] Updated right-side count: ${rightSideCount} -> ${newRightSideCount}`);
      }
    } else {
      console.log(`[GeminiGrounded] Right-side coverage adequate (${rightSideCount} sources). Skipping right gap-fill.`);
    }

    // LEFT-SIDE GAP DETECTION (symmetric)
    if (leftSideCount < 2) {
      console.log(`[GeminiGrounded] LEFT-SIDE GAP DETECTED: Only ${leftSideCount} left/center-left sources. Triggering gap-fill search...`);
      gapFillStatus.left.triggered = true;
      gapFillStatus.left.reason = 'gap_detected';

      const groundedResults = await geminiGroundedSearch(neutralQuery, 'left');
      gapFillStatus.left.resultsFound = groundedResults.length;
      gapFillStatus.left.domains = groundedResults.map(r => r.domain);

      if (groundedResults.length > 0) {
        const existingDomains = new Set(qualityFiltered.map(r => r.domain));
        const newGroundedResults = groundedResults.filter(r => !existingDomains.has(r.domain));

        console.log(`[GeminiGrounded] Adding ${newGroundedResults.length} new LEFT sources (${groundedResults.length} total, ${groundedResults.length - newGroundedResults.length} duplicates)`);

        qualityFiltered = [...qualityFiltered, ...newGroundedResults];

        const updatedCounts = countPoliticalLean5(qualityFiltered);
        const newLeftSideCount = updatedCounts.left + updatedCounts.centerLeft;
        gapFillStatus.left.sourceCount = newLeftSideCount; // Update to final count
        console.log(`[GeminiGrounded] Updated left-side count: ${leftSideCount} -> ${newLeftSideCount}`);
      }
    } else {
      console.log(`[GeminiGrounded] Left-side coverage adequate (${leftSideCount} sources). Skipping left gap-fill.`);
    }

    // Diversify by source type using round-robin
    const diverseResults = diversifyResults(qualityFiltered, 15);
    console.log(`[Search] After diversity: ${diverseResults.length} results`);

    if (diverseResults.length === 0) {
      const response = NextResponse.json({
        summary: 'No coverage found on trusted news sources for this story. Try different keywords.',
        commonGround: null,
        keyDifferences: null,
        alternatives: [],
        isPaywalled,
        usage: usageInfo,
      }, { headers: corsHeaders });
      response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
      return response;
    }

    // 6. STEP 2: THE BRAIN - Synthesize with Gemini
    console.log(`[Gemini] Synthesizing ${diverseResults.length} sources...`);
    const intelBrief = await synthesizeWithGemini(diverseResults, searchQuery);

    // 7. STEP 3: Process results with badges + transparency + author info
    const alternatives = processSearchResults(diverseResults, intelBrief?.authors);

    // 8. Analyze political diversity + query bias
    // Include input URL in diversity analysis so warnings account for the user's source
    const inputUrl = hasUrl ? body.url.trim() : undefined;
    const diversityAnalysis = analyzePoliticalDiversity(alternatives, undefined, inputUrl);
    const queryBiasWarning = detectQueryBias(searchQuery);
    console.log(`[Diversity] Left: ${diversityAnalysis.leftCount}, Center: ${diversityAnalysis.centerCount}, Right: ${diversityAnalysis.rightCount}, Balanced: ${diversityAnalysis.isBalanced}`);
    if (queryBiasWarning) console.log(`[QueryBias] Warning: ${queryBiasWarning}`);

    // 9. Handle Gemini timeout - return fallback response
    if (!intelBrief) {
      console.log('[Gemini] Timeout or error - returning fallback response');
      const response = NextResponse.json({
        summary: `Found **${alternatives.length} sources** covering this story. AI synthesis timed out - please review the sources below.`,
        commonGround: [{ label: 'Coverage', value: `${alternatives.length} sources found covering this topic.` }],
        keyDifferences: 'AI analysis unavailable due to timeout. Compare sources manually.',
        alternatives,
        isPaywalled,
        usage: usageInfo,
        diversityAnalysis: {
          isBalanced: diversityAnalysis.isBalanced,
          leftCount: diversityAnalysis.leftCount,
          centerCount: diversityAnalysis.centerCount,
          rightCount: diversityAnalysis.rightCount,
          warning: diversityAnalysis.warning,
        },
        queryBiasWarning,
        timedOut: true,
      }, { headers: corsHeaders });
      response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
      return response;
    }

    console.log(`[Gemini] Synthesis complete`);

    // 10. Override consensus language if diversity warning OR query bias is triggered
    let finalKeyDifferences: KeyDifference[] | string = intelBrief.keyDifferences;
    if ((diversityAnalysis.warning || queryBiasWarning) && typeof finalKeyDifferences === 'string') {
      const consensusPhrases = ['consistent narrative', 'sources agree', 'consensus'];
      const kdLower = (finalKeyDifferences as string).toLowerCase();
      const hasConsensusLanguage = consensusPhrases.some(phrase => kdLower.includes(phrase));
      if (hasConsensusLanguage) {
        if (queryBiasWarning) {
          finalKeyDifferences = 'Sources using this framing present a consistent narrative. Other perspectives may use different framing.';
          console.log(`[QueryBias] Overrode consensus language due to opinion-laden query`);
        } else {
          finalKeyDifferences = 'Sources in this sample agree. Note: This sample may not include all political perspectives.';
          console.log(`[Diversity] Overrode consensus language due to imbalanced sources`);
        }
      }
    }

    // 11. Build Response
    const responseData = {
      summary: intelBrief.summary,
      commonGround: intelBrief.commonGround || null,
      keyDifferences: finalKeyDifferences || null,
      provenance: intelBrief.provenance || null,  // NEW: Story origin tracking
      narrative: intelBrief.narrative || null,   // NEW: Narrative tone analysis
      alternatives,
      isPaywalled,
      usage: usageInfo,
      diversityAnalysis: {
        isBalanced: diversityAnalysis.isBalanced,
        leftCount: diversityAnalysis.leftCount,
        centerCount: diversityAnalysis.centerCount,
        rightCount: diversityAnalysis.rightCount,
        warning: diversityAnalysis.warning,
      },
      queryBiasWarning,
      gapFillStatus,  // Gap-fill observability for QA/benchmarking
    };

    // 12. Cache the result for future identical queries
    setCachedResult(searchQuery, responseData);

    const response = NextResponse.json(responseData, { headers: corsHeaders });
    response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
    return response;

  } catch (error: any) {
    console.error('Error in /api/find:', error?.message || error);
    
    let appError: AppError;
    if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND')) {
      appError = createError('NETWORK_ERROR');
    } else if (error.message?.includes('timeout') || error.name === 'AbortError') {
      appError = createError('TIMEOUT');
    } else {
      appError = createError('API_ERROR');
    }
    
    return NextResponse.json(
      { error: appError.userMessage, errorType: appError.type, retryable: appError.retryable },
      { status: appError.statusCode, headers: corsHeaders }
    );
  }
}