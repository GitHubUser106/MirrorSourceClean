import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { History, Plus, Wrench, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog | MirrorSource",
  description: "Major updates and changes to MirrorSource.",
};

const CHANGELOG = [
  {
    version: "0.2.0",
    date: "January 2026",
    type: "feature" as const,
    title: "Pilot Program & Feedback System",
    changes: [
      "Added /pilot page for user feedback collection",
      "In-app feedback widget (thumbs up/down) after search results",
      "Report an issue functionality with automatic context",
      "Split About page into About (mission) and Methodology (technical)",
      "New /benchmarks page with Lighthouse scores",
      "Trust strip on homepage: Built in BC, No tracking, Fast on slow connections",
      "Below-the-fold section: Built for understanding, not outrage",
      "Updated footer with Canadian identity",
    ],
  },
  {
    version: "0.1.0",
    date: "December 2025",
    type: "feature" as const,
    title: "Initial Launch",
    changes: [
      "Coverage distribution chart showing political spectrum",
      "Intel Brief with Common Ground and Key Differences",
      "Source transparency flip cards with ownership data",
      "Story provenance detection (wire service, original reporting)",
      "Narrative analysis (policy, horse race, culture war)",
      "Chrome extension for one-click analysis",
      "Keyword search fallback for paywalled/share links",
      "Email gate for unlimited access",
    ],
  },
];

function ChangeTypeIcon({ type }: { type: "feature" | "fix" | "improvement" }) {
  switch (type) {
    case "feature":
      return <Plus className="w-4 h-4" />;
    case "fix":
      return <Wrench className="w-4 h-4" />;
    case "improvement":
      return <Sparkles className="w-4 h-4" />;
  }
}

function ChangeTypeBadge({ type }: { type: "feature" | "fix" | "improvement" }) {
  const styles = {
    feature: "bg-green-100 text-green-700",
    fix: "bg-orange-100 text-orange-700",
    improvement: "bg-blue-100 text-blue-700",
  };

  const labels = {
    feature: "New",
    fix: "Fix",
    improvement: "Improved",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[type]}`}>
      <ChangeTypeIcon type={type} />
      {labels[type]}
    </span>
  );
}

export default function ChangelogPage() {
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
            <History className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Changelog
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Major updates and changes to MirrorSource.
          </p>
        </div>
      </section>

      {/* Changelog Entries */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-12">
            {CHANGELOG.map((entry, idx) => (
              <article key={idx} className="relative">
                {/* Timeline line */}
                {idx < CHANGELOG.length - 1 && (
                  <div className="absolute left-4 top-12 bottom-0 w-px bg-slate-200" />
                )}

                {/* Version header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {entry.version.split(".")[1]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      v{entry.version} — {entry.title}
                    </h2>
                    <p className="text-sm text-slate-500">{entry.date}</p>
                  </div>
                  <ChangeTypeBadge type={entry.type} />
                </div>

                {/* Changes list */}
                <div className="ml-12">
                  <ul className="space-y-2">
                    {entry.changes.map((change, changeIdx) => (
                      <li key={changeIdx} className="flex items-start gap-2 text-slate-600">
                        <span className="text-blue-500 mt-1.5">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
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
