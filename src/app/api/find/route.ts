import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { GroundingSource } from "../../../types";

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

// read the key once when the module loads
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error(
    "GOOGLE_API_KEY is not set. Add it to .env.local and restart `npm run dev`."
  );
}

const genAI = new GoogleGenAI({
  apiKey: apiKey || "",
});

function extractDomain(urlString: string): string {
  try {
    return new URL(urlString).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Small helper to strip ``` fences when the model wraps JSON in markdown
function stripMarkdownFences(text: string): string {
  let trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    // remove initial ``` or ```json
    trimmed = trimmed.replace(/^```[a-zA-Z0-9]*\s*/, "");
    // remove trailing ```
    trimmed = trimmed.replace(/```$/, "").trim();
  }
  return trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'url'" },
        { status: 400 }
      );
    }

    const originalUrlDomain = extractDomain(url);

    const prompt = `
You are MirrorSource, an expert news analyst.
Use the googleSearch tool to read the article at this URL and find other
articles covering the same story. Then write a concise, neutral, one paragraph
summary of the event as a whole.

You must:
1. Call googleSearch to fetch at least three alternative URLs.
2. Base your answer on those search results.
3. Return your answer as JSON in this exact shape:

{
  "summary": "A concise, neutral, one-paragraph summary of the news event."
}

Article URL: ${url}
    `.trim();

    // Follow the official JS pattern: tools go inside config
    const config: any = {
      tools: [{ googleSearch: {} }],
    };

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

    // Robustly extract text
    let text: string | undefined;

    if (geminiResponse?.response && typeof geminiResponse.response.text === "function") {
      text = geminiResponse.response.text();
    } else if (Array.isArray(geminiResponse?.candidates)) {
      text =
        geminiResponse.candidates[0]?.content?.parts?.[0]?.text ??
        geminiResponse.candidates[0]?.content?.parts?.[0]?.inlineData?.data;
    }

    if (!text) {
      console.error("Gemini raw response with no text:", geminiResponse);
      throw new Error("Model response did not contain any text content.");
    }

    // Extract and clean summary text so only the paragraph remains
    let summary: string;
    let cleaned = stripMarkdownFences(String(text)).trim();

    // Try to parse JSON and pull out summary only
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.summary === "string") {
        cleaned = parsed.summary;
      }
    } catch {
      // not JSON, just keep cleaned as is
      console.warn("Model output was not valid JSON. Using raw text as summary.");
    }

    // Remove any enclosing quotes and extra spacing
    cleaned = cleaned.replace(/^"+|"+$/g, "").trim();

    summary = cleaned;

    // Work out candidates in either shape
    const candidates =
      geminiResponse?.response?.candidates ??
      geminiResponse?.candidates ??
      [];

    const groundingMetadata = candidates[0]?.groundingMetadata;
    console.log(
      "Grounding metadata:",
      JSON.stringify(groundingMetadata ?? {}, null, 2)
    );

    const groundingChunks =
      groundingMetadata?.groundingChunks ?? [];

    const groundingSources: GroundingSource[] = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web?.uri && web?.title)
      .map((web: any) => ({
        uri: web.uri as string,
        title: web.title as string,
      }));

    const filteredSources = groundingSources.filter((source) => {
      if (!source?.uri || !source.title) return false;
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

    if (!summary && uniqueSources.length === 0) {
      throw new Error(
        "The AI could not generate a summary or find alternative sources."
      );
    }

    return NextResponse.json({
      summary:
        summary ||
        "A summary could not be generated, but here are some alternative articles on the topic.",
      alternatives: uniqueSources,
    });
  } catch (error) {
    console.error("Error in /api/find route:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `AI analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
