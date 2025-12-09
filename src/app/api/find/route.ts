import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "../../../lib/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

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
    'finance.yahoo.com': { displayName: 'YAHOO', type: 'syndication', countryCode: 'US' },
    'news.yahoo.com': { displayName: 'YAHOO', type: 'syndication', countryCode: 'US' },
    'nz.news.yahoo.com': { displayName: 'YAHOO', type: 'syndication', countryCode: 'NZ' },
    'msn.com': { displayName: 'MSN', type: 'syndication', countryCode: 'US' },
    'apnews.com': { displayName: 'AP NEWS', type: 'wire', countryCode: 'US' },
    'reuters.com': { displayName: 'REUTERS', type: 'wire', countryCode: 'UK' },
    'npr.org': { displayName: 'NPR', type: 'public', countryCode: 'US' },
    'pbs.org': { displayName: 'PBS', type: 'public', countryCode: 'US' },
    'opb.org': { displayName: 'OPB', type: 'public', countryCode: 'US' },
    'bbc.com': { displayName: 'BBC', type: 'public', countryCode: 'UK' },
    'bbc.co.uk': { displayName: 'BBC', type: 'public', countryCode: 'UK' },
    'cbc.ca': { displayName: 'CBC', type: 'public', countryCode: 'CA' },
    'aljazeera.com': { displayName: 'AL JAZEERA', type: 'international', countryCode: 'QA' },
    'theguardian.com': { displayName: 'THE GUARDIAN', type: 'international', countryCode: 'UK' },
    'thehindu.com': { displayName: 'THE HINDU', type: 'international', countryCode: 'IN' },
    'cnn.com': { displayName: 'CNN', type: 'corporate', countryCode: 'US' },
    'foxnews.com': { displayName: 'FOX NEWS', type: 'corporate', countryCode: 'US' },
    'nbcnews.com': { displayName: 'NBC NEWS', type: 'corporate', countryCode: 'US' },
    'cbsnews.com': { displayName: 'CBS NEWS', type: 'corporate', countryCode: 'US' },
    'abcnews.go.com': { displayName: 'ABC NEWS', type: 'corporate', countryCode: 'US' },
    'politico.com': { displayName: 'POLITICO', type: 'analysis', countryCode: 'US' },
    'axios.com': { displayName: 'AXIOS', type: 'national', countryCode: 'US' },
    'usatoday.com': { displayName: 'USA TODAY', type: 'national', countryCode: 'US' },
    'thehill.com': { displayName: 'THE HILL', type: 'analysis', countryCode: 'US' },
    'forbes.com': { displayName: 'FORBES', type: 'magazine', countryCode: 'US' },
    'time.com': { displayName: 'TIME', type: 'magazine', countryCode: 'US' },
    'newsweek.com': { displayName: 'NEWSWEEK', type: 'magazine', countryCode: 'US' },
    'wired.com': { displayName: 'WIRED', type: 'specialized', countryCode: 'US' },
    'producer.com': { displayName: 'PRODUCER', type: 'specialized', countryCode: 'US' },
    'successfulfarming.com': { displayName: 'SUCCESSFUL FARMING', type: 'specialized', countryCode: 'US' },
    'startribune.com': { displayName: 'STAR TRIBUNE', type: 'local', countryCode: 'US' },
    'mint': { displayName: 'MINT', type: 'international', countryCode: 'IN' },
  };
  
  for (const [key, info] of Object.entries(sources)) {
    if (lower.includes(key)) return info;
  }
  
  let countryCode = 'US';
  if (lower.endsWith('.uk') || lower.endsWith('.co.uk')) countryCode = 'UK';
  else if (lower.endsWith('.ca')) countryCode = 'CA';
  else if (lower.endsWith('.au')) countryCode = 'AU';
  else if (lower.endsWith('.de')) countryCode = 'DE';
  else if (lower.endsWith('.in')) countryCode = 'IN';
  else if (lower.endsWith('.nz')) countryCode = 'NZ';
  else if (lower.endsWith('.sg')) countryCode = 'SG';
  
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
  return ['access denied', 'page not found', '404', '403', 'forbidden', 'error', 'blocked', 'captcha', 'just a moment'].some(p => lower.includes(p));
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

async function resolveVertexRedirect(redirectUrl: string): Promise<string | null> {
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return redirectUrl;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)' },
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
      if ((web.title || '').toLowerCase().includes('google')) return null;

      const resolvedUrl = await resolveVertexRedirect(web.uri);
      if (!resolvedUrl) return null;

      const urlObj = new URL(resolvedUrl);
      const domain = urlObj.hostname.replace(/^www\./, '');

      let articleTitle = decodeHtmlEntities(web.title || domain);
      if (isErrorTitle(articleTitle) || !isEnglishContent(articleTitle)) return null;

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

  // Process up to 10 chunks in parallel for maximum sources
  const settled = await Promise.allSettled(chunks.slice(0, 10).map(processChunk));

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

function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: 'URL is required' };
  }
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must start with http:// or https://' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// --- Gemini call optimized for maximum sources ---
async function callGemini(url: string, syndicationPartners: string[]): Promise<{
  summary: string;
  commonGround: string;
  keyDifferences: string;
  alternatives: any[];
  sourceNames: string[];
}> {
  const syndicationHint = syndicationPartners.length > 0 
    ? `Priority: search ${syndicationPartners.join(', ')} for syndicated versions.`
    : '';

  const prompt = `
Find alternative news sources for this article. Maximize the number of different sources found.

URL: "${url}"
${syndicationHint}

Search these outlets: AP News, Reuters, BBC, The Guardian, CBS News, NBC News, ABC News, CNN, NPR, PBS, Yahoo News, MSN, Al Jazeera, The Hill, Politico, Axios, Fox News, USA Today, Forbes, Time, Newsweek.

Return JSON only:
{
  "summary": "3-5 sentences summarizing the story. Use **bold** for key names, numbers, dates. Grade 8-10 reading level. No citations.",
  "sourceList": ["Guardian", "CBS News", "Yahoo"],
  "commonGround": "What these sources agree on. Bold key facts.",
  "keyDifferences": "How coverage differs. Format: **Source A** emphasizes X, while **Source B** focuses on Y. ONLY mention sources from sourceList."
}

CRITICAL: sourceList must contain the display names of sources you found. commonGround and keyDifferences can ONLY reference sources in sourceList.
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
  
  // Clean any citations that slipped through
  const citationRegex = /\s*\[\d+(?:,\s*\d+)*\]/g;
  let summary = (parsedData.summary || 'Summary not available.').replace(citationRegex, '');
  let commonGround = (parsedData.commonGround || '').replace(citationRegex, '');
  let keyDifferences = (parsedData.keyDifferences || '').replace(citationRegex, '');
  const sourceNames = parsedData.sourceList || [];

  // Get grounding chunks
  const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
  const groundingChunks = candidates[0]?.groundingMetadata?.groundingChunks ?? [];

  const alternatives = await processGroundingChunks(groundingChunks, syndicationPartners);

  return { summary, commonGround, keyDifferences, alternatives, sourceNames };
}

// --- Post-process Intel Brief to only reference found sources ---
function filterIntelBrief(
  commonGround: string, 
  keyDifferences: string, 
  foundSources: string[]
): { commonGround: string; keyDifferences: string } {
  // If we have very few sources, simplify the Intel Brief
  if (foundSources.length < 2) {
    return {
      commonGround: commonGround,
      keyDifferences: '' // Don't show differences if we only have 1 source
    };
  }
  
  return { commonGround, keyDifferences };
}

export async function POST(req: NextRequest) {
  try {
    const limitCheck = await checkRateLimit(req);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: `Daily limit reached. You have 0/${limitCheck.info.limit} remaining.` },
        { status: 429, headers: corsHeaders }
      );
    }

    let body: any;
    try { body = await req.json(); } 
    catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: corsHeaders }); }

    const validation = validateUrl(body.url);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: corsHeaders });
    }

    const url = body.url.trim();
    const { info: usageInfo, cookieValue } = await incrementUsage(req);
    const isPaywalled = isPaywalledSource(url);
    const syndicationPartners = getSyndicationPartners(url);

    // Single optimized Gemini call
    const result = await callGemini(url, syndicationPartners);
    
    // Get the display names of sources we actually found
    const foundSourceNames = result.alternatives.map(a => a.displayName);
    
    // Filter Intel Brief to only reference found sources
    const { commonGround, keyDifferences } = filterIntelBrief(
      result.commonGround, 
      result.keyDifferences, 
      foundSourceNames
    );

    const response = NextResponse.json({
      summary: result.summary,
      commonGround,
      keyDifferences,
      alternatives: result.alternatives,
      isPaywalled,
      usage: usageInfo,
    }, { headers: corsHeaders });

    response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
    return response;

  } catch (error: any) {
    console.error('Error in /api/find:', error);
    
    return NextResponse.json(
      { error: 'Search failed. Please try again - results vary each time.' },
      { status: 500, headers: corsHeaders }
    );
  }
}