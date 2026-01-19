import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getIntensityWord } from "@/lib/briefHash";
import { Search, ExternalLink, CheckCircle2, AlertTriangle, Scale, BarChart3 } from "lucide-react";

// Server-side Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Fetch brief data
async function getBrief(hash: string) {
  const { data, error } = await getSupabaseClient()
    .from("shared_briefs")
    .select("*")
    .eq("hash", hash)
    .single();

  if (error || !data) {
    return null;
  }

  // Increment view count (fire and forget)
  getSupabaseClient()
    .from("shared_briefs")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("hash", hash)
    .then(() => {});

  return {
    hash: data.hash,
    originalUrl: data.original_url,
    topic: data.topic,
    summary: data.summary,
    commonGround: data.common_ground,
    keyDifferences: data.key_differences,
    provenance: data.provenance,
    narrative: data.narrative,
    sources: data.sources,
    emotionalIntensity: data.emotional_intensity,
    narrativeType: data.narrative_type,
    createdAt: data.created_at,
    viewCount: data.view_count,
  };
}

// Generate dynamic metadata for OG tags
export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}): Promise<Metadata> {
  const { hash } = await params;
  const brief = await getBrief(hash);

  if (!brief) {
    return {
      title: "Brief Not Found | MirrorSource",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://mirrorsource.app";
  const ogImageUrl = `${baseUrl}/api/og?topic=${encodeURIComponent(brief.topic || "News Analysis")}&intensity=${brief.emotionalIntensity || 5}&sources=${brief.sources?.length || 0}`;

  return {
    title: `${brief.topic} | MirrorSource`,
    description: brief.summary ? brief.summary.slice(0, 160) : "Compare news coverage across the political spectrum.",
    openGraph: {
      title: brief.topic || "News Analysis",
      description: brief.summary ? brief.summary.slice(0, 160) : "Compare news coverage across the political spectrum.",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: brief.topic || "News Analysis",
      description: brief.summary ? brief.summary.slice(0, 160) : "Compare news coverage across the political spectrum.",
      images: [ogImageUrl],
    },
  };
}

// Political lean colors
const LEAN_COLORS: Record<string, string> = {
  left: "#2563eb",
  "center-left": "#06b6d4",
  center: "#a855f7",
  "center-right": "#f97316",
  right: "#dc2626",
};

const LEAN_LABELS: Record<string, string> = {
  left: "Left",
  "center-left": "Center-Left",
  center: "Center",
  "center-right": "Center-Right",
  right: "Right",
};

export default async function BriefPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const brief = await getBrief(hash);

  if (!brief) {
    notFound();
  }

  const intensityWord = getIntensityWord(brief.emotionalIntensity || 5);
  const intensityColor =
    brief.emotionalIntensity <= 3
      ? "text-green-600"
      : brief.emotionalIntensity <= 6
      ? "text-yellow-600"
      : brief.emotionalIntensity <= 8
      ? "text-orange-600"
      : "text-red-600";

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="MirrorSource"
                width={160}
                height={40}
                className="h-9 w-auto"
              />
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/about" className="text-slate-600 hover:text-blue-600 transition-colors">About</Link>
              <Link href="/methodology" className="text-slate-600 hover:text-blue-600 transition-colors">Methodology</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Shared Brief Banner */}
      <div className="bg-blue-50 border-b border-blue-100 py-3 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-sm text-blue-700">
          <Scale size={16} />
          <span>Shared Intel Brief</span>
          <span className="text-blue-400">|</span>
          <span className="text-blue-600">{brief.viewCount || 1} views</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Topic/Headline */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">
            {brief.topic}
          </h1>

          {/* Emotional Intensity */}
          {brief.emotionalIntensity && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium text-slate-600">Emotional Intensity:</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded"
                        style={{
                          backgroundColor:
                            i < brief.emotionalIntensity
                              ? brief.emotionalIntensity <= 3
                                ? "#22c55e"
                                : brief.emotionalIntensity <= 6
                                ? "#eab308"
                                : brief.emotionalIntensity <= 8
                                ? "#f97316"
                                : "#ef4444"
                              : "#e2e8f0",
                        }}
                      />
                    ))}
                  </div>
                  <span className={`font-bold ${intensityColor}`}>
                    {brief.emotionalIntensity}/10 {intensityWord}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {brief.summary && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-600" />
                Summary
              </h2>
              <p className="text-slate-700 leading-relaxed">{brief.summary}</p>
            </div>
          )}

          {/* Intel Brief */}
          {(brief.commonGround || brief.keyDifferences) && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Scale size={20} className="text-purple-600" />
                Intel Brief
              </h2>

              {/* Common Ground */}
              {brief.commonGround && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    Common Ground
                  </h3>
                  {Array.isArray(brief.commonGround) ? (
                    <ul className="space-y-2">
                      {brief.commonGround.map((fact: { label: string; value: string }, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-green-700">
                          <span className="text-green-500 mt-1">•</span>
                          <span><span className="font-medium">{fact.label}:</span> {fact.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-green-700">{String(brief.commonGround)}</p>
                  )}
                </div>
              )}

              {/* Key Differences */}
              {brief.keyDifferences && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                  <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    Key Differences
                  </h3>
                  {Array.isArray(brief.keyDifferences) ? (
                    <ul className="space-y-2">
                      {brief.keyDifferences.map((diff: { label: string; value: string }, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-orange-700">
                          <span className="text-orange-500 mt-1">•</span>
                          <span><span className="font-medium">{diff.label}:</span> {diff.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-orange-700">{String(brief.keyDifferences)}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sources */}
          {brief.sources && brief.sources.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                Sources ({brief.sources.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {brief.sources.slice(0, 8).map((source: { displayName: string; uri: string; politicalLean?: string }, idx: number) => (
                  <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: LEAN_COLORS[source.politicalLean || "center"] || "#a855f7",
                      }}
                    />
                    <span className="text-sm text-slate-700 truncate flex-1">{source.displayName}</span>
                    <ExternalLink size={14} className="text-slate-400 flex-shrink-0" />
                  </a>
                ))}
              </div>
              {brief.sources.length > 8 && (
                <p className="text-sm text-slate-500 mt-3 text-center">
                  +{brief.sources.length - 8} more sources
                </p>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-8 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              What story are you following?
            </h2>
            <p className="text-slate-600 mb-6">
              See how different outlets cover the same news.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-full transition-colors"
            >
              <Search size={18} />
              Analyze a Story
            </Link>
          </div>

          {/* Original article link */}
          {brief.originalUrl && (
            <div className="mt-6 text-center">
              <a
                href={brief.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
              >
                View original article
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
            <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
            <Link href="/methodology" className="hover:text-blue-600 transition-colors">Methodology</Link>
            <Link href="/sources" className="hover:text-blue-600 transition-colors">Sources</Link>
            <Link href="/legal" className="hover:text-blue-600 transition-colors">Legal</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} MirrorSource</p>
          <p className="text-xs text-slate-400 text-center">
            Built in British Columbia, Canada
          </p>
        </div>
      </footer>
    </main>
  );
}
