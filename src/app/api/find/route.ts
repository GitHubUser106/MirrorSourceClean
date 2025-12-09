import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "../../../lib/rate-limiter";

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
type ErrorType = 'INVALID_URL' | 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMITED' | 'API_ERROR';

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
type SourceType = 'wire' | 'public' | 'corporate' | 'state' | 'analysis' | 'local' | 'national' | 'international' | 'magazine' | 'specialized' | 'reference' | 'syndication';

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
    'scmp.com': { displayName: 'SCMP', type: 'international', countryCode: 'CN' },
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
    'thehill.com': { displayName: 'THE HILL', type: 'analysis', countryCode: 'US' },
    'politico.com': { displayName: 'POLITICO', type: 'analysis', countryCode: 'US' },
    // Magazines
    'forbes.com': { displayName: 'FORBES', type: 'magazine', countryCode: 'US' },
    'time.com': { displayName: 'TIME', type: 'magazine', countryCode: 'US' },
    'newsweek.com': { displayName: 'NEWSWEEK', type: 'magazine', countryCode: 'US' },
    'economist.com': { displayName: 'THE ECONOMIST', type: 'magazine', countryCode: 'UK' },
    // Specialized
    'wired.com': { displayName: 'WIRED', type: 'specialized', countryCode: 'US' },
    'techcrunch.com': { displayName: 'TECHCRUNCH', type: 'specialized', countryCode: 'US' },
    'theverge.com': { displayName: 'THE VERGE', type: 'specialized', countryCode: 'US' },
    'producer.com': { displayName: 'PRODUCER', type: 'specialized', countryCode: 'US' },
    'successfulfarming.com': { displayName: 'SUCCESSFUL FARMING', type: 'specialized', countryCode: 'US' },
    'livemint.com': { displayName: 'MINT', type: 'specialized', countryCode: 'IN' },
  };
  
  for (const [key, info] of Object.entries(sources)) {
    if (lower.includes(key)) return info;
  }
  
  // Country from TLD
  let countryCode = 'US';
  if (lower.endsWith('.uk') || lower.endsWith('.co.uk')) countryCode = 'UK';
  else if (lower.endsWith('.ca')) countryCode = 'CA';
  else if (lower.endsWith('.au')) countryCode = 'AU';
  else if (lower.endsWith('.de')) countryCode = 'DE';
  else if (lower.endsWith('.in')) countryCode = 'IN';
  else if (lower.endsWith('.nz')) countryCode = 'NZ';
  else if (lower.endsWith('.ie')) countryCode = 'IE';
  else if (lower.endsWith('.fr')) countryCode = 'FR';
  
  const parts = domain.split('.');
  return { displayName: parts[0].toUpperCase(), type: 'local', countryCode };
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
  // Skip Google's redirect URLs
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

  // Process up to 15 chunks in parallel for maximum source coverage
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

  // Sort: syndicated first, then by type priority
  const typePriority: Record<SourceType, number> = {
    'syndication': 0, 'wire': 1, 'public': 2, 'state': 3,
    'international': 4, 'national': 5, 'corporate': 6, 'magazine': 7,
    'specialized': 8, 'analysis': 9, 'local': 10, 'reference': 11,
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

// --- Gemini Call (Optimized for Maximum Sources) ---
async function callGemini(url: string, syndicationPartners: string[]): Promise<{
  summary: string;
  commonGround: string;
  keyDifferences: string;
  alternatives: any[];
}> {
  const syndicationHint = syndicationPartners.length > 0 
    ? `PRIORITY: Search for syndicated versions on ${syndicationPartners.join(', ')}.`
    : '';

  // Optimized prompt for finding multiple sources
  const prompt = `
You are a news research assistant. Your goal is to find as many alternative news sources as possible covering the same story.

ARTICLE URL: ${url}
${syndicationHint}

INSTRUCTIONS:
1. Search for this exact story across multiple news outlets
2. Find at least 5-10 different sources covering this story
3. Prioritize: Wire services (AP, Reuters), major networks (CBS, NBC, ABC, CNN, Fox), public media (NPR, PBS, BBC), international (Guardian, Al Jazeera), and news aggregators (Yahoo News, MSN)

RESPONSE FORMAT (JSON only, no markdown):
{
  "summary": "3-5 sentence summary of the story. Use **bold** for key names, numbers, dates. Grade 8-10 reading level. No citations.",
  "commonGround": "What all sources agree on. Use **bold** for key facts.",
  "keyDifferences": "Where sources differ in their coverage or framing. Use **bold** for source names and claims."
}

Focus on finding the MAXIMUM number of alternative sources. Quality and quantity of sources is the primary goal.
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
  
  // Clean citations
  const citationRegex = /\s*\[\d+(?:,\s*\d+)*\]/g;
  let summary = (parsedData.summary || 'Summary not available.').replace(citationRegex, '');
  let commonGround = (parsedData.commonGround || '').replace(citationRegex, '');
  let keyDifferences = (parsedData.keyDifferences || '').replace(citationRegex, '');

  // Get grounding chunks
  const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
  const groundingChunks = candidates[0]?.groundingMetadata?.groundingChunks ?? [];

  const alternatives = await processGroundingChunks(groundingChunks, syndicationPartners);

  // If we have very few sources, clear keyDifferences (can't compare with 1 source)
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

    // 3. Validate URL
    const validation = validateUrl(body.url);
    if (!validation.valid && validation.error) {
      return NextResponse.json(
        { error: validation.error.userMessage, errorType: validation.error.type, retryable: validation.error.retryable },
        { status: validation.error.statusCode, headers: corsHeaders }
      );
    }

    const url = body.url.trim();
    
    // 4. Increment Usage
    const { info: usageInfo, cookieValue } = await incrementUsage(req);
    
    // 5. Get Source Info
    const isPaywalled = isPaywalledSource(url);
    const syndicationPartners = getSyndicationPartners(url);

    // 6. Call Gemini
    const result = await callGemini(url, syndicationPartners);

    // 7. Build Response
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
    
    // Determine error type
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