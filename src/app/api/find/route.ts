import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage, COOKIE_OPTIONS } from "../../../lib/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

// CORS headers for extension support
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// --- Archive Result Types ---
interface ArchiveResult {
  found: boolean;
  url?: string;
  source: 'wayback' | 'archive.today';
  timestamp?: string;
}

// --- Check Wayback Machine ---
async function checkWaybackMachine(url: string): Promise<ArchiveResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MirrorSource/1.0' },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return { found: false, source: 'wayback' };
    
    const data = await response.json();
    const snapshot = data?.archived_snapshots?.closest;
    
    if (snapshot?.available && snapshot?.url) {
      return {
        found: true,
        url: snapshot.url,
        source: 'wayback',
        timestamp: snapshot.timestamp,
      };
    }
    
    return { found: false, source: 'wayback' };
  } catch (error) {
    console.log('Wayback check failed:', error);
    return { found: false, source: 'wayback' };
  }
}

// --- Check Archive.today ---
async function checkArchiveToday(url: string): Promise<ArchiveResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Archive.today returns the most recent snapshot at this URL pattern
    const checkUrl = `https://archive.today/newest/${encodeURIComponent(url)}`;
    
    const response = await fetch(checkUrl, {
      method: 'HEAD',
      redirect: 'manual', // Don't follow redirects, we just want to see if it exists
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)' },
    });
    
    clearTimeout(timeoutId);
    
    // If we get a redirect (301/302), an archive exists
    if (response.status === 301 || response.status === 302) {
      const archiveUrl = response.headers.get('location');
      if (archiveUrl) {
        return {
          found: true,
          url: archiveUrl,
          source: 'archive.today',
        };
      }
    }
    
    // Also check if we got a 200 (direct hit)
    if (response.status === 200) {
      return {
        found: true,
        url: checkUrl.replace('/newest/', '/'),
        source: 'archive.today',
      };
    }
    
    return { found: false, source: 'archive.today' };
  } catch (error) {
    console.log('Archive.today check failed:', error);
    return { found: false, source: 'archive.today' };
  }
}

// --- Check All Archives in Parallel ---
async function checkArchives(url: string): Promise<ArchiveResult[]> {
  const results = await Promise.allSettled([
    checkWaybackMachine(url),
    checkArchiveToday(url),
  ]);
  
  return results
    .filter((r): r is PromiseFulfilledResult<ArchiveResult> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(r => r.found);
}

// --- Syndication Partners Map ---
// Maps paywalled domains to their known free syndication partners
const SYNDICATION_PARTNERS: Record<string, string[]> = {
  'wsj.com': ['finance.yahoo.com', 'msn.com'],
  'bloomberg.com': ['finance.yahoo.com', 'msn.com', 'washingtonpost.com'],
  'nytimes.com': ['msn.com'],
  'washingtonpost.com': ['msn.com'],
  'ft.com': ['finance.yahoo.com', 'msn.com'],
  'economist.com': ['msn.com'],
  'businessinsider.com': ['finance.yahoo.com', 'msn.com'],
  'theatlantic.com': ['msn.com'],
  'wired.com': ['msn.com'],
};

// Known paywalled domains
const PAYWALLED_DOMAINS = new Set([
  'wsj.com', 'nytimes.com', 'washingtonpost.com', 'ft.com', 
  'economist.com', 'bloomberg.com', 'theatlantic.com', 'newyorker.com',
  'businessinsider.com', 'wired.com', 'latimes.com', 'bostonglobe.com',
]);

function isPaywalledSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    return Array.from(PAYWALLED_DOMAINS).some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

function getSyndicationPartners(url: string): string[] {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    for (const [domain, partners] of Object.entries(SYNDICATION_PARTNERS)) {
      if (hostname.includes(domain)) {
        return partners;
      }
    }
  } catch {}
  return [];
}

// --- Source type classification ---
type SourceType = 'wire' | 'public' | 'corporate' | 'state' | 'analysis' | 'local' | 'national' | 'international' | 'magazine' | 'specialized' | 'reference' | 'syndication' | 'archive';

interface SourceInfo {
  displayName: string;
  type: SourceType;
  countryCode: string;
}

function getSourceInfo(domain: string): SourceInfo {
  if (!domain) return { displayName: 'SOURCE', type: 'local', countryCode: 'US' };
  
  const lower = domain.toLowerCase();
  
  // Syndication/Aggregator sites (prioritize these for paywall bypass)
  if (lower.includes('finance.yahoo.com') || lower.includes('news.yahoo.com')) return { displayName: 'YAHOO', type: 'syndication', countryCode: 'US' };
  if (lower.includes('msn.com')) return { displayName: 'MSN', type: 'syndication', countryCode: 'US' };
  
  // Wire Services
  if (lower.includes('apnews.com')) return { displayName: 'AP NEWS', type: 'wire', countryCode: 'US' };
  if (lower.includes('reuters.com')) return { displayName: 'REUTERS', type: 'wire', countryCode: 'UK' };
  if (lower.includes('afp.com')) return { displayName: 'AFP', type: 'wire', countryCode: 'FR' };
  
  // Public Broadcasting
  if (lower.includes('npr.org')) return { displayName: 'NPR', type: 'public', countryCode: 'US' };
  if (lower.includes('pbs.org')) return { displayName: 'PBS', type: 'public', countryCode: 'US' };
  if (lower.includes('bbc.com') || lower.includes('bbc.co.uk')) return { displayName: 'BBC', type: 'public', countryCode: 'UK' };
  if (lower.includes('cbc.ca')) return { displayName: 'CBC', type: 'public', countryCode: 'CA' };
  
  // Government / State sources
  if (lower.includes('.gov')) return { displayName: domain.split('.')[0].toUpperCase(), type: 'state', countryCode: 'US' };
  if (lower.includes('usda.gov')) return { displayName: 'USDA', type: 'state', countryCode: 'US' };
  
  // Major International
  if (lower.includes('aljazeera.com')) return { displayName: 'AL JAZEERA', type: 'international', countryCode: 'QA' };
  if (lower.includes('theguardian.com')) return { displayName: 'THE GUARDIAN', type: 'international', countryCode: 'UK' };
  if (lower.includes('scmp.com')) return { displayName: 'SCMP', type: 'international', countryCode: 'CN' };
  if (lower.includes('globalnews.ca')) return { displayName: 'GLOBAL NEWS', type: 'international', countryCode: 'CA' };
  if (lower.includes('ctvnews.ca')) return { displayName: 'CTV NEWS', type: 'international', countryCode: 'CA' };
  if (lower.includes('dw.com')) return { displayName: 'DW', type: 'international', countryCode: 'DE' };
  if (lower.includes('france24.com')) return { displayName: 'FRANCE 24', type: 'international', countryCode: 'FR' };
  if (lower.includes('abc.net.au')) return { displayName: 'ABC AU', type: 'public', countryCode: 'AU' };
  if (lower.includes('smh.com.au')) return { displayName: 'SMH', type: 'national', countryCode: 'AU' };
  if (lower.includes('thehindu.com')) return { displayName: 'THE HINDU', type: 'international', countryCode: 'IN' };
  
  // Major US National
  if (lower.includes('nytimes.com')) return { displayName: 'NY TIMES', type: 'national', countryCode: 'US' };
  if (lower.includes('washingtonpost.com')) return { displayName: 'WASHINGTON POST', type: 'national', countryCode: 'US' };
  if (lower.includes('cnn.com')) return { displayName: 'CNN', type: 'corporate', countryCode: 'US' };
  if (lower.includes('foxnews.com')) return { displayName: 'FOX NEWS', type: 'corporate', countryCode: 'US' };
  if (lower.includes('nbcnews.com')) return { displayName: 'NBC NEWS', type: 'corporate', countryCode: 'US' };
  if (lower.includes('cbsnews.com')) return { displayName: 'CBS NEWS', type: 'corporate', countryCode: 'US' };
  if (lower.includes('abcnews.go.com')) return { displayName: 'ABC NEWS', type: 'corporate', countryCode: 'US' };
  if (lower.includes('politico.com')) return { displayName: 'POLITICO', type: 'analysis', countryCode: 'US' };
  if (lower.includes('axios.com')) return { displayName: 'AXIOS', type: 'national', countryCode: 'US' };
  if (lower.includes('usatoday.com')) return { displayName: 'USA TODAY', type: 'national', countryCode: 'US' };
  if (lower.includes('thehill.com')) return { displayName: 'THE HILL', type: 'analysis', countryCode: 'US' };
  if (lower.includes('semafor.com')) return { displayName: 'SEMAFOR', type: 'analysis', countryCode: 'US' };
  
  // Business / Finance
  if (lower.includes('wsj.com')) return { displayName: 'WSJ', type: 'corporate', countryCode: 'US' };
  if (lower.includes('bloomberg.com')) return { displayName: 'BLOOMBERG', type: 'corporate', countryCode: 'US' };
  if (lower.includes('ft.com')) return { displayName: 'FT', type: 'corporate', countryCode: 'UK' };
  if (lower.includes('cnbc.com')) return { displayName: 'CNBC', type: 'corporate', countryCode: 'US' };
  if (lower.includes('marketwatch.com')) return { displayName: 'MARKETWATCH', type: 'corporate', countryCode: 'US' };
  if (lower.includes('investing.com')) return { displayName: 'INVESTING', type: 'specialized', countryCode: 'US' };
  
  // Magazines
  if (lower.includes('time.com')) return { displayName: 'TIME', type: 'magazine', countryCode: 'US' };
  if (lower.includes('newsweek.com')) return { displayName: 'NEWSWEEK', type: 'magazine', countryCode: 'US' };
  if (lower.includes('forbes.com')) return { displayName: 'FORBES', type: 'magazine', countryCode: 'US' };
  if (lower.includes('businessinsider.com')) return { displayName: 'BUSINESS INSIDER', type: 'magazine', countryCode: 'US' };
  if (lower.includes('economist.com')) return { displayName: 'THE ECONOMIST', type: 'magazine', countryCode: 'UK' };
  if (lower.includes('theatlantic.com')) return { displayName: 'THE ATLANTIC', type: 'analysis', countryCode: 'US' };
  if (lower.includes('newyorker.com')) return { displayName: 'THE NEW YORKER', type: 'analysis', countryCode: 'US' };
  if (lower.includes('wired.com')) return { displayName: 'WIRED', type: 'specialized', countryCode: 'US' };
  if (lower.includes('techcrunch.com')) return { displayName: 'TECHCRUNCH', type: 'specialized', countryCode: 'US' };
  if (lower.includes('theverge.com')) return { displayName: 'THE VERGE', type: 'specialized', countryCode: 'US' };
  if (lower.includes('arstechnica.com')) return { displayName: 'ARS TECHNICA', type: 'specialized', countryCode: 'US' };
  
  // Agriculture / Specialized
  if (lower.includes('agriculture.com') || lower.includes('agri')) return { displayName: domain.split('.')[0].toUpperCase(), type: 'specialized', countryCode: 'US' };
  if (lower.includes('farm')) return { displayName: domain.split('.')[0].toUpperCase(), type: 'specialized', countryCode: 'US' };
  
  // Reference
  if (lower.includes('wikipedia.org')) return { displayName: 'WIKIPEDIA', type: 'reference', countryCode: 'INT' };
  
  // Archives
  if (lower.includes('archive.org') || lower.includes('web.archive.org')) return { displayName: 'WAYBACK MACHINE', type: 'archive', countryCode: 'US' };
  if (lower.includes('archive.today') || lower.includes('archive.is') || lower.includes('archive.ph')) return { displayName: 'ARCHIVE.TODAY', type: 'archive', countryCode: 'INT' };
  
  // Try to detect country from TLD
  let countryCode = 'US';
  if (lower.endsWith('.uk') || lower.endsWith('.co.uk')) countryCode = 'UK';
  else if (lower.endsWith('.ca')) countryCode = 'CA';
  else if (lower.endsWith('.au')) countryCode = 'AU';
  else if (lower.endsWith('.de')) countryCode = 'DE';
  else if (lower.endsWith('.fr')) countryCode = 'FR';
  else if (lower.endsWith('.jp')) countryCode = 'JP';
  else if (lower.endsWith('.in')) countryCode = 'IN';
  else if (lower.endsWith('.eu')) countryCode = 'EU';
  
  // Default: local news
  const parts = domain.split('.');
  if (parts.length > 2 && parts[0].length <= 3) {
    return { displayName: parts[1].toUpperCase(), type: 'local', countryCode };
  }
  return { displayName: parts[0].toUpperCase(), type: 'local', countryCode };
}

// --- Decode HTML entities ---
function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D');
}

// --- Check if text is primarily English ---
function isEnglishContent(text: string): boolean {
  if (!text) return false;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const nonLatinChars = (text.match(/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0600-\u06FF]/g) || []).length;
  const totalAlpha = latinChars + nonLatinChars;
  return totalAlpha === 0 || (latinChars / totalAlpha) > 0.7;
}

// --- Check if title indicates an error page ---
function isErrorTitle(title: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  const errorPatterns = ['access denied', 'page not found', '404', '403', 'forbidden', 'error', 'blocked', 'captcha', 'just a moment'];
  return errorPatterns.some(pattern => lower.includes(pattern));
}

// --- JSON helpers ---
function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "");
  }
  return cleaned.trim();
}

function extractJson(text: string): any {
  let cleaned = cleanJsonText(text);
  try { return JSON.parse(cleaned); } catch {}
  
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)); } catch {}
  }
  
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    return { summary: summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") };
  }
  return null;
}

// --- Extract title from HTML ---
function extractPageTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = decodeHtmlEntities(titleMatch[1].trim());
    if (title.length > 10 && !isErrorTitle(title) && isEnglishContent(title)) {
      return title;
    }
  }
  
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch) {
    const title = decodeHtmlEntities(ogMatch[1].trim());
    if (!isErrorTitle(title) && isEnglishContent(title)) return title;
  }
  
  return null;
}

// --- Resolve Vertex redirect with SAFE error handling ---
async function resolveVertexRedirect(redirectUrl: string): Promise<{ url: string; title: string | null } | null> {
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return { url: redirectUrl, title: null };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeoutId);

    let finalUrl = response.url;
    
    if (!finalUrl.includes('vertexaisearch.cloud.google.com')) {
      const html = await response.text();
      const pageTitle = extractPageTitle(html);
      return { url: finalUrl, title: pageTitle };
    }
    
    const html = await response.text();
    
    const urlMatch = html.match(/https?:\/\/(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\/[^\s"'<>]+/gi);
    if (urlMatch) {
      const realUrl = urlMatch.find(u => 
        !u.includes('google.com') && 
        !u.includes('vertexai') &&
        !u.includes('googleapis')
      );
      if (realUrl) {
        return { url: realUrl, title: null };
      }
    }
    
    return null;
  } catch (error) {
    console.log('Redirect resolution skipped:', redirectUrl.substring(0, 50));
    return null;
  }
}

// --- Process grounding chunks ---
async function processGroundingChunks(
  chunks: any[],
  existingDomains: Set<string> = new Set(),
  syndicationPartners: string[] = []
): Promise<Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType; countryCode: string; isSyndicated: boolean }>> {
  const results: Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType; countryCode: string; isSyndicated: boolean }> = [];
  const seen = new Set<string>(existingDomains);

  const processChunk = async (chunk: any) => {
    try {
      const web = chunk?.web;
      if (!web?.uri) return null;

      const chunkTitle = (web.title || '').toLowerCase();
      if (chunkTitle.includes('google') || chunkTitle.includes('vertexai')) return null;

      const resolved = await resolveVertexRedirect(web.uri);
      if (!resolved) return null;

      const urlObj = new URL(resolved.url);
      const domain = urlObj.hostname.replace(/^www\./, '');

      let articleTitle = resolved.title || web.title || domain;
      articleTitle = decodeHtmlEntities(articleTitle);
      
      if (isErrorTitle(articleTitle)) return null;
      if (!isEnglishContent(articleTitle)) return null;

      const sourceInfo = getSourceInfo(domain);
      
      // Check if this is a syndicated version
      const isSyndicated = syndicationPartners.some(partner => domain.includes(partner));

      return {
        uri: resolved.url,
        title: articleTitle,
        displayName: sourceInfo.displayName,
        sourceDomain: domain,
        sourceType: sourceInfo.type,
        countryCode: sourceInfo.countryCode,
        isSyndicated,
      };
    } catch {
      return null;
    }
  };

  const resolvePromises = chunks.slice(0, 10).map(processChunk);
  const settled = await Promise.allSettled(resolvePromises);

  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value) {
      const item = result.value;
      if (!seen.has(item.sourceDomain)) {
        seen.add(item.sourceDomain);
        results.push(item);
      }
    }
  }

  // Sort: syndicated sources first, then by type priority
  const typePriority: Record<SourceType, number> = {
    'syndication': 0,
    'archive': 1,
    'wire': 2,
    'public': 3,
    'state': 4,
    'international': 5,
    'national': 6,
    'corporate': 7,
    'magazine': 8,
    'specialized': 9,
    'analysis': 10,
    'local': 11,
    'reference': 12,
  };

  results.sort((a, b) => {
    if (a.isSyndicated !== b.isSyndicated) return a.isSyndicated ? -1 : 1;
    return typePriority[a.sourceType] - typePriority[b.sourceType];
  });

  return results;
}

// --- Configuration ---
const MIN_SOURCES_THRESHOLD = 3;

// --- URL Validation ---
function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    return { valid: false, error: "URL is required" };
  }
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "URL must start with http:// or https://" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

// --- Core Gemini call function ---
async function callGemini(url: string, syndicationPartners: string[], isRetry: boolean = false): Promise<{
  summary: string;
  commonGround: string;
  keyDifferences: string;
  alternatives: any[];
}> {
  // If we have syndication partners, include them in the search hint
  const syndicationHint = syndicationPartners.length > 0 
    ? `Also specifically search for this article on: ${syndicationPartners.join(', ')}.`
    : '';

const prompt = isRetry
    ? `
You are MirrorSource, a media intelligence analyst.

TASK: Search broadly for news coverage of: "${url}"
Find wire services (AP, Reuters), international (BBC, Guardian), and aggregators (Yahoo, MSN).
${syndicationHint}

CRITICAL FORMATTING REQUIREMENT - YOU MUST USE **DOUBLE ASTERISKS** FOR BOLD:
Every entity name, number, date, and key outcome MUST be wrapped in **double asterisks**.

SUMMARY (3-5 sentences, Grade 8-10 reading level, NO CITATIONS):
- Bold ALL entities: **President Trump**, **Nvidia**, **China**, **H200 chips**
- Bold ALL numbers: **$12 billion**, **25%**, **December 8, 2025**
- Bold ALL outcomes: **approved**, **announced**, **excluded**

INTEL BRIEF:
- commonGround: Bold the key fact everyone agrees on
- keyDifferences: Bold source names AND their conflicting claims

EXAMPLE OUTPUT:
{
  "summary": "**President Trump** announced a new policy permitting **Nvidia** to export its **H200 AI chips** to **China**. This deal mandates **25%** of sales revenue goes to the **U.S. government**. The announcement was made on **Monday, December 8, 2025**.",
  "commonGround": "All sources confirm **President Trump** approved **Nvidia's H200 chip** exports to **China** with a **25% revenue share** to the U.S. government.",
  "keyDifferences": "**CBS News** reports the deal as a **diplomatic breakthrough**, while **The Guardian** frames it as **controversial** given prior chip restrictions."
}

Return ONLY valid JSON. No markdown blocks. No citations like [1] or [2].
    `.trim()
    : `
You are MirrorSource, a media intelligence analyst. Your audience is "Alex"—a busy professional who needs facts in 10 seconds.

TASK: Search for news coverage of: "${url}"
${syndicationHint}
Find 3-8 alternative sources.

═══════════════════════════════════════════════════════════════
CRITICAL: BOLD FORMATTING IS MANDATORY
You MUST wrap key information in **double asterisks** for bold.
═══════════════════════════════════════════════════════════════

COMPONENT 1: SUMMARY
- Reading Level: Grade 8-10. Plain English. Short sentences.
- Length: 3-5 sentences. No sentence over 20 words.
- NO CITATIONS. Do not include [1], [2], [3] or any bracketed numbers.

MANDATORY BOLDING in Summary (use **double asterisks**):
✓ Entity names: **President Trump**, **Nvidia**, **China**, **U.S. farmers**
✓ Numbers/amounts: **$12 billion**, **25%**, **H200 chips**
✓ Dates: **December 8, 2025**, **February 2026**
✓ Key outcomes: **approved**, **announced**, **rejected**, **excluded**

✗ DO NOT bold: adjectives (massive, significant), common verbs, articles (the, a)

COMPONENT 2: INTEL BRIEF
- Reading Level: Grade 12-14 (Professional).

commonGround: One sentence. Bold the consensus facts:
"All sources confirm **[key entity]** did **[action]** involving **[amount/detail]**."

keyDifferences: One sentence. Bold source names AND conflicting claims:
"**[Source A]** reports **[claim X]**, while **[Source B]** says **[claim Y]**."

═══════════════════════════════════════════════════════════════
EXAMPLE OUTPUT (follow this format exactly):
═══════════════════════════════════════════════════════════════
{
  "summary": "**President Trump** announced a new policy allowing **Nvidia** to export **H200 AI chips** to **China**. The deal requires **25%** of sales revenue to go to the **U.S. government**. **Chinese President Xi Jinping** reportedly welcomed the decision. **Nvidia's** more advanced **Blackwell** and **Rubin** chips are **not included** in this agreement.",
  "commonGround": "All sources confirm **President Trump** approved **Nvidia's H200 chip** sales to **China** on **December 8, 2025**, with **25%** of revenue going to the U.S. government.",
  "keyDifferences": "**CBS News** emphasizes the **diplomatic significance**, while **The Hindu** focuses on **China's positive response** to the policy shift."
}

Return ONLY valid JSON. No markdown code blocks. NO CITATIONS [1][2][3].
    `.trim();

  const config: any = { tools: [{ googleSearch: {} }] };

  const geminiResponse: any = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config,
  });

  // Extract Text
  let text: string | undefined;
  if (geminiResponse?.response && typeof geminiResponse.response.text === "function") {
    text = geminiResponse.response.text();
  } else if (Array.isArray(geminiResponse?.candidates)) {
    text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
  }

  if (!text) throw new Error("Model response did not contain text.");

  // Parse JSON
  const parsedData = extractJson(text) || {};
  let summary = parsedData.summary || "Summary not available.";
  let commonGround = parsedData.commonGround || "";
  let keyDifferences = parsedData.keyDifferences || "";
  
  // Post-process: Remove any citations that slipped through
  const citationRegex = /\s*\[\d+(?:,\s*\d+)*\]/g;
  summary = summary.replace(citationRegex, '');
  commonGround = commonGround.replace(citationRegex, '');
  keyDifferences = keyDifferences.replace(citationRegex, '');

  // Get grounding chunks
  const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
  const groundingMetadata = candidates[0]?.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks ?? [];

  // Process alternatives
  let alternatives: any[] = [];
  try {
    alternatives = await processGroundingChunks(groundingChunks, new Set(), syndicationPartners);
  } catch (e) {
    console.error("Error processing grounding chunks:", e);
  }

  return { summary, commonGround, keyDifferences, alternatives };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limit Check
    const limitCheck = await checkRateLimit(req);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: `Daily limit reached. You have 0/${limitCheck.info.limit} remaining.` },
        { status: 429, headers: corsHeaders }
      );
    }

    // 2. Parse and Validate URL
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: corsHeaders }
      );
    }

    const validation = validateUrl(body.url);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const url = body.url.trim();

    // 3. Increment Usage
    const { info: usageInfo, cookieValue } = await incrementUsage(req);

    // 4. Check if source is paywalled and get syndication partners
    const isPaywalled = isPaywalledSource(url);
    const syndicationPartners = getSyndicationPartners(url);

    // 5. Check archives in parallel with Gemini call
    const [archiveResults, geminiResult] = await Promise.all([
      checkArchives(url),
      callGemini(url, syndicationPartners, false),
    ]);

    let result = geminiResult;

    // 6. Auto-retry if too few sources
    if (result.alternatives.length < MIN_SOURCES_THRESHOLD) {
      console.log(`Only ${result.alternatives.length} sources found, retrying...`);
      
      try {
        const retryResult = await callGemini(url, syndicationPartners, true);
        
        const existingDomains = new Set(result.alternatives.map(a => a.sourceDomain));
        const newAlternatives = retryResult.alternatives.filter(
          a => !existingDomains.has(a.sourceDomain)
        );
        
        result.alternatives = [...result.alternatives, ...newAlternatives];
        
      } catch (retryError) {
        console.error("Retry failed, using original results:", retryError);
      }
    }

    // 7. Build response
    const response = NextResponse.json({
      summary: result.summary,
      commonGround: result.commonGround,
      keyDifferences: result.keyDifferences,
      alternatives: result.alternatives,
      archives: archiveResults,
      isPaywalled,
      usage: usageInfo,
    }, { headers: corsHeaders });

    response.cookies.set(COOKIE_OPTIONS.name, cookieValue, COOKIE_OPTIONS);

    return response;

  } catch (error: any) {
    console.error("Error in /api/find route:", error);
    
    // User-friendly error messages
    let userMessage = "Something went wrong. Please try again.";
    let statusCode = 500;
    
    if (error.message?.includes("fetch") || error.message?.includes("ENOTFOUND")) {
      userMessage = "Unable to connect. Please check your internet connection.";
      statusCode = 503;
    } else if (error.message?.includes("timeout") || error.name === "AbortError") {
      userMessage = "The request took too long. Please try again.";
      statusCode = 504;
    } else if (error.message?.includes("quota") || error.status === 429) {
      userMessage = "Service temporarily unavailable. Please try again later.";
      statusCode = 503;
    }
    
    return NextResponse.json(
      { error: userMessage },
      { status: statusCode, headers: corsHeaders }
    );
  }
}