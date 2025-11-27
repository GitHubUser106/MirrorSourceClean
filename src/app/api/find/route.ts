import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage } from "../../../lib/rate-limiter";

export const dynamic = "force-dynamic";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

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
  ];
  return errorPatterns.some(pattern => lower.includes(pattern));
}

// --- Clean up display name from domain ---
function getDisplayName(domain: string): string {
  if (!domain) return 'SOURCE';
  
  const lower = domain.toLowerCase();
  
  // Special cases for better display names
  if (lower.includes('wikipedia.org')) return 'WIKIPEDIA';
  if (lower.includes('theguardian.com')) return 'THE GUARDIAN';
  if (lower.includes('nytimes.com')) return 'NY TIMES';
  if (lower.includes('washingtonpost.com')) return 'WASHINGTON POST';
  if (lower.includes('bbc.com') || lower.includes('bbc.co.uk')) return 'BBC';
  if (lower.includes('cnn.com')) return 'CNN';
  if (lower.includes('foxnews.com')) return 'FOX NEWS';
  if (lower.includes('nbcnews.com')) return 'NBC NEWS';
  if (lower.includes('abcnews.go.com')) return 'ABC NEWS';
  if (lower.includes('cbsnews.com')) return 'CBS NEWS';
  if (lower.includes('apnews.com')) return 'AP NEWS';
  if (lower.includes('reuters.com')) return 'REUTERS';
  if (lower.includes('npr.org')) return 'NPR';
  if (lower.includes('pbs.org')) return 'PBS';
  if (lower.includes('aljazeera.com')) return 'AL JAZEERA';
  if (lower.includes('globalnews.ca')) return 'GLOBAL NEWS';
  if (lower.includes('cbc.ca')) return 'CBC';
  if (lower.includes('ctvnews.ca')) return 'CTV NEWS';
  if (lower.includes('scmp.com')) return 'SCMP';
  if (lower.includes('businessinsider.com')) return 'BUSINESS INSIDER';
  
  // Default: use first part of domain, uppercase
  const parts = domain.split('.');
  // Handle subdomains like en.wikipedia.org
  if (parts.length > 2 && parts[0].length <= 3) {
    return parts[1].toUpperCase();
  }
  return parts[0].toUpperCase();
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
  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = decodeHtmlEntities(titleMatch[1].trim());
    // Clean up common suffixes
    title = title
      .replace(/\s*[-|–—]\s*(BBC|CNN|CBS|NBC|ABC|Fox|Guardian|Reuters|AP|NPR|PBS).*$/i, '')
      .replace(/\s*[-|–—]\s*News.*$/i, '')
      .trim();
    if (title.length > 10 && !isErrorTitle(title)) return title;
  }

  // Try og:title meta tag
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogMatch) {
    const title = decodeHtmlEntities(ogMatch[1].trim());
    if (!isErrorTitle(title)) return title;
  }

  // Try twitter:title
  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i);
  if (twitterMatch) {
    const title = decodeHtmlEntities(twitterMatch[1].trim());
    if (!isErrorTitle(title)) return title;
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
    
    // If still on vertex, try to find the real URL
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

    // Skip if we couldn't resolve
    if (finalUrl.includes('vertexaisearch.cloud.google.com')) {
      return null;
    }

    // Extract the page title
    const pageTitle = extractPageTitle(html);
    
    // Skip if the page title indicates an error
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
): Promise<Array<{ uri: string; title: string; displayName: string; sourceDomain: string }>> {
  const results: Array<{ uri: string; title: string; displayName: string; sourceDomain: string }> = [];
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

      // Use the page title we extracted, or fall back to the grounding title
      let articleTitle = resolved.title || web.title || domain;
      
      // Decode any HTML entities in the title
      articleTitle = decodeHtmlEntities(articleTitle);
      
      // Skip if title is an error page
      if (isErrorTitle(articleTitle)) return null;

      return {
        uri: resolved.url,
        title: articleTitle,
        displayName: getDisplayName(domain),
        sourceDomain: domain,
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

    // 3. SYSTEM PROMPT
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

    // 6. Parse JSON for summary
    const parsedData = extractJson(text) || {};
    const summary = parsedData.summary || "Summary not available.";

    // 7. Get grounding chunks
    const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
    const groundingMetadata = candidates[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks ?? [];

    // 8. Resolve redirects and get article titles
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