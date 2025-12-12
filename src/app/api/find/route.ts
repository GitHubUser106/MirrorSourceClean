import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// --- Error Types ---
type ErrorType = 'INVALID_URL' | 'INVALID_KEYWORDS' | 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMITED' | 'API_ERROR';

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
      userMessage: 'The search took too long. Please try again - results vary each time.',
      statusCode: 504,
      retryable: true,
    },
    RATE_LIMITED: {
      userMessage: details || 'You\'ve reached your daily limit. Try again tomorrow!',
      statusCode: 429,
      retryable: false,
    },
    API_ERROR: {
      userMessage: 'Search failed. Please try again - results vary each time.',
      statusCode: 500,
      retryable: true,
    },
  };
  
  return { type, ...errors[type] };
}

// --- Syndication ---
const SYNDICATION_PARTNERS: Record<string, string[]> = {
  'wsj.com': ['finance.yahoo.com', 'msn.com'],
  'bloomberg.com': ['finance.yahoo.com', 'msn.com'],
  'nytimes.com': ['msn.com'],
  'washingtonpost.com': ['msn.com'],
  'ft.com': ['finance.yahoo.com', 'msn.com'],
};

const PAYWALLED_DOMAINS = new Set([
  'wsj.com', 'nytimes.com', 'washingtonpost.com', 'ft.com', 
  'economist.com', 'bloomberg.com', 'theatlantic.com', 'newyorker.com',
]);

function isPaywalledSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    return Array.from(PAYWALLED_DOMAINS).some(domain => hostname.includes(domain));
  } catch { return false; }
}

function getSyndicationPartners(url: string): string[] {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    for (const [domain, partners] of Object.entries(SYNDICATION_PARTNERS)) {
      if (hostname.includes(domain)) return partners;
    }
  } catch {}
  return [];
}

// --- Source classification ---
type SourceType = 'wire' | 'public' | 'corporate' | 'state' | 'analysis' | 'local' | 'national' | 'international' | 'magazine' | 'specialized' | 'reference' | 'syndication' | 'platform';

function getSourceInfo(domain: string): { displayName: string; type: SourceType; countryCode: string } {
  if (!domain) return { displayName: 'SOURCE', type: 'local', countryCode: 'US' };
  const lower = domain.toLowerCase();
  
  const sources: Record<string, { displayName: string; type: SourceType; countryCode: string }> = {
    // Syndication
    'finance.yahoo.com': { displayName: 'YAHOO FINANCE', type: 'syndication', countryCode: 'US' },
    'news.yahoo.com': { displayName: 'YAHOO NEWS', type: 'syndication', countryCode: 'US' },
    'yahoo.com': { displayName: 'YAHOO', type: 'syndication', countryCode: 'US' },
    'msn.com': { displayName: 'MSN', type: 'syndication', countryCode: 'US' },
    // Wire
    'apnews.com': { displayName: 'AP NEWS', type: 'wire', countryCode: 'US' },
    'reuters.com': { displayName: 'REUTERS', type: 'wire', countryCode: 'UK' },
    'afp.com': { displayName: 'AFP', type: 'wire', countryCode: 'FR' },
    // Public Broadcasting
    'npr.org': { displayName: 'NPR', type: 'public', countryCode: 'US' },
    'pbs.org': { displayName: 'PBS', type: 'public', countryCode: 'US' },
    'opb.org': { displayName: 'OPB', type: 'public', countryCode: 'US' },
    'bbc.com': { displayName: 'BBC', type: 'public', countryCode: 'UK' },
    'bbc.co.uk': { displayName: 'BBC', type: 'public', countryCode: 'UK' },
    'cbc.ca': { displayName: 'CBC', type: 'public', countryCode: 'CA' },
    'abc.net.au': { displayName: 'ABC AUSTRALIA', type: 'public', countryCode: 'AU' },
    // International
    'aljazeera.com': { displayName: 'AL JAZEERA', type: 'international', countryCode: 'QA' },
    'theguardian.com': { displayName: 'THE GUARDIAN', type: 'international', countryCode: 'UK' },
    'thehindu.com': { displayName: 'THE HINDU', type: 'international', countryCode: 'IN' },
    'dw.com': { displayName: 'DW', type: 'international', countryCode: 'DE' },
    'france24.com': { displayName: 'FRANCE 24', type: 'international', countryCode: 'FR' },
    'scmp.com': { displayName: 'SCMP', type: 'international', countryCode: 'HK' },
    // Israeli outlets
    'timesofisrael.com': { displayName: 'TIMES OF ISRAEL', type: 'international', countryCode: 'IL' },
    'jpost.com': { displayName: 'JERUSALEM POST', type: 'international', countryCode: 'IL' },
    'ynetnews.com': { displayName: 'YNET NEWS', type: 'international', countryCode: 'IL' },
    'haaretz.com': { displayName: 'HAARETZ', type: 'international', countryCode: 'IL' },
    'i24news.tv': { displayName: 'I24 NEWS', type: 'international', countryCode: 'IL' },
    // Middle East
    'thearabdailynews.com': { displayName: 'ARAB DAILY NEWS', type: 'international', countryCode: 'US' },
    'arabnews.com': { displayName: 'ARAB NEWS', type: 'international', countryCode: 'SA' },
    'middleeasteye.net': { displayName: 'MIDDLE EAST EYE', type: 'international', countryCode: 'UK' },
    // US Corporate
    'cnn.com': { displayName: 'CNN', type: 'corporate', countryCode: 'US' },
    'foxnews.com': { displayName: 'FOX NEWS', type: 'corporate', countryCode: 'US' },
    'nbcnews.com': { displayName: 'NBC NEWS', type: 'corporate', countryCode: 'US' },
    'cbsnews.com': { displayName: 'CBS NEWS', type: 'corporate', countryCode: 'US' },
    'abcnews.go.com': { displayName: 'ABC NEWS', type: 'corporate', countryCode: 'US' },
    'msnbc.com': { displayName: 'MSNBC', type: 'corporate', countryCode: 'US' },
    // National
    'usatoday.com': { displayName: 'USA TODAY', type: 'national', countryCode: 'US' },
    'axios.com': { displayName: 'AXIOS', type: 'national', countryCode: 'US' },
    // Analysis / Think Tanks
    'thehill.com': { displayName: 'THE HILL', type: 'analysis', countryCode: 'US' },
    'politico.com': { displayName: 'POLITICO', type: 'analysis', countryCode: 'US' },
    'responsiblestatecraft.org': { displayName: 'RESPONSIBLE STATECRAFT', type: 'analysis', countryCode: 'US' },
    'foreignpolicy.com': { displayName: 'FOREIGN POLICY', type: 'analysis', countryCode: 'US' },
    'foreignaffairs.com': { displayName: 'FOREIGN AFFAIRS', type: 'analysis', countryCode: 'US' },
    'cfr.org': { displayName: 'CFR', type: 'analysis', countryCode: 'US' },
    'brookings.edu': { displayName: 'BROOKINGS', type: 'analysis', countryCode: 'US' },
    'cato.org': { displayName: 'CATO INSTITUTE', type: 'analysis', countryCode: 'US' },
    'heritage.org': { displayName: 'HERITAGE', type: 'analysis', countryCode: 'US' },
    'carnegieendowment.org': { displayName: 'CARNEGIE', type: 'analysis', countryCode: 'US' },
    'rand.org': { displayName: 'RAND', type: 'analysis', countryCode: 'US' },
    'diplomaticopinion.com': { displayName: 'DIPLOMATIC OPINION', type: 'analysis', countryCode: 'US' },
    'theharvardpoliticalreview.com': { displayName: 'HARVARD POLITICAL REVIEW', type: 'analysis', countryCode: 'US' },
    'harvardpoliticalreview.com': { displayName: 'HARVARD POLITICAL REVIEW', type: 'analysis', countryCode: 'US' },
    'leaders-mena.com': { displayName: 'LEADERS MENA', type: 'analysis', countryCode: 'AE' },
    // Magazines
    'forbes.com': { displayName: 'FORBES', type: 'magazine', countryCode: 'US' },
    'time.com': { displayName: 'TIME', type: 'magazine', countryCode: 'US' },
    'newsweek.com': { displayName: 'NEWSWEEK', type: 'magazine', countryCode: 'US' },
    'economist.com': { displayName: 'THE ECONOMIST', type: 'magazine', countryCode: 'UK' },
    'theatlantic.com': { displayName: 'THE ATLANTIC', type: 'magazine', countryCode: 'US' },
    'newyorker.com': { displayName: 'THE NEW YORKER', type: 'magazine', countryCode: 'US' },
    // Specialized / Business / Financial
    'wired.com': { displayName: 'WIRED', type: 'specialized', countryCode: 'US' },
    'techcrunch.com': { displayName: 'TECHCRUNCH', type: 'specialized', countryCode: 'US' },
    'theverge.com': { displayName: 'THE VERGE', type: 'specialized', countryCode: 'US' },
    'producer.com': { displayName: 'PRODUCER', type: 'specialized', countryCode: 'US' },
    'successfulfarming.com': { displayName: 'SUCCESSFUL FARMING', type: 'specialized', countryCode: 'US' },
    'livemint.com': { displayName: 'MINT', type: 'specialized', countryCode: 'IN' },
    'bloomberg.com': { displayName: 'BLOOMBERG', type: 'specialized', countryCode: 'US' },
    'cnbc.com': { displayName: 'CNBC', type: 'specialized', countryCode: 'US' },
    'ft.com': { displayName: 'FINANCIAL TIMES', type: 'specialized', countryCode: 'UK' },
    'wsj.com': { displayName: 'WSJ', type: 'specialized', countryCode: 'US' },
    'business-standard.com': { displayName: 'BUSINESS STANDARD', type: 'specialized', countryCode: 'IN' },
    'financialpost.com': { displayName: 'FINANCIAL POST', type: 'specialized', countryCode: 'CA' },
    'bnnbloomberg.ca': { displayName: 'BNN BLOOMBERG', type: 'specialized', countryCode: 'CA' },
    'tradingview.com': { displayName: 'TRADINGVIEW', type: 'specialized', countryCode: 'US' },
    'marketwatch.com': { displayName: 'MARKETWATCH', type: 'specialized', countryCode: 'US' },
    'barrons.com': { displayName: 'BARRONS', type: 'specialized', countryCode: 'US' },
    'investopedia.com': { displayName: 'INVESTOPEDIA', type: 'specialized', countryCode: 'US' },
    'seekingalpha.com': { displayName: 'SEEKING ALPHA', type: 'specialized', countryCode: 'US' },
    // Canadian National
    'nationalpost.com': { displayName: 'NATIONAL POST', type: 'national', countryCode: 'CA' },
    'theglobeandmail.com': { displayName: 'GLOBE AND MAIL', type: 'national', countryCode: 'CA' },
    'globeandmail.com': { displayName: 'GLOBE AND MAIL', type: 'national', countryCode: 'CA' },
    'torontostar.com': { displayName: 'TORONTO STAR', type: 'national', countryCode: 'CA' },
    'thestar.com': { displayName: 'TORONTO STAR', type: 'national', countryCode: 'CA' },
    // Canadian Corporate
    'globalnews.ca': { displayName: 'GLOBAL NEWS', type: 'corporate', countryCode: 'CA' },
    'ctvnews.ca': { displayName: 'CTV NEWS', type: 'corporate', countryCode: 'CA' },
    'citynews.ca': { displayName: 'CITY NEWS', type: 'corporate', countryCode: 'CA' },
    // Canadian Local (Postmedia chain)
    'leaderpost.com': { displayName: 'REGINA LEADER-POST', type: 'local', countryCode: 'CA' },
    'calgaryherald.com': { displayName: 'CALGARY HERALD', type: 'local', countryCode: 'CA' },
    'edmontonjournal.com': { displayName: 'EDMONTON JOURNAL', type: 'local', countryCode: 'CA' },
    'vancouversun.com': { displayName: 'VANCOUVER SUN', type: 'local', countryCode: 'CA' },
    'ottawacitizen.com': { displayName: 'OTTAWA CITIZEN', type: 'local', countryCode: 'CA' },
    'montrealgazette.com': { displayName: 'MONTREAL GAZETTE', type: 'local', countryCode: 'CA' },
    'winnipegfreepress.com': { displayName: 'WINNIPEG FREE PRESS', type: 'local', countryCode: 'CA' },
    'theprovince.com': { displayName: 'THE PROVINCE', type: 'local', countryCode: 'CA' },
    'windsorstar.com': { displayName: 'WINDSOR STAR', type: 'local', countryCode: 'CA' },
    'thechronicleherald.ca': { displayName: 'CHRONICLE HERALD', type: 'local', countryCode: 'CA' },
    // Australian National
    'theaustralian.com.au': { displayName: 'THE AUSTRALIAN', type: 'national', countryCode: 'AU' },
    'smh.com.au': { displayName: 'SYDNEY MORNING HERALD', type: 'national', countryCode: 'AU' },
    'theage.com.au': { displayName: 'THE AGE', type: 'national', countryCode: 'AU' },
    'news.com.au': { displayName: 'NEWS.COM.AU', type: 'corporate', countryCode: 'AU' },
    '9news.com.au': { displayName: '9 NEWS', type: 'corporate', countryCode: 'AU' },
    '7news.com.au': { displayName: '7 NEWS', type: 'corporate', countryCode: 'AU' },
    'sbs.com.au': { displayName: 'SBS', type: 'public', countryCode: 'AU' },
    'afr.com': { displayName: 'AFR', type: 'specialized', countryCode: 'AU' },
    // UK National
    'telegraph.co.uk': { displayName: 'THE TELEGRAPH', type: 'national', countryCode: 'UK' },
    'independent.co.uk': { displayName: 'THE INDEPENDENT', type: 'national', countryCode: 'UK' },
    'thetimes.co.uk': { displayName: 'THE TIMES', type: 'national', countryCode: 'UK' },
    'dailymail.co.uk': { displayName: 'DAILY MAIL', type: 'national', countryCode: 'UK' },
    'mirror.co.uk': { displayName: 'THE MIRROR', type: 'national', countryCode: 'UK' },
    'thesun.co.uk': { displayName: 'THE SUN', type: 'national', countryCode: 'UK' },
    'express.co.uk': { displayName: 'EXPRESS', type: 'national', countryCode: 'UK' },
    'sky.com': { displayName: 'SKY NEWS', type: 'corporate', countryCode: 'UK' },
    'news.sky.com': { displayName: 'SKY NEWS', type: 'corporate', countryCode: 'UK' },
    'itv.com': { displayName: 'ITV NEWS', type: 'corporate', countryCode: 'UK' },
    'channel4.com': { displayName: 'CHANNEL 4', type: 'public', countryCode: 'UK' },
    // New Zealand
    'nzherald.co.nz': { displayName: 'NZ HERALD', type: 'national', countryCode: 'NZ' },
    'stuff.co.nz': { displayName: 'STUFF', type: 'national', countryCode: 'NZ' },
    'rnz.co.nz': { displayName: 'RNZ', type: 'public', countryCode: 'NZ' },
    // Ireland
    'irishtimes.com': { displayName: 'IRISH TIMES', type: 'national', countryCode: 'IE' },
    'independent.ie': { displayName: 'IRISH INDEPENDENT', type: 'national', countryCode: 'IE' },
    'rte.ie': { displayName: 'RTE', type: 'public', countryCode: 'IE' },
    // Platforms (not news outlets)
    'youtube.com': { displayName: 'YOUTUBE', type: 'platform', countryCode: 'US' },
    'reddit.com': { displayName: 'REDDIT', type: 'platform', countryCode: 'US' },
    'medium.com': { displayName: 'MEDIUM', type: 'platform', countryCode: 'US' },
    'substack.com': { displayName: 'SUBSTACK', type: 'platform', countryCode: 'US' },
  };
  
  for (const [key, info] of Object.entries(sources)) {
    if (lower.includes(key)) return info;
  }
  
  // Country from TLD - check BEFORE falling back to US default
  let countryCode = 'US';
  if (lower.endsWith('.uk') || lower.endsWith('.co.uk')) countryCode = 'UK';
  else if (lower.endsWith('.ca')) countryCode = 'CA';
  else if (lower.endsWith('.au') || lower.endsWith('.com.au')) countryCode = 'AU';
  else if (lower.endsWith('.de')) countryCode = 'DE';
  else if (lower.endsWith('.in') || lower.endsWith('.co.in')) countryCode = 'IN';
  else if (lower.endsWith('.nz') || lower.endsWith('.co.nz')) countryCode = 'NZ';
  else if (lower.endsWith('.ie')) countryCode = 'IE';
  else if (lower.endsWith('.fr')) countryCode = 'FR';
  else if (lower.endsWith('.il') || lower.endsWith('.co.il')) countryCode = 'IL';
  else if (lower.endsWith('.jp') || lower.endsWith('.co.jp')) countryCode = 'JP';
  else if (lower.endsWith('.kr') || lower.endsWith('.co.kr')) countryCode = 'KR';
  else if (lower.endsWith('.cn') || lower.endsWith('.com.cn')) countryCode = 'CN';
  else if (lower.endsWith('.ru')) countryCode = 'RU';
  else if (lower.endsWith('.br') || lower.endsWith('.com.br')) countryCode = 'BR';
  else if (lower.endsWith('.mx') || lower.endsWith('.com.mx')) countryCode = 'MX';
  else if (lower.endsWith('.es')) countryCode = 'ES';
  else if (lower.endsWith('.it')) countryCode = 'IT';
  else if (lower.endsWith('.nl')) countryCode = 'NL';
  else if (lower.endsWith('.se')) countryCode = 'SE';
  else if (lower.endsWith('.no')) countryCode = 'NO';
  else if (lower.endsWith('.ae')) countryCode = 'AE';
  else if (lower.endsWith('.sa')) countryCode = 'SA';
  else if (lower.endsWith('.za')) countryCode = 'ZA';
  else if (lower.endsWith('.sg')) countryCode = 'SG';
  else if (lower.endsWith('.hk') || lower.endsWith('.com.hk')) countryCode = 'HK';
  
  // Smart fallback: detect type from domain name patterns
  let type: SourceType = 'local';
  
  // Financial/business domains should be 'specialized', never 'local'
  if (lower.includes('financial') || lower.includes('finance') || 
      lower.includes('business') || lower.includes('market') ||
      lower.includes('trading') || lower.includes('invest') ||
      lower.includes('economic') || lower.includes('money')) {
    type = 'specialized';
  }
  
  const parts = domain.split('.');
  return { displayName: parts[0].toUpperCase(), type, countryCode };
}

// --- Helpers ---
function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

function isEnglishContent(text: string): boolean {
  if (!text) return false;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const nonLatinChars = (text.match(/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF]/g) || []).length;
  return latinChars > nonLatinChars * 0.7;
}

function isErrorTitle(title: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase();
  return ['access denied', 'page not found', '404', '403', 'forbidden', 'error', 'blocked', 'captcha', 'just a moment', 'subscribe', 'sign in'].some(p => lower.includes(p));
}

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

// --- URL Resolution ---
async function resolveUrl(redirectUrl: string): Promise<string | null> {
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return redirectUrl;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    });

    clearTimeout(timeoutId);
    const finalUrl = response.url;
    
    if (!finalUrl.includes('vertexaisearch.cloud.google.com')) {
      return finalUrl;
    }
    return null;
  } catch {
    return null;
  }
}

// --- Process Grounding Chunks ---
// Domains to always filter out - not acceptable as news sources
const BLOCKED_DOMAINS = new Set([
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'tiktok.com',
  'instagram.com',
  'quora.com',
  'stackexchange.com',
  'stackoverflow.com',
  'pinterest.com',
  'tumblr.com',
  'linkedin.com',
]);

function isBlockedDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return Array.from(BLOCKED_DOMAINS).some(blocked => lower.includes(blocked));
}

async function processGroundingChunks(
  chunks: any[],
  syndicationPartners: string[] = []
): Promise<Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType; countryCode: string; isSyndicated: boolean }>> {
  const results: Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType; countryCode: string; isSyndicated: boolean }> = [];
  const seen = new Set<string>();

  const processChunk = async (chunk: any) => {
    try {
      const web = chunk?.web;
      if (!web?.uri) return null;
      
      const title = web.title || '';
      if (title.toLowerCase().includes('google')) return null;

      const resolvedUrl = await resolveUrl(web.uri);
      if (!resolvedUrl) return null;

      const urlObj = new URL(resolvedUrl);
      const domain = urlObj.hostname.replace(/^www\./, '');

      // Hard filter: Block Reddit and other non-news sources
      if (isBlockedDomain(domain)) return null;

      let articleTitle = decodeHtmlEntities(title || domain);
      if (isErrorTitle(articleTitle)) return null;
      if (!isEnglishContent(articleTitle)) return null;

      const sourceInfo = getSourceInfo(domain);
      const isSyndicated = syndicationPartners.some(partner => domain.includes(partner));

      return { 
        uri: resolvedUrl, 
        title: articleTitle, 
        displayName: sourceInfo.displayName, 
        sourceDomain: domain, 
        sourceType: sourceInfo.type, 
        countryCode: sourceInfo.countryCode, 
        isSyndicated 
      };
    } catch { return null; }
  };

  const settled = await Promise.allSettled(chunks.slice(0, 15).map(processChunk));

  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value) {
      const item = result.value;
      if (!seen.has(item.sourceDomain)) {
        seen.add(item.sourceDomain);
        results.push(item);
      }
    }
  }

  const typePriority: Record<SourceType, number> = {
    'wire': 0,          // Raw facts (AP/Reuters) - highest value
    'specialized': 1,   // Financial intel (FT/Bloomberg/Financial Post)
    'national': 2,      // Papers of record (NYT/Globe & Mail)
    'international': 3, // Global perspective (Al Jazeera/Guardian)
    'public': 4,        // Neutral public broadcasting (BBC/PBS/CBC)
    'analysis': 5,      // Think tanks (Foreign Policy/Brookings)
    'corporate': 6,     // TV networks (CNN/Fox/CTV)
    'syndication': 7,   // Yahoo/MSN - useful paywall bypass, not primary
    'magazine': 8,      // Long-form (Atlantic/New Yorker)
    'local': 9,         // Regional papers
    'state': 10,        // State-affiliated media
    'reference': 11,    // Wikipedia etc.
    'platform': 12,     // User-generated (YouTube/Medium)
  };

  results.sort((a, b) => {
    if (a.isSyndicated !== b.isSyndicated) return a.isSyndicated ? -1 : 1;
    return typePriority[a.sourceType] - typePriority[b.sourceType];
  });

  return results;
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

// --- Gemini Call (URL-based) ---
async function callGemini(url: string, syndicationPartners: string[]): Promise<{
  summary: string;
  commonGround: string;
  keyDifferences: string;
  alternatives: any[];
}> {
  const syndicationHint = syndicationPartners.length > 0 
    ? `PRIORITY: Search for syndicated versions on ${syndicationPartners.join(', ')}.`
    : '';
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const prompt = `
You are a news research assistant. Find alternative news sources covering this story.

TODAY'S DATE: ${today}
ARTICLE URL: ${url}
${syndicationHint}

SOURCE HIERARCHY (search in this order):
1. WIRE SERVICES: AP, Reuters, AFP
2. BROADCAST: BBC, NPR, PBS, CBS News, NBC News, ABC News, CNN
3. QUALITY NEWSPAPERS: Guardian, Washington Post, NY Times, Financial Times
4. SYNDICATION: Yahoo News, MSN, AOL News
5. ANALYSIS: Politico, The Hill, Axios
AVOID: Reddit, Twitter, forums, blogs, YouTube comments

RESPONSE FORMAT (JSON only):
{
  "summary": "3-4 sentences. Grade 6-8 reading level. Short sentences. Bold only the KEY TAKEAWAY of each sentence (not every noun/number). Max 4 bold phrases total. Reader should understand the story by reading ONLY the bold text.",
  "commonGround": "1-2 sentences. What do sources CONCLUDE or AGREE ON? Bold the findings/conclusions, NOT topic words or source names.",
  "keyDifferences": "1-2 sentences. The ONE biggest contrast. Bold the CONTRASTING INTERPRETATIONS, not source names. Example: Reuters sees this as **a sign of economic strength**, while Bloomberg warns it **may be temporary due to gold exports**."
}

CRITICAL RULES:
- BOLDING: If someone reads ONLY the bold text, they should understand the main point
- DON'T bold: source names, generic topic words, every number
- DO bold: conclusions, interpretations, what changed, why it matters
- commonGround: MAX 2 sentences
- keyDifferences: MAX 2 sentences
- Use simple words a 12-year-old would understand
  `.trim();

  const geminiResponse: any = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { tools: [{ googleSearch: {} }] },
  });

  let text: string | undefined;
  if (geminiResponse?.response && typeof geminiResponse.response.text === 'function') {
    text = geminiResponse.response.text();
  } else if (Array.isArray(geminiResponse?.candidates)) {
    text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
  }

  if (!text) throw new Error('No response from model');

  const parsedData = extractJson(text) || {};
  
  const citationRegex = /\s*\[\d+(?:,\s*\d+)*\]/g;
  let summary = (parsedData.summary || '').replace(citationRegex, '').trim();
  let commonGround = (parsedData.commonGround || '').replace(citationRegex, '').trim();
  let keyDifferences = (parsedData.keyDifferences || '').replace(citationRegex, '').trim();

  const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
  const groundingChunks = candidates[0]?.groundingMetadata?.groundingChunks ?? [];

  const alternatives = await processGroundingChunks(groundingChunks, syndicationPartners);

  if (!summary && alternatives.length > 0) {
    const cleanText = text.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*\}/g, '').trim();
    if (cleanText && cleanText.length > 50 && cleanText.length < 1000) {
      summary = cleanText.split('.').slice(0, 3).join('.') + '.';
    } else {
      try {
        const urlPath = new URL(url).pathname;
        const words = urlPath.split(/[-_\/]/).filter(w => w.length > 2 && !/^\d+$/.test(w));
        if (words.length > 2) {
          const topic = words.slice(0, 5).join(' ').replace(/\b\w/g, c => c.toUpperCase());
          summary = `Multiple sources are reporting on **${topic}**. We found **${alternatives.length} alternative sources** covering this story from different perspectives.`;
        }
      } catch {}
    }
    
    if (!summary) {
      summary = `We found **${alternatives.length} sources** covering this story. Click any source below to read their coverage.`;
    }
  }

  if (alternatives.length < 2) {
    keyDifferences = '';
  }

  return { summary, commonGround, keyDifferences, alternatives };
}

// --- Gemini Call (Keyword-based) ---
async function callGeminiWithKeywords(keywords: string): Promise<{
  summary: string;
  commonGround: string;
  keyDifferences: string;
  alternatives: any[];
}> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const prompt = `
You are a premium news intelligence assistant. Find professional news coverage of this SPECIFIC story.

TODAY'S DATE: ${today}
STORY TO FIND: "${keywords}"

MANDATORY: Search these outlets FIRST (in order):
1. Reuters, AP News, AFP (wire services)
2. BBC, NPR, PBS NewsHour, Al Jazeera
3. The Guardian, Washington Post, New York Times
4. CNN, CBS News, NBC News, ABC News
5. Times of Israel, Haaretz, Jerusalem Post (for Middle East stories)
6. Politico, The Hill, Axios

DO NOT INCLUDE - These are NOT acceptable sources:
❌ Reddit (reddit.com)
❌ Twitter/X posts
❌ YouTube comments
❌ Personal blogs
❌ Forums or discussion boards

If you cannot find this exact story from professional news outlets, say so clearly. Do not substitute Reddit or forum discussions.

RESPONSE FORMAT (JSON only):
{
  "summary": "3-4 sentences about THIS SPECIFIC story. Grade 6-8 reading level. Short sentences. Bold only the KEY TAKEAWAY (max 4 bold phrases). Reader should understand the story by reading ONLY the bold text.",
  "commonGround": "1-2 sentences. What do sources CONCLUDE or AGREE ON? Bold the findings/conclusions, NOT topic words.",
  "keyDifferences": "1-2 sentences. The ONE biggest contrast in coverage. Bold the CONTRASTING INTERPRETATIONS."
}

CRITICAL:
- This is a SPECIFIC news event, not a broad topic search
- Find the SAME story from different professional outlets
- NEVER include Reddit, forums, or social media as sources
- If only low-quality sources exist, return fewer results rather than including Reddit
  `.trim();

  const geminiResponse: any = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { tools: [{ googleSearch: {} }] },
  });

  let text: string | undefined;
  if (geminiResponse?.response && typeof geminiResponse.response.text === 'function') {
    text = geminiResponse.response.text();
  } else if (Array.isArray(geminiResponse?.candidates)) {
    text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
  }

  if (!text) throw new Error('No response from model');

  const parsedData = extractJson(text) || {};
  
  const citationRegex = /\s*\[\d+(?:,\s*\d+)*\]/g;
  let summary = (parsedData.summary || '').replace(citationRegex, '').trim();
  let commonGround = (parsedData.commonGround || '').replace(citationRegex, '').trim();
  let keyDifferences = (parsedData.keyDifferences || '').replace(citationRegex, '').trim();

  const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
  const groundingChunks = candidates[0]?.groundingMetadata?.groundingChunks ?? [];

  const alternatives = await processGroundingChunks(groundingChunks, []);

  if (!summary && alternatives.length > 0) {
    summary = `We found **${alternatives.length} sources** covering "${keywords}". Click any source below to read their coverage.`;
  }

  if (alternatives.length < 2) {
    keyDifferences = '';
  }

  return { summary, commonGround, keyDifferences, alternatives };
}

// --- Main Handler ---
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
    try { 
      body = await req.json(); 
    } catch { 
      const error = createError('INVALID_URL');
      return NextResponse.json(
        { error: 'Invalid request body', errorType: error.type, retryable: false },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Check if this is a keyword search or URL search
    const hasKeywords = body.keywords && typeof body.keywords === 'string' && body.keywords.trim();
    const hasUrl = body.url && typeof body.url === 'string' && body.url.trim();

    if (!hasKeywords && !hasUrl) {
      const error = createError('INVALID_URL');
      return NextResponse.json(
        { error: error.userMessage, errorType: error.type, retryable: error.retryable },
        { status: error.statusCode, headers: corsHeaders }
      );
    }

    // 4. Increment Usage
    const { info: usageInfo, cookieValue } = await incrementUsage(req);

    let result;
    let isPaywalled = false;

    if (hasKeywords) {
      // Keyword-based search
      const keywords = body.keywords.trim();
      
      if (keywords.length < 3) {
        const error = createError('INVALID_KEYWORDS');
        return NextResponse.json(
          { error: 'Please enter at least a few keywords to search.', errorType: error.type, retryable: false },
          { status: error.statusCode, headers: corsHeaders }
        );
      }

      result = await callGeminiWithKeywords(keywords);
    } else {
      // URL-based search
      const validation = validateUrl(body.url);
      if (!validation.valid && validation.error) {
        return NextResponse.json(
          { error: validation.error.userMessage, errorType: validation.error.type, retryable: validation.error.retryable },
          { status: validation.error.statusCode, headers: corsHeaders }
        );
      }

      const url = body.url.trim();
      isPaywalled = isPaywalledSource(url);
      const syndicationPartners = getSyndicationPartners(url);

      result = await callGemini(url, syndicationPartners);
    }

    // 5. Build Response
    const response = NextResponse.json({
      summary: result.summary,
      commonGround: result.commonGround,
      keyDifferences: result.keyDifferences,
      alternatives: result.alternatives,
      isPaywalled,
      usage: usageInfo,
    }, { headers: corsHeaders });

    response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
    return response;

  } catch (error: any) {
    console.error('Error in /api/find:', error?.message || error);
    
    let appError: AppError;
    
    if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND') || error.message?.includes('network')) {
      appError = createError('NETWORK_ERROR');
    } else if (error.message?.includes('timeout') || error.message?.includes('aborted') || error.name === 'AbortError' || error.message?.includes('DEADLINE_EXCEEDED')) {
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