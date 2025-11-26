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

// --- Helper to sanitize JSON string (handles smart quotes, etc.) ---
function sanitizeJsonString(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")   // Smart single quotes to regular
    .replace(/[\u201C\u201D]/g, '"')   // Smart double quotes to regular
    .replace(/\r\n/g, "\\n")           // Windows line breaks
    .replace(/\n/g, "\\n")             // Unix line breaks in strings
    .replace(/\t/g, "\\t");            // Tabs
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

// --- Resolve Vertex AI redirect URLs to get actual destination ---
async function resolveRedirectUrl(redirectUrl: string): Promise<string | null> {
  // Only process vertexaisearch redirect URLs
  if (!redirectUrl.includes('vertexaisearch.cloud.google.com')) {
    return redirectUrl;
  }

  try {
    // Make a HEAD request to follow redirects and get the final URL
    const response = await fetch(redirectUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)',
      },
    });

    // The final URL after redirects
    if (response.url && response.url !== redirectUrl) {
      return response.url;
    }

    // If HEAD doesn't give us the redirect, try GET with manual redirect handling
    const getResponse = await fetch(redirectUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MirrorSource/1.0)',
      },
    });

    // Check for Location header in 3xx responses
    const locationHeader = getResponse.headers.get('location');
    if (locationHeader) {
      return locationHeader;
    }

    return null;
  } catch (error) {
    console.error('Failed to resolve redirect URL:', redirectUrl, error);
    return null;
  }
}

// --- Resolve all redirect URLs in parallel ---
async function resolveAllRedirects(
  sources: Array<{ uri: string; title: string }>
): Promise<Array<{ uri: string; title: string }>> {
  const resolvedSources = await Promise.all(
    sources.map(async (source) => {
      const resolvedUri = await resolveRedirectUrl(source.uri);
      if (resolvedUri) {
        return { ...source, uri: resolvedUri };
      }
      return null; // Filter out failed resolutions
    })
  );

  return resolvedSources.filter((s): s is { uri: string; title: string } => s !== null);
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
  "summary": "Your neutral summary here. Use backslash to escape any \\"quotes\\" inside.",
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
      
      alternatives = groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web?.uri && web?.title)
        .map((web: any) => ({ uri: web.uri, title: web.title }));
    }

    // 8. RESOLVE REDIRECT URLs - This is the key fix!
    const resolvedAlternatives = await resolveAllRedirects(alternatives);

    return NextResponse.json({
      summary,
      alternatives: resolvedAlternatives,
    });

  } catch (error) {
    console.error("Error in /api/find route:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `AI analysis failed: ${message}` }, { status: 500 });
  }
}