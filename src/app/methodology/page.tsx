import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Cpu, AlertTriangle, BarChart3, ExternalLink, FileText, History } from "lucide-react";
import { SOURCE_COUNT } from "@/lib/sourceData";

export const metadata: Metadata = {
  title: "Methodology | MirrorSource",
  description: "The science and architecture behind MirrorSource. Learn about our decoupled Eyes + Brain design, academic frameworks, and limitations.",
};

export default function MethodologyPage() {
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
              <Link href="/methodology" className="text-blue-600 font-medium">Methodology</Link>
              <Link href="/sources" className="text-slate-600 hover:text-blue-600 transition-colors">Sources</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Methodology
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            The science and architecture behind MirrorSource.
          </p>
        </div>
      </section>

      {/* The Science Behind It */}
      <section className="py-16 px-4 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">The Science Behind It</h2>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="text-slate-600 leading-relaxed mb-6">
              MirrorSource draws on established frameworks in media analysis and journalism studies:
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Narrative Analysis</h3>
                <p className="text-sm text-slate-600 mb-3">
                  Based on Matt Taibbi&apos;s work on how different outlets frame the same events using different narrative structures—hero/villain, crisis/resolution, us/them.
                </p>
                <p className="text-xs text-slate-400">
                  See: Taibbi, M. (2019). Hate Inc.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Churnalism Research</h3>
                <p className="text-sm text-slate-600 mb-3">
                  Building on Nick Davies&apos; research showing how press releases and wire copy get recycled across outlets with minimal original reporting.
                </p>
                <p className="text-xs text-slate-400">
                  See: Davies, N. (2009). Flat Earth News
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Structural Analysis</h3>
                <p className="text-sm text-slate-600 mb-3">
                  Informed by Herman &amp; Chomsky&apos;s propaganda model, which examines how ownership, funding, and institutional pressures shape news coverage.
                </p>
                <p className="text-xs text-slate-400">
                  See: Herman, E. &amp; Chomsky, N. (1988). Manufacturing Consent
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Bias Rating Methodology</h3>
                <p className="text-sm text-slate-600 mb-3">
                  Political lean classifications sourced from AllSides (blind bias surveys) and Ad Fontes Media (content analysis methodology).
                </p>
                <p className="text-xs text-slate-400">
                  <a href="https://www.allsides.com/media-bias/ratings" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">AllSides</a> | <a href="https://adfontesmedia.com/how-ad-fontes-ranks-news-sources/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Ad Fontes</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Architecture */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Cpu className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Our Architecture</h2>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-blue-800 mb-3 text-lg">Decoupled &quot;Eyes + Brain&quot; Design</h3>
            <p className="text-blue-700 mb-4">
              MirrorSource separates search from synthesis to reduce latency and minimize AI hallucination.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <span className="text-xl">👁️</span> Eyes (Search Layer)
                </h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Brave Search API for real-time news discovery</li>
                  <li>• No content scraping or storage</li>
                  <li>• Returns source metadata only</li>
                </ul>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                  <span className="text-xl">🧠</span> Brain (Synthesis Layer)
                </h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Google Gemini for summarization</li>
                  <li>• Grounded in search results only</li>
                  <li>• Structured output (Common Ground, Key Differences)</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-slate-600 text-sm">
            This architecture means the AI never &quot;makes up&quot; sources—it can only work with what the search layer returns.
            Trade-off: if a source isn&apos;t indexed by the search API, we won&apos;t find it.
          </p>
        </div>
      </section>

      {/* Benchmarks */}
      <section className="py-16 px-4 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Benchmarks</h2>
          </div>

          <p className="text-slate-600 mb-6">
            Performance scores measured using Google Lighthouse. Results may vary by device and connection.
          </p>

          <Link
            href="/benchmarks"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            View detailed benchmark results
            <ExternalLink size={16} />
          </Link>
        </div>
      </section>

      {/* Limitations and Safety */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Limitations and Safety</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="font-semibold text-amber-800 mb-2">MirrorSource summarizes and compares coverage</h3>
              <p className="text-amber-700 text-sm">
                It does not fact-check. We show you how different sources are reporting a story, not which version is &quot;true.&quot;
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="font-semibold text-amber-800 mb-2">AI-generated summaries may contain errors</h3>
              <p className="text-amber-700 text-sm">
                Always click through to original sources to verify information. Our summaries are starting points, not endpoints.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="font-semibold text-amber-800 mb-2">We show confidence indicators where data is uncertain</h3>
              <p className="text-amber-700 text-sm">
                Story provenance, divergence levels, and coverage gaps are shown with appropriate uncertainty markers.
              </p>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 mb-2">Coverage limitations</h3>
              <ul className="text-slate-600 text-sm space-y-1">
                <li>• We analyze {SOURCE_COUNT}+ sources, but can&apos;t cover every outlet</li>
                <li>• Breaking news may have limited alternative coverage initially</li>
                <li>• Paywalled articles may require keyword search fallback</li>
                <li>• Political lean ratings are approximations, not absolute truths</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency */}
      <section className="py-16 px-4 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Transparency</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">No Tracking</h3>
              <p className="text-sm text-slate-600">
                We use Vercel Analytics for aggregate page views only. No cookies, no user profiles, no reading history.
                Your searches are processed in real-time and not stored.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                Changelog
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                Major updates are documented in our changelog.
              </p>
              <Link
                href="/changelog"
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                View changelog
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          <p className="text-sm text-slate-500 mt-6">
            We may publish aggregate pilot learnings (e.g., &quot;users found X feature helpful&quot;). No personal data is ever shared.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-slate-100">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Questions about our methodology?
          </h2>
          <p className="text-slate-600 mb-8">
            We&apos;re always looking to improve. Join the pilot and share your feedback.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pilot"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-colors"
            >
              Join the Pilot
              <ExternalLink size={18} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-8 rounded-full transition-colors border border-slate-200"
            >
              Contact Us
              <ExternalLink size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 text-sm text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
            <p>&copy; {new Date().getFullYear()} MirrorSource</p>
            <div className="flex items-center gap-6">
              <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
              <Link href="/methodology" className="hover:text-blue-600 transition-colors">Methodology</Link>
              <Link href="/sources" className="hover:text-blue-600 transition-colors">Sources</Link>
              <Link href="/pilot" className="hover:text-blue-600 transition-colors">Pilot</Link>
              <Link href="/legal" className="hover:text-blue-600 transition-colors">Legal</Link>
              <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Built in British Columbia, Canada 🍁 | We link to original sources and respect publisher terms
          </p>
        </div>
      </footer>
    </main>
  );
}
