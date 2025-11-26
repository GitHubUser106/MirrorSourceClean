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
  
  try {
    return JSON.parse(cleaned);
  } catch {}

  try {
    return JSON.parse(sanitizeJsonString(cleaned));
  } catch {}

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch {}
    try {
      return JSON.parse(sanitizeJsonString(jsonCandidate));
    } catch {}
  }

  // Try to extract summary with regex as last resort
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    return {
      summary: summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
    };
  }

  return null;
}

// --- Extract search keywords from original URL ---
function extractSearchKeywords(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    const cleanPath = path
      .replace(/^\/+(news|article|story|us-news|world|politics|business|tech|science|health|entertainment|sports|live)\/?/gi, ' ')
      .replace(/\.(html|htm|php|asp|aspx)$/i, '')
      .replace(/[-_\/]+/g, ' ')
      .replace(/\d{4}[-\/]\d{2}[-\/]\d{2}/g, '')
      .replace(/\b\d+\b/g, ' ')
      .trim();
    
    const words = cleanPath.split(/\s+/).filter(w => w.length > 2);
    return words.slice(0, 5).join(' ') || 'news';
  } catch {
    return 'news';
  }
}

// --- Build Google site-search URL ---
function buildGoogleSiteSearch(domain: string, keywords: string): string {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  const query = encodeURIComponent(`site:${cleanDomain} ${keywords}`);
  return `https://www.google.com/search?q=${query}`;
}

// --- Check if a source should be kept ---
function shouldKeepSource(title: string): boolean {
  if (!title) return false;
  const clean = title.toLowerCase().trim();
  
  // Filter out Google/Vertex internal stuff
  if (clean.includes('vertexai')) return false;
  if (clean.includes('googleapis')) return false;
  if (clean === 'google.com') return false;
  if (clean === 'google') return false;
  
  return true;
}

// --- Extract domain from title or URI ---
function extractDomain(title: string, uri?: string): string | null {
  // First try: if title looks like a domain (has a dot, no spaces)
  const cleanTitle = title.toLowerCase().trim();
  if (cleanTitle.includes('.') && !cleanTitle.includes(' ')) {
    return cleanTitle.replace(/^www\./, '');
  }
  
  // Second try: extract from URI if provided
  if (uri) {
    try {
      const urlObj = new URL(uri);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      // Skip vertex/google URLs
      if (!hostname.includes('vertexai') && !hostname.includes('googleapis')) {
        return hostname;
      }
    } catch {}
  }
  
  // Third try: treat the title as a site name and make it a domain
  if (cleanTitle && !cleanTitle.includes(' ')) {
    return `${cleanTitle}.com`;
  }
  
  return null;
}

// --- Process sources from either grounding metadata or JSON alternatives ---
function processSources(
  groundingChunks: any[],
  jsonAlternatives: any[],
  searchKeywords: string
): Array<{ uri: string; title: string; displayName: string; sourceDomain: string }> {
  const seen = new Set<string>();
  const sources: Array<{ uri: string; title: string; displayName: string; sourceDomain: string }> = [];

  // First, process grounding chunks (more reliable for domains)
  for (const chunk of groundingChunks) {
    const web = chunk?.web;
    if (!web?.title) continue;
    if (!shouldKeepSource(web.title)) continue;
    
    const domain = extractDomain(web.title, web.uri);
    if (!domain) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    
    sources.push({
      uri: buildGoogleSiteSearch(domain, searchKeywords),
      title: web.title,
      displayName: domain.split('.')[0].toUpperCase(),
      sourceDomain: domain,
    });
  }

  // If no grounding chunks, try JSON alternatives
  if (sources.length === 0 && jsonAlternatives.length > 0) {
    for (const alt of jsonAlternatives) {
      const title = alt.title || alt.source || '';
      const uri = alt.uri || alt.url || '';
      
      if (!shouldKeepSource(title)) continue;
      
      const domain = extractDomain(title, uri);
      if (!domain) continue;
      if (seen.has(domain)) continue;
      seen.add(domain);
      
      sources.push({
        uri: buildGoogleSiteSearch(domain, searchKeywords),
        title: title,
        displayName: domain.split('.')[0].toUpperCase(),
        sourceDomain: domain,
      });
    }
  }

  return sources;
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

    // 3. Extract search keywords
    const searchKeywords = extractSearchKeywords(url);

    // 4. SYSTEM PROMPT - ask for both summary and source names
    const prompt = `
**ROLE:** You are MirrorSource, a news research assistant.

**TASK:**
1. Search for news coverage of the story at this URL: "${url}"
2. Write a neutral, 2-3 sentence summary of the news event.
3. List the news sources that are covering this story.

**OUTPUT FORMAT (JSON only, no markdown):**
{
  "summary": "Your neutral summary of the news event.",
  "sources": ["cnn.com", "bbc.com", "reuters.com", "apnews.com"]
}

List source domains only (e.g., "cnn.com" not full article URLs).
If you cannot find the story, still provide any relevant sources covering similar news.
    `.trim();

    const config: any = { tools: [{ googleSearch: {} }] };

    // 5. Call Gemini
    const geminiResponse: any = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });

    // 6. Extract Text
    let text: string | undefined;
    if (geminiResponse?.response && typeof geminiResponse.response.text === "function") {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text = geminiResponse.candidates[0]?.content?.parts?.[0]?.text;
    }

    if (!text) throw new Error("Model response did not contain text.");

    // 7. Parse JSON
    const parsedData = extractJson(text) || {};
    const summary = parsedData.summary || "Summary not available.";
    
    // Get sources from JSON (as domain strings or objects)
    let jsonSources: any[] = [];
    if (Array.isArray(parsedData.sources)) {
      jsonSources = parsedData.sources.map((s: any) => {
        if (typeof s === 'string') {
          return { title: s };
        }
        return s;
      });
    } else if (Array.isArray(parsedData.alternatives)) {
      jsonSources = parsedData.alternatives;
    }

    // 8. Get grounding chunks
    const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
    const groundingMetadata = candidates[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks ?? [];

    // 9. Process all sources
    const alternatives = processSources(groundingChunks, jsonSources, searchKeywords);

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