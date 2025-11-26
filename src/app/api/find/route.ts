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

// --- Extract search keywords from original URL ---
function extractSearchKeywords(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Clean up the path to extract keywords
    const cleanPath = path
      .replace(/^\/+(news|article|story|us-news|world|politics|business|tech|science|health|entertainment|sports|live)\/?/gi, ' ')
      .replace(/\.(html|htm|php|asp|aspx)$/i, '')
      .replace(/[-_\/]+/g, ' ')
      .replace(/\d{4}[-\/]\d{2}[-\/]\d{2}/g, '') // Remove dates
      .replace(/\b\d+\b/g, ' ') // Remove standalone numbers
      .trim();
    
    // Get meaningful words (length > 2)
    const words = cleanPath.split(/\s+/).filter(w => w.length > 2);
    
    // Return first 4-5 words as search terms
    return words.slice(0, 5).join(' ') || 'latest news';
  } catch {
    return 'latest news';
  }
}

// --- Build Google site-search URL ---
function buildGoogleSiteSearch(domain: string, keywords: string): string {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  const query = encodeURIComponent(`site:${cleanDomain} ${keywords}`);
  return `https://www.google.com/search?q=${query}`;
}

// --- Check if title looks like a domain we should keep ---
function shouldKeepSource(title: string): boolean {
  if (!title) return false;
  const clean = title.toLowerCase().trim();
  
  // Filter out Google/Vertex internal stuff
  if (clean.includes('vertexai')) return false;
  if (clean.includes('googleapis')) return false;
  if (clean === 'google.com') return false;
  
  // Keep anything that has a dot (likely a domain)
  return clean.includes('.');
}

// --- Format domain as a nice display title ---
function formatDisplayTitle(domain: string): string {
  const clean = domain.toLowerCase().replace(/^www\./, '');
  // Capitalize first letter of each part before the TLD
  const parts = clean.split('.');
  if (parts.length >= 2) {
    // Get the site name (before TLD)
    const siteName = parts.slice(0, -1).join('.');
    return siteName.toUpperCase();
  }
  return clean.toUpperCase();
}

// --- Process grounding metadata to get sources ---
function processGroundingMetadata(
  groundingChunks: any[],
  searchKeywords: string
): Array<{ uri: string; title: string; displayName: string; sourceDomain: string }> {
  const seen = new Set<string>();
  const sources: Array<{ uri: string; title: string; displayName: string; sourceDomain: string }> = [];

  for (const chunk of groundingChunks) {
    const web = chunk?.web;
    if (!web?.title) continue;
    
    const rawTitle = web.title;
    
    // Skip if not a valid source
    if (!shouldKeepSource(rawTitle)) continue;
    
    const domain = rawTitle.toLowerCase().replace(/^www\./, '');
    
    // Skip duplicates
    if (seen.has(domain)) continue;
    seen.add(domain);
    
    // Build Google site search URL
    const uri = buildGoogleSiteSearch(domain, searchKeywords);
    
    sources.push({
      uri,
      title: rawTitle, // Keep original for reference
      displayName: formatDisplayTitle(domain),
      sourceDomain: domain, // Pass the actual source domain for favicon
    });
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

    // 3. Extract search keywords from original URL
    const searchKeywords = extractSearchKeywords(url);

    // 4. SYSTEM PROMPT - just ask for summary
    const prompt = `
**ROLE:** You are MirrorSource, a helpful news assistant.

**TASK:**
A user wants to read a story from this URL: "${url}"
Search for this news story and write a concise, neutral, 2-3 sentence summary of the event.

**OUTPUT:**
Return ONLY a JSON object with a summary field:
{
  "summary": "Your neutral summary here."
}

Do not include alternatives or sources - just the summary.
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

    // 7. Parse JSON for summary
    const parsedData = extractJson(text);
    const summary = parsedData?.summary || "No summary available.";

    // 8. Get sources from grounding metadata
    const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
    const groundingMetadata = candidates[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks ?? [];
    
    // 9. Process grounding chunks into Google site-search links
    const alternatives = processGroundingMetadata(groundingChunks, searchKeywords);

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