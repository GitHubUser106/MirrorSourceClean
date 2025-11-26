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
      .replace(/^\/+(news|article|story|us-news|world|politics|business|tech|science|health|entertainment|sports)\/?/gi, ' ')
      .replace(/\.(html|htm|php|asp|aspx)$/i, '')
      .replace(/[-_\/]+/g, ' ')
      .replace(/\d{4}[-\/]\d{2}[-\/]\d{2}/g, '') // Remove dates
      .replace(/\d+/g, ' ') // Remove numbers
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

// --- Check if a domain looks valid ---
function isValidDomain(title: string): boolean {
  if (!title) return false;
  const clean = title.toLowerCase().trim();
  
  // Must contain a dot and look like a domain
  if (!clean.includes('.')) return false;
  
  // Filter out Google internal domains
  if (clean.includes('google.com')) return false;
  if (clean.includes('vertexai')) return false;
  if (clean.includes('googleapis')) return false;
  
  // Basic domain pattern check
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/i.test(clean);
}

// --- Process grounding metadata to get reliable sources ---
function processGroundingMetadata(
  groundingChunks: any[],
  searchKeywords: string
): Array<{ uri: string; title: string; domain: string }> {
  const seen = new Set<string>();
  const sources: Array<{ uri: string; title: string; domain: string }> = [];

  for (const chunk of groundingChunks) {
    const web = chunk?.web;
    if (!web?.title) continue;
    
    const title = web.title;
    const domain = title.toLowerCase().replace(/^www\./, '');
    
    // Skip if we've seen this domain
    if (seen.has(domain)) continue;
    
    // Skip if it doesn't look like a valid news domain
    if (!isValidDomain(title)) continue;
    
    seen.add(domain);
    
    // ALWAYS use Google site search - never trust the URI from grounding
    const uri = buildGoogleSiteSearch(domain, searchKeywords);
    
    sources.push({
      uri,
      title: formatDomainAsTitle(domain),
      domain,
    });
  }

  return sources;
}

// --- Format domain as a nice title ---
function formatDomainAsTitle(domain: string): string {
  // Remove TLD and capitalize
  const name = domain.replace(/\.(com|org|net|co\.uk|ca|gov|edu|io)$/i, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
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

    // 4. SYSTEM PROMPT - simplified, just ask for summary
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

    // 8. Get sources ONLY from grounding metadata (not from Gemini's JSON)
    const candidates = geminiResponse?.response?.candidates ?? geminiResponse?.candidates ?? [];
    const groundingMetadata = candidates[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks ?? [];
    
    // 9. Process grounding chunks into reliable Google site-search links
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