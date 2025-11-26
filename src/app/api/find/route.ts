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

// --- Build a search URL from the title (domain name) ---
// Since Vertex AI redirect URLs don't work, we link to a Google search for that source
function buildSearchUrl(title: string, searchQuery: string): string {
  // The title is typically the domain (e.g., "cbsnews.com", "theguardian.com")
  const cleanDomain = title.toLowerCase().replace(/^www\./, '');
  // Create a Google search that targets that specific site
  const query = encodeURIComponent(`site:${cleanDomain} ${searchQuery}`);
  return `https://www.google.com/search?q=${query}`;
}

// --- Extract the main topic from the original URL for search ---
function extractSearchTopic(url: string): string {
  try {
    const urlObj = new URL(url);
    // Get the path and extract keywords
    const path = urlObj.pathname;
    // Remove common prefixes and file extensions
    const cleanPath = path
      .replace(/^\/+(news|article|story|us-news|world|politics|business)\/?/i, '')
      .replace(/\.(html|htm|php|asp)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\/+/g, ' ')
      .trim();
    
    // Take first few meaningful words
    const words = cleanPath.split(/\s+/).filter(w => w.length > 2).slice(0, 5);
    return words.join(' ') || 'news';
  } catch {
    return 'news';
  }
}

// --- Process grounding sources: convert to usable URLs ---
function processGroundingSources(
  sources: Array<{ uri: string; title: string }>,
  originalUrl: string
): Array<{ uri: string; title: string; domain: string }> {
  const searchTopic = extractSearchTopic(originalUrl);
  const seen = new Set<string>();
  const processed: Array<{ uri: string; title: string; domain: string }> = [];

  for (const source of sources) {
    if (!source.title) continue;
    
    const domain = source.title.toLowerCase().replace(/^www\./, '');
    
    // Skip duplicates
    if (seen.has(domain)) continue;
    seen.add(domain);
    
    // Skip internal Google URLs in titles
    if (domain.includes('google.com') || domain.includes('vertexai')) continue;
    
    // If the URI is a vertex redirect, replace with a Google site search
    let finalUri = source.uri;
    if (source.uri.includes('vertexaisearch.cloud.google.com')) {
      finalUri = buildSearchUrl(source.title, searchTopic);
    }
    
    processed.push({
      uri: finalUri,
      title: source.title,
      domain: domain,
    });
  }

  return processed;
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
      
      alternatives = groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web?.uri && web?.title)
        .map((web: any) => ({ uri: web.uri, title: web.title }));
    }

    // 8. Process sources to fix vertex redirect URLs
    const processedAlternatives = processGroundingSources(alternatives, url);

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