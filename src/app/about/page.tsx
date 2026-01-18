import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Shield, Zap, Globe, ExternalLink, MapPin, Lock, Eye } from "lucide-react";
import { SOURCE_COUNT } from "@/lib/sourceData";

export const metadata: Metadata = {
  title: "About | MirrorSource",
  description: "Our mission is to help users see beyond their filter bubble. Built in British Columbia, Canada.",
};

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen bg-slate-50 flex flex-col">
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
              <Link href="/methodology" className="text-slate-600 hover:text-blue-600 transition-colors">Methodology</Link>
              <Link href="/sources" className="text-slate-600 hover:text-blue-600 transition-colors">Sources</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero - Mission */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Our Mission
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            MirrorSource helps users see beyond their filter bubble by showing how different outlets cover the same story. We believe understanding multiple perspectives is essential for informed citizenship.
          </p>
        </div>
      </section>

      {/* How It Works - Plain Language */}
      <section className="py-16 px-4 bg-white border-y border-slate-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">How It Works</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-lg text-slate-600 leading-relaxed">
              Paste any news article URL and we&apos;ll find how other sources are covering the same story. Our AI generates a neutral summary and identifies where sources agree (Common Ground) and where they differ (Key Differences). You can see the political lean of each source and flip any card to reveal ownership and funding information.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Privacy</h2>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="font-semibold text-green-800 mb-3">Stateless Design</h3>
            <ul className="space-y-2 text-green-700">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>No tracking cookies or analytics profiles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>No reading history stored</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>No user accounts required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Pilot feedback stored separately from usage</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Canadian Identity */}
      <section className="py-16 px-4 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🍁</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Canadian Identity</h2>
          </div>

          <div className="flex items-start gap-4">
            <MapPin className="w-5 h-5 text-red-600 mt-1 flex-shrink-0" />
            <div>
              <p className="text-lg text-slate-700 font-medium">Built in British Columbia, Canada</p>
              <p className="text-slate-600 mt-2">
                MirrorSource is developed and operated from British Columbia. We respect publisher terms and link directly to original sources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Principles */}
      <section className="py-16 px-4">
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
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Transparency First</h3>
                <p className="text-slate-600">
                  Every source card shows ownership, funding, and political lean. Know who&apos;s behind what you read.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-slate-100">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Ready to see the whole story?
          </h2>
          <p className="text-slate-600 mb-8">
            Try MirrorSource now—paste any news link and discover alternative coverage.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-colors"
            >
              Try MirrorSource
              <ExternalLink size={18} />
            </Link>
            <Link
              href="/methodology"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-8 rounded-full transition-colors border border-slate-200"
            >
              View Methodology
              <ExternalLink size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
            <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
            <Link href="/methodology" className="hover:text-blue-600 transition-colors">Methodology</Link>
            <Link href="/sources" className="hover:text-blue-600 transition-colors">Sources</Link>
            <Link href="/pilot" className="hover:text-blue-600 transition-colors">Pilot</Link>
            <Link href="/legal" className="hover:text-blue-600 transition-colors">Legal</Link>
            <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} MirrorSource</p>
          <p className="text-xs text-slate-400 text-center">
            Built in British Columbia, Canada 🍁 | We link to original sources and respect publisher terms
          </p>
        </div>
      </footer>
    </main>
  );
}
