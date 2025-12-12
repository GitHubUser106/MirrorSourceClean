import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

// --- Source Classification (The Badge Logic) ---
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
    'sbs.com.au': { displayName: 'SBS', type: 'public', countryCode: 'AU' },
    'channel4.com': { displayName: 'CHANNEL 4', type: 'public', countryCode: 'UK' },
    'rnz.co.nz': { displayName: 'RNZ', type: 'public', countryCode: 'NZ' },
    'rte.ie': { displayName: 'RTE', type: 'public', countryCode: 'IE' },
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
    // Asia Pacific
    'straitstimes.com': { displayName: 'STRAITS TIMES', type: 'international', countryCode: 'SG' },
    'channelnewsasia.com': { displayName: 'CNA', type: 'international', countryCode: 'SG' },
    'japantimes.co.jp': { displayName: 'JAPAN TIMES', type: 'international', countryCode: 'JP' },
    'koreaherald.com': { displayName: 'KOREA HERALD', type: 'international', countryCode: 'KR' },
    'koreatimes.co.kr': { displayName: 'KOREA TIMES', type: 'international', countryCode: 'KR' },
    'bangkokpost.com': { displayName: 'BANGKOK POST', type: 'international', countryCode: 'TH' },
    // US Corporate
    'cnn.com': { displayName: 'CNN', type: 'corporate', countryCode: 'US' },
    'foxnews.com': { displayName: 'FOX NEWS', type: 'corporate', countryCode: 'US' },
    'nbcnews.com': { displayName: 'NBC NEWS', type: 'corporate', countryCode: 'US' },
    'cbsnews.com': { displayName: 'CBS NEWS', type: 'corporate', countryCode: 'US' },
    'abcnews.go.com': { displayName: 'ABC NEWS', type: 'corporate', countryCode: 'US' },
    'msnbc.com': { displayName: 'MSNBC', type: 'corporate', countryCode: 'US' },
    // UK Corporate
    'sky.com': { displayName: 'SKY NEWS', type: 'corporate', countryCode: 'UK' },
    'news.sky.com': { displayName: 'SKY NEWS', type: 'corporate', countryCode: 'UK' },
    'itv.com': { displayName: 'ITV NEWS', type: 'corporate', countryCode: 'UK' },
    // Canadian Corporate
    'globalnews.ca': { displayName: 'GLOBAL NEWS', type: 'corporate', countryCode: 'CA' },
    'ctvnews.ca': { displayName: 'CTV NEWS', type: 'corporate', countryCode: 'CA' },
    'citynews.ca': { displayName: 'CITY NEWS', type: 'corporate', countryCode: 'CA' },
    // Australian Corporate
    'news.com.au': { displayName: 'NEWS.COM.AU', type: 'corporate', countryCode: 'AU' },
    '9news.com.au': { displayName: '9 NEWS', type: 'corporate', countryCode: 'AU' },
    '7news.com.au': { displayName: '7 NEWS', type: 'corporate', countryCode: 'AU' },
    // US National
    'usatoday.com': { displayName: 'USA TODAY', type: 'national', countryCode: 'US' },
    'axios.com': { displayName: 'AXIOS', type: 'national', countryCode: 'US' },
    // Canadian National
    'nationalpost.com': { displayName: 'NATIONAL POST', type: 'national', countryCode: 'CA' },
    'theglobeandmail.com': { displayName: 'GLOBE AND MAIL', type: 'national', countryCode: 'CA' },
    'globeandmail.com': { displayName: 'GLOBE AND MAIL', type: 'national', countryCode: 'CA' },
    'torontostar.com': { displayName: 'TORONTO STAR', type: 'national', countryCode: 'CA' },
    'thestar.com': { displayName: 'TORONTO STAR', type: 'national', countryCode: 'CA' },
    // Australian National
    'theaustralian.com.au': { displayName: 'THE AUSTRALIAN', type: 'national', countryCode: 'AU' },
    'smh.com.au': { displayName: 'SYDNEY MORNING HERALD', type: 'national', countryCode: 'AU' },
    'theage.com.au': { displayName: 'THE AGE', type: 'national', countryCode: 'AU' },
    // UK National
    'telegraph.co.uk': { displayName: 'THE TELEGRAPH', type: 'national', countryCode: 'UK' },
    'independent.co.uk': { displayName: 'THE INDEPENDENT', type: 'national', countryCode: 'UK' },
    'thetimes.co.uk': { displayName: 'THE TIMES', type: 'national', countryCode: 'UK' },
    'dailymail.co.uk': { displayName: 'DAILY MAIL', type: 'national', countryCode: 'UK' },
    'mirror.co.uk': { displayName: 'THE MIRROR', type: 'national', countryCode: 'UK' },
    'thesun.co.uk': { displayName: 'THE SUN', type: 'national', countryCode: 'UK' },
    'express.co.uk': { displayName: 'EXPRESS', type: 'national', countryCode: 'UK' },
    // New Zealand National
    'nzherald.co.nz': { displayName: 'NZ HERALD', type: 'national', countryCode: 'NZ' },
    'stuff.co.nz': { displayName: 'STUFF', type: 'national', countryCode: 'NZ' },
    // Ireland National
    'irishtimes.com': { displayName: 'IRISH TIMES', type: 'national', countryCode: 'IE' },
    'independent.ie': { displayName: 'IRISH INDEPENDENT', type: 'national', countryCode: 'IE' },
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
    'harvardpoliticalreview.com': { displayName: 'HARVARD POLITICAL REVIEW', type: 'analysis', countryCode: 'US' },
    'theharvardpoliticalreview.com': { displayName: 'HARVARD POLITICAL REVIEW', type: 'analysis', countryCode: 'US' },
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
    'fool.com': { displayName: 'MOTLEY FOOL', type: 'specialized', countryCode: 'US' },
    'zacks.com': { displayName: 'ZACKS', type: 'specialized', countryCode: 'US' },
    '247wallst.com': { displayName: '24/7 WALL ST', type: 'specialized', countryCode: 'US' },
    'investing.com': { displayName: 'INVESTING.COM', type: 'specialized', countryCode: 'US' },
    'marketscreener.com': { displayName: 'MARKETSCREENER', type: 'specialized', countryCode: 'FR' },
    'thestreet.com': { displayName: 'THE STREET', type: 'specialized', countryCode: 'US' },
    'kiplinger.com': { displayName: 'KIPLINGER', type: 'specialized', countryCode: 'US' },
    'morningstar.com': { displayName: 'MORNINGSTAR', type: 'specialized', countryCode: 'US' },
    'benzinga.com': { displayName: 'BENZINGA', type: 'specialized', countryCode: 'US' },
    'biv.com': { displayName: 'BIV', type: 'specialized', countryCode: 'CA' },
    'virginiabusiness.com': { displayName: 'VIRGINIA BUSINESS', type: 'specialized', countryCode: 'US' },
    'afr.com': { displayName: 'AFR', type: 'specialized', countryCode: 'AU' },
  };
  
  for (const [key, info] of Object.entries(sources)) {
    if (lower.includes(key)) return info;
  }
  
  // Country from TLD
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
  else if (lower.endsWith('.th') || lower.endsWith('.co.th')) countryCode = 'TH';
  else if (lower.endsWith('.ph') || lower.endsWith('.com.ph')) countryCode = 'PH';
  else if (lower.endsWith('.my') || lower.endsWith('.com.my')) countryCode = 'MY';
  
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

// --- URL to Keywords Extraction ---
function extractKeywordsFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    // Extract meaningful words from the URL path
    const words = path
      .split(/[\/\-_.]/)
      .filter(segment => segment.length > 2) // At least 3 chars
      .filter(segment => !/^[0-9a-f]+$/i.test(segment)) // Remove pure hex/IDs
      .filter(segment => !/^\d+$/.test(segment)) // Remove pure numbers
      .filter(segment => /[a-z]/i.test(segment)) // Must have letters
      .filter(segment => !/^(content|article|story|news|post|index|html|htm|php|aspx|world|us|uk|business|tech|opinion|markets|amp|www|com|org|net)$/i.test(segment));
    
    if (words.length < 2) {
      return null; // Opaque URL - need user keywords
    }
    
    // Take up to 8 meaningful words
    return words.slice(0, 8).join(' ');
  } catch {
    return null;
  }
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
}

async function searchWithCSE(query: string): Promise<CSEResult[]> {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    console.error('Missing CSE credentials');
    throw new Error('Search configuration error');
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=10`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for CSE

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('CSE API error:', response.status, errorData);
      throw new Error(`CSE API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((item: any) => {
      let domain = '';
      try {
        domain = new URL(item.link).hostname.replace(/^www\./, '');
      } catch {}
      
      return {
        url: item.link,
        title: decodeHtmlEntities(item.title || ''),
        snippet: decodeHtmlEntities(item.snippet || ''),
        domain,
      };
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Search timeout');
    }
    throw error;
  }
}

// =============================================================================
// STEP 2: THE BRAIN - Gemini Synthesis (NO Grounding)
// =============================================================================
interface IntelBrief {
  summary: string;
  commonGround: string;
  keyDifferences: string;
}

async function synthesizeWithGemini(
  searchResults: CSEResult[],
  originalQuery: string
): Promise<IntelBrief> {
  // Build context from search results
  const context = searchResults.map((r, i) => 
    `[Source ${i + 1}: ${r.domain}]\nTitle: ${r.title}\nSnippet: ${r.snippet}`
  ).join('\n\n');

  const prompt = `
You are a news intelligence analyst. Based ONLY on the sources provided below, write a brief analysis.

STORY: "${originalQuery}"

SOURCES:
${context}

RESPOND IN JSON FORMAT:
{
  "summary": "3-4 sentences summarizing the story. Grade 6-8 reading level. Bold only the KEY TAKEAWAY of each sentence using **bold** syntax. Max 4 bold phrases. Reader should understand the story by reading ONLY the bold text.",
  "commonGround": "1-2 sentences. What do the sources AGREE ON? Bold the conclusions/findings, not topic words.",
  "keyDifferences": "1-2 sentences. The ONE biggest contrast in how sources cover this. Bold the CONTRASTING INTERPRETATIONS. If all sources agree, say 'Sources present a consistent narrative with no major differences.'"
}

RULES:
- ONLY use information from the sources above - do not add outside knowledge
- Bold key conclusions, not source names or generic words
- Use simple language a 12-year-old would understand
- If sources have limited information, acknowledge that
- MAX 2 sentences each for commonGround and keyDifferences
`.trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for Gemini

  try {
    const geminiResponse: any = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // NO tools/grounding - pure synthesis from provided context
    });

    clearTimeout(timeoutId);

    let text: string | undefined;
    if (geminiResponse?.response && typeof geminiResponse.response.text === 'function') {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
    }

    if (!text) {
      return {
        summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
        commonGround: '',
        keyDifferences: '',
      };
    }

    const parsed = extractJson(text);
    
    if (!parsed) {
      return {
        summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
        commonGround: '',
        keyDifferences: '',
      };
    }

    return {
      summary: (parsed.summary || '').trim(),
      commonGround: (parsed.commonGround || '').trim(),
      keyDifferences: (parsed.keyDifferences || '').trim(),
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Gemini synthesis error:', error?.message);
    
    // Return basic summary if Gemini fails
    return {
      summary: `We found **${searchResults.length} sources** covering this story. Click any source below to read their coverage.`,
      commonGround: '',
      keyDifferences: '',
    };
  }
}

// =============================================================================
// STEP 3: PROCESS RESULTS - Apply badges and sort
// =============================================================================
interface ProcessedSource {
  uri: string;
  title: string;
  displayName: string;
  sourceDomain: string;
  sourceType: SourceType;
  countryCode: string;
  isSyndicated: boolean;
}

function processSearchResults(cseResults: CSEResult[]): ProcessedSource[] {
  const seen = new Set<string>();
  const processed: ProcessedSource[] = [];

  for (const result of cseResults) {
    if (!result.domain || seen.has(result.domain)) continue;
    seen.add(result.domain);

    const sourceInfo = getSourceInfo(result.domain);
    
    processed.push({
      uri: result.url,
      title: result.title,
      displayName: sourceInfo.displayName,
      sourceDomain: result.domain,
      sourceType: sourceInfo.type,
      countryCode: sourceInfo.countryCode,
      isSyndicated: false, // CSE doesn't track syndication
    });
  }

  // Sort by source type priority (intelligence hierarchy)
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
    try { 
      body = await req.json(); 
    } catch { 
      const error = createError('INVALID_URL');
      return NextResponse.json(
        { error: 'Invalid request body', errorType: error.type, retryable: false },
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
      // User provided keywords directly
      searchQuery = body.keywords.trim();
      
      if (searchQuery.length < 3) {
        const error = createError('INVALID_KEYWORDS');
        return NextResponse.json(
          { error: 'Please enter at least a few keywords to search.', errorType: error.type, retryable: false },
          { status: error.statusCode, headers: corsHeaders }
        );
      }
    } else {
      // User provided URL - extract keywords
      const validation = validateUrl(body.url);
      if (!validation.valid && validation.error) {
        return NextResponse.json(
          { error: validation.error.userMessage, errorType: validation.error.type, retryable: validation.error.retryable },
          { status: validation.error.statusCode, headers: corsHeaders }
        );
      }

      const url = body.url.trim();
      isPaywalled = isPaywalledSource(url);
      
      const extractedKeywords = extractKeywordsFromUrl(url);
      
      if (!extractedKeywords) {
        // Opaque URL - need user to provide keywords
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
      
      searchQuery = extractedKeywords;
    }

    // 4. Increment Usage
    const { info: usageInfo, cookieValue } = await incrementUsage(req);

    // 5. STEP 1: THE EYES - Search with CSE
    console.log(`[CSE] Searching for: "${searchQuery}"`);
    const cseResults = await searchWithCSE(searchQuery);
    console.log(`[CSE] Found ${cseResults.length} results`);

    if (cseResults.length === 0) {
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
    console.log(`[Gemini] Synthesizing ${cseResults.length} sources...`);
    const intelBrief = await synthesizeWithGemini(cseResults, searchQuery);
    console.log(`[Gemini] Synthesis complete`);

    // 7. STEP 3: Process results with badges
    const alternatives = processSearchResults(cseResults);

    // 8. Build Response
    const response = NextResponse.json({
      summary: intelBrief.summary,
      commonGround: intelBrief.commonGround || null,
      keyDifferences: intelBrief.keyDifferences || null,
      alternatives,
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
    } else if (error.message?.includes('timeout') || error.message?.includes('aborted') || error.name === 'AbortError') {
      appError = createError('TIMEOUT');
    } else if (error.message?.includes('CSE API error')) {
      appError = createError('API_ERROR');
    } else {
      appError = createError('API_ERROR');
    }
    
    return NextResponse.json(
      { error: appError.userMessage, errorType: appError.type, retryable: appError.retryable },
      { status: appError.statusCode, headers: corsHeaders }
    );
  }
}