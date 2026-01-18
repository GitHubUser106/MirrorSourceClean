import { NextRequest, NextResponse } from "next/server";

// Get build version from package.json
const BUILD_VERSION = process.env.npm_package_version || "0.1.0";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageUrl, helpful, comment, timestamp } = body;

    // Log issue report (in production, store in database)
    console.log("[Issue Report]", {
      pageUrl,
      helpful, // true/false/null
      comment: comment || "(not provided)",
      timestamp,
      buildVersion: BUILD_VERSION,
      userAgent: req.headers.get("user-agent"),
    });

    // In production, store this in Supabase
    // const { error } = await supabase.from('issue_reports').insert({
    //   page_url: pageUrl,
    //   helpful,
    //   comment,
    //   build_version: BUILD_VERSION,
    //   created_at: timestamp,
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Issue Report Error]", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 }
    );
  }
}
