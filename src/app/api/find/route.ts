import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "../../../lib/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 25; // Reduced to avoid timeout

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

// --- Archive functions (fast, parallel) ---
interface ArchiveResult {
  found: boolean;
  url?: string;
  source: 'wayback' | 'archive.today';
}

async function checkWaybackMachine(url: string): Promise<ArchiveResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    
    const response = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MirrorSource/1.0' },
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) return { found: false, source: 'wayback' };
    
    const data = await response.json();
    const snapshot = data?.archived_snapshots?.closest;
    
    if (snapshot?.available && snapshot?.url) {
      return { found: true, url: snapshot.url, source: 'wayback' };
    }
    return { found: false, source: 'wayback' };
  } catch {
    return { found: false, source: 'wayback' };
  }
}

async function checkArchiveToday(url: string): Promise<ArchiveResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    
    const response = await fetch(`https://archive.today/newest/${encodeURIComponent(url)}`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)' },
    });
    
    clearTimeout(timeoutId);
    
    if (response.status === 301 || response.status === 302) {
      const archiveUrl = response.headers.get('location');
      if (archiveUrl) return { found: true, url: archiveUrl, source: 'archive.today' };
    }
    return { found: false, source: 'archive.today' };
  } catch {
    return { found: false, source: 'archive.today' };
  }
}

async function checkArchives(url: string): Promise<ArchiveResult[]> {
  const results = await Promise.allSettled([checkWaybackMachine(url), checkArchiveToday(url)]);
  return results
    .filter((r): r is PromiseFulfilledResult<ArchiveResult> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(r => r.found);
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
type SourceType = 'wire' | 'public' | 'corporate' | 'state' | 'analysis' | 'local' | 'national' | 'international' | 'magazine' | 'specialized' | 'reference' | 'syndication' | 'archive';

function getSourceInfo(domain: string): { displayName: string; type: SourceType; countryCode: string } {
  if (!domain) return { displayName: 'SOURCE', type: 'local', countryCode: 'US' };
  const lower = domain.toLowerCase();
  
  const sources: Record<string, { displayName: string; type: SourceType; countryCode: string }> = {
    'finance.yahoo.com': { displayName: 'YAHOO', type: 'syndication', countryCode: 'US' },
    'news.yahoo.com': { displayName: 'YAHOO', type: 'syndication', countryCode: 'US' },
    'msn.com': { displayName: 'MSN', type: 'syndication', countryCode: 'US' },
    'apnews.com': { displayName: 'AP NEWS', type: 'wire', countryCode: 'US' },
    'reuters.com': { displayName: 'REUTERS', type: 'wire', countryCode: 'UK' },
    'npr.org': { displayName: 'NPR', type: 'public', countryCode: 'US' },
    'pbs.org': { displayName: 'PBS', type: 'public', countryCode: 'US' },
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

async function resolveVertexRedirect(redirectUrl: string): Promise<{ url: string; title: string | null } | null> {
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return { url: redirectUrl, title: null };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)' },
    });

    clearTimeout(timeoutId);
    const finalUrl = response.url;
    
    if (!finalUrl.includes('vertexaisearch.cloud.google.com')) {
      return { url: finalUrl, title: null };
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

      const resolved = await resolveVertexRedirect(web.uri);
      if (!resolved) return null;

      const urlObj = new URL(resolved.url);
      const domain = urlObj.hostname.replace(/^www\./, '');

      let articleTitle = decodeHtmlEntities(resolved.title || web.title || domain);
      if (isErrorTitle(articleTitle) || !isEnglishContent(articleTitle)) return null;

      const sourceInfo = getSourceInfo(domain);
      const isSyndicated = syndicationPartners.some(partner => domain.includes(partner));

      return { uri: resolved.url, title: articleTitle, displayName: sourceInfo.displayName, sourceDomain: domain, sourceType: sourceInfo.type, countryCode: sourceInfo.countryCode, isSyndicated };
    } catch { return null; }
  };

  // Process only 6 chunks for speed
  const settled = await Promise.allSettled(chunks.slice(0, 6).map(processChunk));

  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value) {
      const item = result.value;
      if (!seen.has(item.sourceDomain)) {
        seen.add(item.sourceDomain);
        results.push(item);
      }
    }
  }

  // Sort by priority
  const typePriority: Record<SourceType, number> = {
    'syndication': 0, 'archive': 1, 'wire': 2, 'public': 3, 'state': 4,
    'international': 5, 'national': 6, 'corporate': 7, 'magazine': 8,
    'specialized': 9, 'analysis': 10, 'local': 11, 'reference': 12,
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

// --- Single Gemini call (NO RETRY) ---
async function callGemini(url: string, syndicationPartners: string[]): Promise<{
  summary: string;
  commonGround: string;
  keyDifferences: string;
  alternatives: any[];
}> {
  const syndicationHint = syndicationPartners.length > 0 
    ? `Also search on ${syndicationPartners.join(', ')}.`
    : '';

  const prompt = `
You are MirrorSource. Find alternative free sources for this article.

URL: "${url}"
${syndicationHint}

Find 3-8 news sources covering this story. Search: AP, Reuters, BBC, Guardian, CBS, NBC, ABC, CNN, NPR, PBS, Yahoo News, MSN, Al Jazeera, The Hill, Politico, Axios.

Return JSON only (no markdown):

{
  "summary": "3-5 sentences. Use **bold** for names, numbers, dates, outcomes. Grade 8-10 reading. NO citations.",
  "commonGround": "What sources agree on. Bold key facts. Only cite sources you found links for.",
  "keyDifferences": "Where sources differ. Bold **Source Name** and **claims**. Only cite sources you found links for."
}

IMPORTANT: In commonGround and keyDifferences, only mention sources that appear in your search results with actual article links.
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

  return { summary, commonGround, keyDifferences, alternatives };
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

    // Run archive check and Gemini in parallel
    const [archiveResults, geminiResult] = await Promise.all([
      checkArchives(url),
      callGemini(url, syndicationPartners),
    ]);

    const response = NextResponse.json({
      summary: geminiResult.summary,
      commonGround: geminiResult.commonGround,
      keyDifferences: geminiResult.keyDifferences,
      alternatives: geminiResult.alternatives,
      archives: archiveResults,
      isPaywalled,
      usage: usageInfo,
    }, { headers: corsHeaders });

    response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);
    return response;

  } catch (error: any) {
    console.error('Error in /api/find:', error);
    
    // More specific error for timeout
    if (error.message?.includes('timeout') || error.name === 'AbortError' || error.message?.includes('DEADLINE_EXCEEDED')) {
      return NextResponse.json(
        { error: 'Search timed out. Please try again - results vary each time.' },
        { status: 504, headers: corsHeaders }
      );
    }
    
    return NextResponse.json(
      { error: 'Search failed. Please try again - results vary each time.' },
      { status: 500, headers: corsHeaders }
    );
  }
}