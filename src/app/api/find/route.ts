import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage } from "../../../lib/rate-limiter";

export const dynamic = "force-dynamic";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

// --- Source type classification ---
type SourceType = 'wire' | 'national' | 'international' | 'local' | 'public' | 'magazine' | 'reference';

interface SourceInfo {
  displayName: string;
  type: SourceType;
}

function getSourceInfo(domain: string): SourceInfo {
  if (!domain) return { displayName: 'SOURCE', type: 'local' };
  
  const lower = domain.toLowerCase();
  
  // Wire Services
  if (lower.includes('apnews.com')) return { displayName: 'AP NEWS', type: 'wire' };
  if (lower.includes('reuters.com')) return { displayName: 'REUTERS', type: 'wire' };
  if (lower.includes('afp.com')) return { displayName: 'AFP', type: 'wire' };
  if (lower.includes('upi.com')) return { displayName: 'UPI', type: 'wire' };
  
  // Public Broadcasting
  if (lower.includes('npr.org')) return { displayName: 'NPR', type: 'public' };
  if (lower.includes('pbs.org')) return { displayName: 'PBS', type: 'public' };
  if (lower.includes('bbc.com') || lower.includes('bbc.co.uk')) return { displayName: 'BBC', type: 'public' };
  if (lower.includes('cbc.ca')) return { displayName: 'CBC', type: 'public' };
  if (lower.includes('abc.net.au')) return { displayName: 'ABC AU', type: 'public' };
  
  // Major International
  if (lower.includes('aljazeera.com')) return { displayName: 'AL JAZEERA', type: 'international' };
  if (lower.includes('dw.com')) return { displayName: 'DW', type: 'international' };
  if (lower.includes('france24.com')) return { displayName: 'FRANCE 24', type: 'international' };
  if (lower.includes('scmp.com')) return { displayName: 'SCMP', type: 'international' };
  if (lower.includes('theguardian.com')) return { displayName: 'THE GUARDIAN', type: 'international' };
  if (lower.includes('independent.co.uk')) return { displayName: 'THE INDEPENDENT', type: 'international' };
  if (lower.includes('telegraph.co.uk')) return { displayName: 'THE TELEGRAPH', type: 'international' };
  if (lower.includes('dailymail.co.uk')) return { displayName: 'DAILY MAIL', type: 'international' };
  if (lower.includes('sky.com')) return { displayName: 'SKY NEWS', type: 'international' };
  if (lower.includes('globalnews.ca')) return { displayName: 'GLOBAL NEWS', type: 'international' };
  if (lower.includes('ctvnews.ca')) return { displayName: 'CTV NEWS', type: 'international' };
  
  // Major US National
  if (lower.includes('nytimes.com')) return { displayName: 'NY TIMES', type: 'national' };
  if (lower.includes('washingtonpost.com')) return { displayName: 'WASHINGTON POST', type: 'national' };
  if (lower.includes('wsj.com')) return { displayName: 'WSJ', type: 'national' };
  if (lower.includes('usatoday.com')) return { displayName: 'USA TODAY', type: 'national' };
  if (lower.includes('latimes.com')) return { displayName: 'LA TIMES', type: 'national' };
  if (lower.includes('cnn.com')) return { displayName: 'CNN', type: 'national' };
  if (lower.includes('foxnews.com')) return { displayName: 'FOX NEWS', type: 'national' };
  if (lower.includes('nbcnews.com')) return { displayName: 'NBC NEWS', type: 'national' };
  if (lower.includes('abcnews.go.com')) return { displayName: 'ABC NEWS', type: 'national' };
  if (lower.includes('cbsnews.com')) return { displayName: 'CBS NEWS', type: 'national' };
  if (lower.includes('msnbc.com')) return { displayName: 'MSNBC', type: 'national' };
  if (lower.includes('politico.com')) return { displayName: 'POLITICO', type: 'national' };
  if (lower.includes('thehill.com')) return { displayName: 'THE HILL', type: 'national' };
  if (lower.includes('axios.com')) return { displayName: 'AXIOS', type: 'national' };
  if (lower.includes('cnbc.com')) return { displayName: 'CNBC', type: 'national' };
  if (lower.includes('bloomberg.com')) return { displayName: 'BLOOMBERG', type: 'national' };
  
  // Magazines / Long-form
  if (lower.includes('time.com')) return { displayName: 'TIME', type: 'magazine' };
  if (lower.includes('newsweek.com')) return { displayName: 'NEWSWEEK', type: 'magazine' };
  if (lower.includes('theatlantic.com')) return { displayName: 'THE ATLANTIC', type: 'magazine' };
  if (lower.includes('newyorker.com')) return { displayName: 'NEW YORKER', type: 'magazine' };
  if (lower.includes('forbes.com')) return { displayName: 'FORBES', type: 'magazine' };
  if (lower.includes('businessinsider.com')) return { displayName: 'BUSINESS INSIDER', type: 'magazine' };
  if (lower.includes('wired.com')) return { displayName: 'WIRED', type: 'magazine' };
  if (lower.includes('economist.com')) return { displayName: 'THE ECONOMIST', type: 'magazine' };
  
  // Reference
  if (lower.includes('wikipedia.org')) return { displayName: 'WIKIPEDIA', type: 'reference' };
  
  // Aggregators (treat as national for credibility)
  if (lower.includes('yahoo.com')) return { displayName: 'YAHOO NEWS', type: 'national' };
  if (lower.includes('msn.com')) return { displayName: 'MSN', type: 'national' };
  if (lower.includes('news.google.com')) return { displayName: 'GOOGLE NEWS', type: 'national' };
  
  // Default: assume local news
  const parts = domain.split('.');
  if (parts.length > 2 && parts[0].length <= 3) {
    return { displayName: parts[1].toUpperCase(), type: 'local' };
  }
  return { displayName: parts[0].toUpperCase(), type: 'local' };
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

// --- Check if text is primarily English/Latin ---
function isEnglishContent(text: string): boolean {
  if (!text) return false;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const nonLatinChars = (text.match(/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0E00-\u0E7F]/g) || []).length;
  const totalAlpha = latinChars + nonLatinChars;
  return totalAlpha === 0 || (latinChars / totalAlpha) > 0.7;
}

// --- Check if title indicates an error page ---
function isErrorTitle(title: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  const errorPatterns = [
    'access denied',
    'page not found',
    '404',
    '403',
    'forbidden',
    'error',
    'blocked',
    'unavailable',
    'not available',
    'sorry',
    'captcha',
    'just a moment',
    'checking your browser',
    'please wait',
    'redirecting',
    'antibot',
    'cloudflare',
  ];
  return errorPatterns.some(pattern => lower.includes(pattern));
}

// --- Helper to clean Markdown Code Blocks ---
function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, "");
    cleaned = cleaned.replace(/```$/, "");
  }
  return cleaned.trim();
}

// --- Helper to sanitize JSON string ---
function sanitizeJsonString(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

// --- Robust JSON extraction ---
function extractJson(text: string): any {
  let cleaned = cleanJsonText(text);
  
  try { return JSON.parse(cleaned); } catch {}
  try { return JSON.parse(sanitizeJsonString(cleaned)); } catch {}

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(jsonCandidate); } catch {}
    try { return JSON.parse(sanitizeJsonString(jsonCandidate)); } catch {}
  }

  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    return { summary: summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") };
  }

  return null;
}

// --- Extract page title from HTML ---
function extractPageTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = decodeHtmlEntities(titleMatch[1].trim());
    title = title
      .replace(/\s*[-|–—]\s*(BBC|CNN|CBS|NBC|ABC|Fox|Guardian|Reuters|AP|NPR|PBS).*$/i, '')
      .replace(/\s*[-|–—]\s*News.*$/i, '')
      .trim();
    if (title.length > 10 && !isErrorTitle(title) && isEnglishContent(title)) return title;
  }

  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogMatch) {
    const title = decodeHtmlEntities(ogMatch[1].trim());
    if (!isErrorTitle(title) && isEnglishContent(title)) return title;
  }

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i);
  if (twitterMatch) {
    const title = decodeHtmlEntities(twitterMatch[1].trim());
    if (!isErrorTitle(title) && isEnglishContent(title)) return title;
  }

  return null;
}

// --- Resolve a Vertex AI redirect URL and get article title ---
async function resolveVertexRedirect(redirectUrl: string): Promise<{ url: string; title: string | null } | null> {
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return { url: redirectUrl, title: null };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeoutId);

    let finalUrl = response.url;
    const html = await response.text();
    
    if (finalUrl.includes('vertexaisearch.cloud.google.com')) {
      const metaMatch = html.match(/content=["'][^"']*url=([^"'\s>]+)/i);
      if (metaMatch) finalUrl = metaMatch[1];
      
      const jsMatch = html.match(/window\.location\s*=\s*["']([^"']+)["']/i);
      if (jsMatch) finalUrl = jsMatch[1];
      
      const urlMatch = html.match(/https?:\/\/(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\/[^\s"'<>]+/gi);
      if (urlMatch) {
        const realUrl = urlMatch.find(u => 
          !u.includes('google.com') && 
          !u.includes('vertexai') &&
          !u.includes('googleapis')
        );
        if (realUrl) finalUrl = realUrl;
      }
    }

    if (finalUrl.includes('vertexaisearch.cloud.google.com')) {
      return null;
    }

    const pageTitle = extractPageTitle(html);
    
    if (pageTitle && isErrorTitle(pageTitle)) {
      return null;
    }

    return { url: finalUrl, title: pageTitle };
  } catch (error) {
    console.error('Failed to resolve redirect:', error);
    return null;
  }
}

// --- Process grounding chunks and resolve redirects ---
async function processGroundingChunks(
  chunks: any[]
): Promise<Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType }>> {
  const results: Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType }> = [];
  const seen = new Set<string>();

  const resolvePromises = chunks.map(async (chunk) => {
    const web = chunk?.web;
    if (!web?.uri) return null;

    const chunkTitle = (web.title || '').toLowerCase();
    if (chunkTitle.includes('google') || chunkTitle.includes('vertexai')) return null;

    try {
      const resolved = await resolveVertexRedirect(web.uri);
      if (!resolved) return null;

      const urlObj = new URL(resolved.url);
      const domain = urlObj.hostname.replace(/^www\./, '');

      let articleTitle = resolved.title || web.title || domain;
      articleTitle = decodeHtmlEntities(articleTitle);
      
      if (isErrorTitle(articleTitle)) return null;
      if (!isEnglishContent(articleTitle)) return null;

      const sourceInfo = getSourceInfo(domain);

      return {
        uri: resolved.url,
        title: articleTitle,
        displayName: sourceInfo.displayName,
        sourceDomain: domain,
        sourceType: sourceInfo.type,
      };
    } catch {
      return null;
    }
  });

  const resolved = await Promise.all(resolvePromises);

  for (const item of resolved) {
    if (!item) continue;
    if (seen.has(item.sourceDomain)) continue;
    seen.add(item.sourceDomain);
    results.push(item);
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const limitCheck = await checkRateLimit(req);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: `Daily limit reached. You have 0/${limitCheck.info.limit} remaining.` },
        { status: 429 }
      );
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'url'" }, { status: 400 });
    }

    await incrementUsage(req);

    const prompt = `
**ROLE:** You are MirrorSource, a news research assistant.

**TASK:**
1. Search for news coverage of the story at this URL: "${url}"
2. Write a neutral, 2-3 sentence summary of the news event.

**OUTPUT FORMAT (JSON only):**
{
  "summary": "Your neutral summary of the news event."
}
    `.trim();

    const config: any = { tools: [{ googleSearch: {} }] };

    const geminiResponse: any = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });

    let text: string | undefined;
    if (geminiResponse?.response && typeof geminiResponse.response.text === "function") {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
    }

    if (!text) throw new Error("Model response did not contain text.");

    const parsedData = extractJson(text) || {};
    const summary = parsedData.summary || "Summary not available.";

    const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
    const groundingMetadata = candidates[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks ?? [];

    const alternatives = await processGroundingChunks(groundingChunks);

    return NextResponse.json({
      summary,
      alternatives,
    });

  } catch (error) {
    console.error("Error in /api/find route:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `AI analysis failed: ${message}` }, { status: 500 });
  }
}