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
  // First, clean markdown fences
  let cleaned = cleanJsonText(text);
  
  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Sanitize and retry
  try {
    return JSON.parse(sanitizeJsonString(cleaned));
  } catch {}

  // Find JSON object boundaries and extract
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

  // Last resort: try to extract summary with regex
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    return {
      summary: summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
      alternatives: []
    };
  }

  return null;
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

    // 3. SYSTEM PROMPT (Corrected - uses proper JSON with escaped quotes)
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

    // 4. Call Gemini (Use whichever model works for you - 2.5-pro or 1.5-flash)
    const geminiResponse: any = await genAI.models.generateContent({
      model: "gemini-2.5-pro",  // Change to "gemini-1.5-flash" if that works better
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

    // 6. Parse JSON with robust extraction
    const parsedData = extractJson(text);
    
    if (!parsedData) {
      console.error("Failed to parse JSON from response:", text);
      throw new Error("Could not parse model response as JSON.");
    }

    // 7. Extract alternatives from JSON or fall back to grounding metadata
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