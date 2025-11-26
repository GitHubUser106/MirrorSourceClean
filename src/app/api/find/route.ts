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

  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    return {
      summary: summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
      alternatives: []
    };
  }

  return null;
}

// --- Resolve Vertex AI redirect URL to get actual destination ---
async function resolveRedirectUrl(redirectUrl: string): Promise<string> {
  // If it's not a vertex redirect, return as-is
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return redirectUrl;
  }

  try {
    // Use GET with redirect: 'follow' - this should give us the final URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    // response.url should be the final URL after redirects
    if (response.url && !response.url.includes('vertexaisearch.cloud.google.com')) {
      console.log(`Resolved: ${redirectUrl.substring(0, 50)}... -> ${response.url}`);
      return response.url;
    }

    // If we still have a vertex URL, try to extract from response
    // Sometimes the redirect is in the HTML
    const html = await response.text();
    const metaRefresh = html.match(/url=([^"'\s>]+)/i);
    if (metaRefresh && metaRefresh[1]) {
      return metaRefresh[1];
    }

    console.warn(`Could not resolve redirect for: ${redirectUrl.substring(0, 80)}...`);
    return redirectUrl;
  } catch (error) {
    console.error(`Error resolving redirect: ${error}`);
    return redirectUrl;
  }
}

// --- Build URL from title (fallback method) ---
function buildUrlFromTitle(title: string): string | null {
  // The title is often the domain name like "cbsnews.com" or "theguardian.com"
  // We can try to construct a basic URL from it
  if (!title) return null;
  
  // Clean up the title
  const cleanTitle = title.toLowerCase().trim();
  
  // If it looks like a domain, construct a URL
  if (cleanTitle.includes('.') && !cleanTitle.includes(' ')) {
    return `https://www.${cleanTitle.replace(/^www\./, '')}`;
  }
  
  return null;
}

// --- Process all sources: resolve redirects or use title fallback ---
async function processAllSources(
  sources: Array<{ uri: string; title: string }>
): Promise<Array<{ uri: string; title: string }>> {
  
  const processedSources = await Promise.all(
    sources.map(async (source) => {
      // Try to resolve the redirect
      const resolvedUri = await resolveRedirectUrl(source.uri);
      
      // If resolution worked (not a vertex URL anymore)
      if (!resolvedUri.includes('vertexaisearch.cloud.google.com')) {
        return { ...source, uri: resolvedUri };
      }
      
      // Fallback: Try to build URL from title
      const fallbackUrl = buildUrlFromTitle(source.title);
      if (fallbackUrl) {
        console.log(`Using fallback URL from title: ${source.title} -> ${fallbackUrl}`);
        return { ...source, uri: fallbackUrl };
      }
      
      // Last resort: return original (will still 404, but at least shows something)
      return source;
    })
  );

  // Filter out any sources that still have vertex URLs
  return processedSources.filter(s => !s.uri.includes('vertexaisearch.cloud.google.com'));
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
**ROLE:** You are MirrorSource, a helpful news assistant.

**TASK:**
1. **FIND ALTERNATIVES:** A user wants to read a story from this URL: "${url}".
   Search for the *same news story* from other reputable, public sources that are free to read.
2. **SUMMARIZE:** Write a concise, neutral, one-paragraph summary of the event.
3. **LIST SOURCES:** Provide the alternative sources you found.

**CRITICAL OUTPUT RULES:**
- Return ONLY a valid JSON object. No markdown, no code blocks, no extra text.
- Use double quotes for all JSON strings.
- If your text contains quotes, escape them with backslash (\\").
- Keep the summary to 2-3 sentences maximum.

**REQUIRED JSON FORMAT:**
{
  "summary": "Your neutral summary here.",
  "alternatives": [
    { "title": "Article Headline Here", "uri": "https://example.com/article" }
  ]
}

Article URL: ${url}
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
    const parsedData = extractJson(text);
    
    if (!parsedData) {
      console.error("Failed to parse JSON from response:", text);
      throw new Error("Could not parse model response as JSON.");
    }

    // 7. Get alternatives from JSON or grounding metadata
    let alternatives = parsedData.alternatives || parsedData.sources || [];
    const summary = parsedData.summary || "No summary available.";

    // Fallback: If JSON didn't include sources, try grounding metadata
    if (alternatives.length === 0) {
      const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
      const groundingMetadata = candidates[0]?.groundingMetadata;
      const groundingChunks = groundingMetadata?.groundingChunks ?? [];
      
      console.log("Using grounding metadata, found chunks:", groundingChunks.length);
      
      alternatives = groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web?.uri && web?.title)
        .map((web: any) => ({ uri: web.uri, title: web.title }));
    }

    console.log("Raw alternatives count:", alternatives.length);

    // 8. Process sources: resolve redirects or use fallbacks
    const processedAlternatives = await processAllSources(alternatives);
    
    console.log("Processed alternatives count:", processedAlternatives.length);

    return NextResponse.json({
      summary,
      alternatives: processedAlternatives,
    });

  } catch (error) {
    console.error("Error in /api/find route:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `AI analysis failed: ${message}` }, { status: 500 });
  }
}