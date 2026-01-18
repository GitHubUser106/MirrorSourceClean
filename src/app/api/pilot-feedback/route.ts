import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, whatBrought, feedback, timestamp } = body;

    // Validate that at least one feedback field is provided
    if (!whatBrought?.trim() && !feedback?.trim()) {
      return NextResponse.json(
        { error: "Please provide feedback" },
        { status: 400 }
      );
    }

    // Log feedback to console (in production, you'd store this in a database)
    console.log("[Pilot Feedback]", {
      email: email || "(not provided)",
      whatBrought: whatBrought || "(not provided)",
      feedback: feedback || "(not provided)",
      timestamp,
      userAgent: req.headers.get("user-agent"),
    });

    // In production, you would store this in Supabase or another database
    // Example:
    // const { error } = await supabase.from('pilot_feedback').insert({
    //   email,
    //   what_brought: whatBrought,
    //   feedback,
    //   created_at: timestamp,
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Pilot Feedback Error]", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
