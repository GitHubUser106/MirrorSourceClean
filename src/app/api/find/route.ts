// Force rebuild for API key
import { NextRequest, NextResponse } from "next/server";
...import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { GroundingSource } from "../../../types";
import { checkRateLimit, incrementUsage } from "../../../lib/rate-limiter"; // <--- IMPORTED

export const dynamic = "force-dynamic";

const PAYWALLED_DOMAINS: string[] = [
  "adweek.com", "barrons.com", "bloomberg.com", "bostonglobe.com",
  "businessinsider.com", "cnbc.com", "chicagotribune.com", "digiday.com",
  "economist.com", "espn.com", "foreignpolicy.com", "ft.com", "forbes.com",
  "hbr.org", "inquirer.com", "latimes.com", "medium.com", "nationalgeographic.com",
  "newyorker.com", "nytimes.com", "politico.com", "qz.com", "scientificamerican.com",
  "seekingalpha.com", "sfchronicle.com", "sloanreview.mit.edu", "statista.com",
  "techcrunch.com", "technologyreview.com", "theathletic.com", "theatlantic.com",
  "theinformation.com", "thetimes.co.uk", "time.com", "vanityfair.com",
  "venturebeat.com", "washingtonpost.com", "wired.com", "wsj.com",
];

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

function extractDomain(urlString: string): string {
  try {
    return new URL(urlString).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Strip ```json fenced code blocks
function stripMarkdownFences(text: string): string {
  let trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```[a-zA-Z0-9]*\s*/, "");
    trimmed = trimmed.replace(/```$/, "").trim();
  }
  return trimmed;
}

// 🔥 BEST-PRACTICE SUMMARY EXTRACTOR
function extractSummaryFromText(raw: string): string {
  const stripped = stripMarkdownFences(raw).trim();

  // 1. If entire content is JSON
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed.summary === "string") {
      return parsed.summary.trim();
    }
  } catch {}

  // 2. Try to locate a JSON object inside text
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const maybeJson = stripped.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(maybeJson);
      if (parsed && typeof parsed.summary === "string") {
        return parsed.summary.trim();
      }
    } catch {}
  }

  // 3. Regex for `"summary": " ... "`
  const match = stripped.match(/"summary"\s*:\s*"([\s\S]*?)"\s*}/);
  if (match) {
    return match[1].trim().replace(/\\"/g, '"');
  }

  // 4. Remove a leading "Summary" heading if present
  const withoutHeading = stripped.replace(/^Summary\s*/i, "").trim();
  return withoutHeading;
}

export async function POST(req: NextRequest) {
  try {
    // --- 1. CHECK RATE LIMIT ---
    const limitCheck = await checkRateLimit(req);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: `Daily limit reached. You have 0/${limitCheck.info.limit} remaining.` },
        { status: 429 } // Too Many Requests
      );
    }
    // ---------------------------

    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'url'" }, { status: 400 });
    }

    // --- 2. INCREMENT USAGE (Only if URL is valid) ---
    await incrementUsage(req);
    // -------------------------------------------------

    const originalUrlDomain = extractDomain(url);

    const prompt = `
You are MirrorSource, an expert news analyst.
Use the googleSearch tool to read the article at this URL and find other
articles covering the same story. Then write a concise, neutral, one paragraph
summary of the event.

You must:
1. Call googleSearch to fetch at least three alternative URLs.
2. Base your answer on those search results.
3. Return ONLY the following JSON and nothing else:

{
  "summary": "A concise, neutral, one-paragraph summary of the news event."
}

Article URL: ${url}
    `.trim();

    const config: any = { tools: [{ googleSearch: {} }] };

    const geminiResponse: any = await genAI.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config,
    });

    // ---- Extract model text ----
    let text: string | undefined;

    if (geminiResponse?.response && typeof geminiResponse.response.text === "function") {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text =
        geminiResponse.candidates[0]?.content?.parts?.[0]?.text ??
        geminiResponse.candidates[0]?.content?.parts?.[0]?.inlineData?.data;
    }

    if (!text) {
      throw new Error("Model response did not contain any text content.");
    }

    // ---- 🔥 ROBUST SUMMARY PARSING ----
    const summary = extractSummaryFromText(String(text));

    // ---- Grounding sources ----
    const candidates =
      geminiResponse?.response?.candidates ??
      geminiResponse?.candidates ??
      [];

    const groundingMetadata = candidates[0]?.groundingMetadata;

    const groundingChunks = groundingMetadata?.groundingChunks ?? [];

    const groundingSources: GroundingSource[] = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web?.uri && web?.title)
      .map((web: any) => ({
        uri: web.uri as string,
        title: web.title as string,
      }));

    const filteredSources = groundingSources.filter((source) => {
      try {
        const sourceDomain = extractDomain(source.uri);
        if (sourceDomain === originalUrlDomain) return false;
        if (PAYWALLED_DOMAINS.some((pd) => sourceDomain.includes(pd))) return false;
        return true;
      } catch {
        return false;
      }
    });

    const uniqueSources = Array.from(
      new Map(filteredSources.map((item) => [item.uri, item])).values()
    );

    return NextResponse.json({
      summary: summary || "A summary could not be generated.",
      alternatives: uniqueSources,
    });
  } catch (error) {
    console.error("Error in /api/find route:", error);

    const message =
      error instanceof Error
        ? error.message
        : "An unknown error occurred";

    return NextResponse.json(
      { error: `AI analysis failed: ${message}` },
      { status: 500 }
    );
  }
}