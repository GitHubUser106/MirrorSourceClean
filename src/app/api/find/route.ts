import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage } from "../../../lib/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow up to 30 seconds

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
  
  // Public Broadcasting
  if (lower.includes('npr.org')) return { displayName: 'NPR', type: 'public' };
  if (lower.includes('pbs.org')) return { displayName: 'PBS', type: 'public' };
  if (lower.includes('bbc.com') || lower.includes('bbc.co.uk')) return { displayName: 'BBC', type: 'public' };
  if (lower.includes('cbc.ca')) return { displayName: 'CBC', type: 'public' };
  
  // Major International
  if (lower.includes('aljazeera.com')) return { displayName: 'AL JAZEERA', type: 'international' };
  if (lower.includes('theguardian.com')) return { displayName: 'THE GUARDIAN', type: 'international' };
  if (lower.includes('scmp.com')) return { displayName: 'SCMP', type: 'international' };
  if (lower.includes('globalnews.ca')) return { displayName: 'GLOBAL NEWS', type: 'international' };
  if (lower.includes('ctvnews.ca')) return { displayName: 'CTV NEWS', type: 'international' };
  
  // Major US National
  if (lower.includes('nytimes.com')) return { displayName: 'NY TIMES', type: 'national' };
  if (lower.includes('washingtonpost.com')) return { displayName: 'WASHINGTON POST', type: 'national' };
  if (lower.includes('cnn.com')) return { displayName: 'CNN', type: 'national' };
  if (lower.includes('foxnews.com')) return { displayName: 'FOX NEWS', type: 'national' };
  if (lower.includes('nbcnews.com')) return { displayName: 'NBC NEWS', type: 'national' };
  if (lower.includes('cbsnews.com')) return { displayName: 'CBS NEWS', type: 'national' };
  if (lower.includes('abcnews.go.com')) return { displayName: 'ABC NEWS', type: 'national' };
  if (lower.includes('politico.com')) return { displayName: 'POLITICO', type: 'national' };
  if (lower.includes('axios.com')) return { displayName: 'AXIOS', type: 'national' };
  if (lower.includes('usatoday.com')) return { displayName: 'USA TODAY', type: 'national' };
  
  // Magazines
  if (lower.includes('time.com')) return { displayName: 'TIME', type: 'magazine' };
  if (lower.includes('newsweek.com')) return { displayName: 'NEWSWEEK', type: 'magazine' };
  if (lower.includes('forbes.com')) return { displayName: 'FORBES', type: 'magazine' };
  if (lower.includes('businessinsider.com')) return { displayName: 'BUSINESS INSIDER', type: 'magazine' };
  
  // Reference
  if (lower.includes('wikipedia.org')) return { displayName: 'WIKIPEDIA', type: 'reference' };
  
  // Aggregators
  if (lower.includes('yahoo.com')) return { displayName: 'YAHOO NEWS', type: 'national' };
  if (lower.includes('msn.com')) return { displayName: 'MSN', type: 'national' };
  
  // Default: local news
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
  // Skip non-vertex URLs
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return { url: redirectUrl, title: null };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5 seconds

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
    
    // If we got redirected away from vertex, that's our URL
    if (!finalUrl.includes('vertexaisearch.cloud.google.com')) {
      const html = await response.text();
      const pageTitle = extractPageTitle(html);
      return { url: finalUrl, title: pageTitle };
    }
    
    // Still on vertex - try to extract URL from HTML
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
    // Silently fail - don't crash the whole request
    console.log('Redirect resolution skipped:', redirectUrl.substring(0, 50));
    return null;
  }
}

// --- Process grounding chunks ---
async function processGroundingChunks(
  chunks: any[]
): Promise<Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType }>> {
  const results: Array<{ uri: string; title: string; displayName: string; sourceDomain: string; sourceType: SourceType }> = [];
  const seen = new Set<string>();

  // Process chunks with a timeout wrapper for safety
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
  };

  // Process all chunks with Promise.allSettled to prevent any single failure from crashing
  const resolvePromises = chunks.slice(0, 10).map(processChunk); // Limit to 10 chunks
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

  return results;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limit
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

    // 2. Increment Usage
    await incrementUsage(req);

    // 3. Prompt
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

    // 4. Call Gemini
    const geminiResponse: any = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });

    // 5. Extract Text
    let text: string | undefined;
    if (geminiResponse?.response && typeof geminiResponse.response.text === "function") {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
    }

    if (!text) throw new Error("Model response did not contain text.");

    // 6. Parse JSON
    const parsedData = extractJson(text) || {};
    const summary = parsedData.summary || "Summary not available.";

    // 7. Get grounding chunks
    const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
    const groundingMetadata = candidates[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks ?? [];

    // 8. Process alternatives (with safe error handling)
    let alternatives: any[] = [];
    try {
      alternatives = await processGroundingChunks(groundingChunks);
    } catch (e) {
      console.error("Error processing grounding chunks:", e);
      // Continue without alternatives
    }

    return NextResponse.json({
      summary,
      alternatives,
    });

  } catch (error) {
    console.error("Error in /api/find route:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}