import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, Monitor, Smartphone, Calendar, Info } from "lucide-react";

export const metadata: Metadata = {
  title: "Benchmarks | MirrorSource",
  description: "Lighthouse performance scores and benchmark results for MirrorSource.",
};

// Benchmark data - update this when running new Lighthouse tests
const LIGHTHOUSE_DATA = {
  testDate: "January 11, 2026",
  environment: {
    browser: "Chrome 120",
    connection: "Simulated slow 4G",
    device: "Moto G Power (Emulated)",
  },
  desktop: {
    performance: 94,
    accessibility: 98,
    bestPractices: 100,
    seo: 100,
  },
  mobile: {
    performance: 78,
    accessibility: 98,
    bestPractices: 100,
    seo: 100,
  },
};

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const getColor = (score: number) => {
    if (score >= 90) return { bg: "bg-green-100", text: "text-green-700", ring: "ring-green-500" };
    if (score >= 50) return { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-500" };
    return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-500" };
  };

  const colors = getColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className={`w-16 h-16 rounded-full ${colors.bg} ring-4 ${colors.ring} flex items-center justify-center mb-2`}>
        <span className={`text-xl font-bold ${colors.text}`}>{score}</span>
      </div>
      <span className="text-sm text-slate-600 text-center">{label}</span>
    </div>
  );
}

export default function BenchmarksPage() {
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
              <Link href="/about" className="text-slate-600 hover:text-blue-600 transition-colors">About</Link>
              <Link href="/methodology" className="text-slate-600 hover:text-blue-600 transition-colors">Methodology</Link>
              <Link href="/sources" className="text-slate-600 hover:text-blue-600 transition-colors">Sources</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Performance Benchmarks
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Lighthouse scores measuring performance, accessibility, best practices, and SEO.
          </p>
        </div>
      </section>

      {/* Test Environment */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-100 rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Test date: <strong className="text-slate-800">{LIGHTHOUSE_DATA.testDate}</strong></span>
            </div>
            <span className="text-slate-300">|</span>
            <span>Browser: <strong className="text-slate-800">{LIGHTHOUSE_DATA.environment.browser}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Connection: <strong className="text-slate-800">{LIGHTHOUSE_DATA.environment.connection}</strong></span>
          </div>
        </div>
      </section>

      {/* Desktop Scores */}
      <section className="py-12 px-4 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Desktop (1440px)</h2>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <ScoreCircle score={LIGHTHOUSE_DATA.desktop.performance} label="Performance" />
            <ScoreCircle score={LIGHTHOUSE_DATA.desktop.accessibility} label="Accessibility" />
            <ScoreCircle score={LIGHTHOUSE_DATA.desktop.bestPractices} label="Best Practices" />
            <ScoreCircle score={LIGHTHOUSE_DATA.desktop.seo} label="SEO" />
          </div>
        </div>
      </section>

      {/* Mobile Scores */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Mobile (390px - Simulated 4G)</h2>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <ScoreCircle score={LIGHTHOUSE_DATA.mobile.performance} label="Performance" />
            <ScoreCircle score={LIGHTHOUSE_DATA.mobile.accessibility} label="Accessibility" />
            <ScoreCircle score={LIGHTHOUSE_DATA.mobile.bestPractices} label="Best Practices" />
            <ScoreCircle score={LIGHTHOUSE_DATA.mobile.seo} label="SEO" />
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 px-4 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-amber-800 font-medium mb-1">About these scores</p>
              <p className="text-sm text-amber-700">
                These scores reflect testing on {LIGHTHOUSE_DATA.testDate}. Results may vary by device, connection speed, and server load.
                Lighthouse scores are measured using Chrome DevTools under controlled conditions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Optimize For */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-6">What We Optimize For</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Fast on Slow Connections</h3>
              <p className="text-sm text-slate-600">
                Our &quot;Eyes + Brain&quot; architecture separates search from synthesis, allowing results to stream in progressively even on 3G connections.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Mobile-First Design</h3>
              <p className="text-sm text-slate-600">
                All interactive elements have 44px minimum tap targets. Single-column layouts on mobile for easy reading.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Accessibility (WCAG AA)</h3>
              <p className="text-sm text-slate-600">
                4.5:1 color contrast for text, semantic HTML, keyboard navigation, and screen reader support.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">No Tracking Overhead</h3>
              <p className="text-sm text-slate-600">
                No third-party analytics scripts, no cookie banners, no ad networks. Just the core functionality.
              </p>
            </div>
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
