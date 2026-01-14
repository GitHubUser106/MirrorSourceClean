import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search, FileText, ExternalLink, Shield, Zap, Globe, BarChart3, Scale, Eye } from "lucide-react";
import { SOURCE_COUNT } from "@/lib/sourceData";

export const metadata: Metadata = {
  title: "About | MirrorSource",
  description: "Learn how MirrorSource helps you see the whole story by comparing 195+ news sources across the political spectrum.",
};

export default function AboutPage() {
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
              <Link href="/about" className="text-blue-600 font-medium">About</Link>
              <Link href="/sources" className="text-slate-600 hover:text-blue-600 transition-colors">Sources</Link>
              <a href="https://chromewebstore.google.com/detail/mirrorsource/pbkhmfaocbdakhlpbdebghpdmkpbfohk" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-blue-600 transition-colors">Extension</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            See the whole story.
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            MirrorSource compares how <strong className="text-slate-800">{SOURCE_COUNT}+ news sources</strong> cover the same story. See the full political spectrum, understand where sources agree and disagree, and discover who owns what you read.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">1. Paste a Link</h3>
              <p className="text-slate-600">
                Drop in any news article URL. We find related coverage from across the political spectrum.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">2. See the Spectrum</h3>
              <p className="text-slate-600">
                View coverage distribution from Left to Right. Identify gaps and see where your source fits.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Eye className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">3. Know the Source</h3>
              <p className="text-slate-600">
                Flip any card to see ownership, funding, and political lean. Understand who&apos;s behind what you read.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
            What You Get
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Coverage Distribution</h3>
              </div>
              <p className="text-slate-600 mb-3">
                See a 5-bar chart showing how many sources cover the story from each political perspective: Left, Center-Left, Center, Center-Right, and Right.
              </p>
              <p className="text-sm text-slate-500">
                Click any bar to filter sources by perspective.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Intel Brief</h3>
              </div>
              <p className="text-slate-600 mb-3">
                Understand where sources agree (Common Ground) and where they differ (Key Differences). See the Divergence Meter to gauge how contentious the story is.
              </p>
              <p className="text-sm text-slate-500">
                Includes story provenance and narrative framing analysis.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Eye className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Source Transparency</h3>
              </div>
              <p className="text-slate-600 mb-3">
                Flip any source card to reveal ownership structure, funding model, country of origin, and political lean rating.
              </p>
              <p className="text-sm text-slate-500">
                Know if it&apos;s billionaire-owned, nonprofit, public, or corporate.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Scale className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Bias Ratings</h3>
              </div>
              <p className="text-slate-600 mb-3">
                Political lean ratings sourced from <a href="https://www.allsides.com/media-bias/ratings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">AllSides</a> and <a href="https://adfontesmedia.com/interactive-media-bias-chart/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ad Fontes Media</a>.
              </p>
              <p className="text-sm text-slate-500">
                {SOURCE_COUNT}+ sources rated and verified.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
            Our Principles
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Respects Copyright</h3>
                <p className="text-slate-600">
                  We never scrape, store, or republish copyrighted content. Our summaries are generated from public information, and we link directly to original sources.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Neutral by Design</h3>
                <p className="text-slate-600">
                  Our summaries are designed to be balanced and factual. We help you understand what happened, not what to think about it.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-orange-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Global Perspective</h3>
                <p className="text-slate-600">
                  See how stories are covered by sources from around the world—from major wire services to regional outlets you might never have found on your own.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Search className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Free to Use</h3>
                <p className="text-slate-600">
                  MirrorSource is free with 25 searches per day. We believe everyone deserves access to diverse news perspectives.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Ready to see the whole story?
          </h2>
          <p className="text-slate-600 mb-8">
            Try MirrorSource now—paste any news link and discover alternative coverage in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-colors"
            >
              Try MirrorSource
              <ExternalLink size={18} />
            </Link>
            <a
              href="https://chromewebstore.google.com/detail/mirrorsource/pbkhmfaocbdakhlpbdebghpdmkpbfohk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-8 rounded-full transition-colors border border-slate-200"
            >
              Get Chrome Extension
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} MirrorSource</p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
            <Link href="/sources" className="hover:text-blue-600 transition-colors">Sources</Link>
            <Link href="/legal" className="hover:text-blue-600 transition-colors">Legal</Link>
            <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}