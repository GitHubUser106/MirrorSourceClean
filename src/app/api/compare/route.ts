import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

export async function POST(req: NextRequest) {
  try {
    const { sources } = await req.json();

    if (!sources || sources.length === 0) {
      return NextResponse.json({ error: "No sources provided" }, { status: 400 });
    }

    const sourceList = sources.map((s: any, i: number) =>
      `Source ${i + 1} (${s.name}): URL: ${s.url}`
    ).join('\n');

    const prompt = `Analyze these news sources covering the same story. For EACH source, provide analysis.

SOURCES:
${sourceList}

Return a JSON object with this EXACT structure:
{
  "analyses": [
    {
      "sourceId": "source-0",
      "headline": "The likely headline or main angle (max 10 words)",
      "tone": "1-2 word emotional tone (e.g., 'Urgent', 'Measured', 'Critical', 'Sympathetic')",
      "focus": "What this source emphasizes (max 8 words)",
      "uniqueAngle": "What makes this coverage different (max 12 words)",
      "missingContext": "What this source doesn't cover (max 10 words)"
    }
  ]
}

RULES:
- Return one analysis object per source, in order
- sourceId should be "source-0", "source-1", etc.
- Keep all text concise
- If you cannot access the URL, infer from the source's typical editorial stance
- Be specific, not generic`;

    const response: any = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let text = response?.response?.text?.() || response?.candidates?.[0]?.content?.parts?.[0]?.text;

    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json(parsed);
    }

    return NextResponse.json({ analyses: [] });

  } catch (error) {
    console.error("[Compare API] Error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
