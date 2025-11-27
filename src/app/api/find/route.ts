import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, incrementUsage } from "../../../lib/rate-limiter";

export const dynamic = "force-dynamic";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

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

// --- Resolve a Vertex AI redirect URL to get the actual destination ---
async function resolveVertexRedirect(redirectUrl: string): Promise<string | null> {
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return redirectUrl; // Already a real URL
  }

  try {
    // Method 1: Follow redirects with fetch
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

    // Check if we got redirected to a real URL
    if (response.url && !response.url.includes('vertexaisearch.cloud.google.com')) {
      return response.url;
    }

    // Method 2: Check for meta refresh or JavaScript redirect in HTML
    const html = await response.text();
    
    // Look for meta refresh
    const metaMatch = html.match(/content=["'][^"']*url=([^"'\s>]+)/i);
    if (metaMatch) {
      return metaMatch[1];
    }

    // Look for window.location redirect
    const jsMatch = html.match(/window\.location\s*=\s*["']([^"']+)["']/i);
    if (jsMatch) {
      return jsMatch[1];
    }

    // Look for any URL in the response that looks like a news article
    const urlMatch = html.match(/https?:\/\/(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\/[^\s"'<>]+/gi);
    if (urlMatch) {
      // Find a URL that's not Google
      const realUrl = urlMatch.find(u => 
        !u.includes('google.com') && 
        !u.includes('vertexai') &&
        !u.includes('googleapis')
      );
      if (realUrl) return realUrl;
    }

    return null;
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

  // Process chunks in parallel for speed
  const resolvePromises = chunks.map(async (chunk) => {
    const web = chunk?.web;
    if (!web?.uri || !web?.title) return null;

    // Skip Google internal URLs in title
    const title = web.title.toLowerCase();
    if (title.includes('google') || title.includes('vertexai')) return null;

    try {
      const resolvedUrl = await resolveVertexRedirect(web.uri);
      if (!resolvedUrl) return null;

      // Extract domain from resolved URL
      const urlObj = new URL(resolvedUrl);
      const domain = urlObj.hostname.replace(/^www\./, '');

      return {
        uri: resolvedUrl,
        title: web.title,
        displayName: domain.split('.')[0].toUpperCase(),
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

    console.log(`Found ${groundingChunks.length} grounding chunks`);

    // 8. Resolve redirects to get actual article URLs
    const alternatives = await processGroundingChunks(groundingChunks);

    console.log(`Resolved ${alternatives.length} alternative sources`);

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