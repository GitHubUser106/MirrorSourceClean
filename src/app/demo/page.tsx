"use client";

// Demo page for Chrome Web Store screenshot
// Renders a high-fidelity analysis view with mock data

import Image from "next/image";
import { ProvenanceCard } from "@/components/ProvenanceCard";
import { NarrativeCard } from "@/components/NarrativeCard";
import { Check, CheckCircle2, Scale, AlertTriangle, BarChart3 } from "lucide-react";
import { LEAN_COLORS, LEAN_LABELS, type PoliticalLean } from "@/lib/sourceData";

// Mock data matching the Chrome Web Store screenshot requirements
const MOCK_DATA = {
  summary: "Russia launched an Oreshnik missile strike against Ukraine, which **many see as a warning** to the US and Europe. The missile struck a gas storage facility, **causing damage and casualties**. Reports suggest the strike was a response to the US capture of an oil tanker, demonstrating **Putin's anger** despite calls for peace.",

  provenance: {
    origin: 'wire_service' as const,
    originSource: 'Reuters',
    originConfidence: 'medium' as const,
    originalReporting: ['theglobeandmail.com', 'dailymail.co.uk'],
    aggregators: ['mirror.co.uk', 'independent.co.uk', 'the-express.com'],
    explanation: "Many outlets repeat the same basic information, suggesting a wire service (like Reuters) is the origin. The Globe and Mail and Daily Mail appear to have original reporting, with unique framing/details."
  },

  narrative: {
    emotionalIntensity: 7,
    narrativeType: 'policy' as const,
    isClickbait: true
  },

  commonGround: [
    { label: 'Event', value: 'Russia launched an Oreshnik missile strike' },
    { label: 'Target', value: 'Gas storage facility and medical center' },
    { label: 'Interpretation', value: 'Warning to the West/US/Europe' }
  ],

  keyDifferences: [
    { label: 'Motivation', value: '**Daily Mail** claims the strike was a \'revenge strike\' after Kyiv targeted Putin\'s residence; others do not mention this' },
    { label: 'Impact', value: '**Daily Mail** emphasizes the terror aspect and psychological impact rather than physical destruction' },
    { label: 'Scope', value: '**The Globe and Mail** highlights it as a reminder of Russia\'s capacity for further escalation in the ongoing war' }
  ],

  results: [
    {
      uri: 'https://www.theglobeandmail.com/world/article-russia-oreshnik-missile-ukraine/',
      title: 'Russia fires experimental Oreshnik missile at Ukraine in warning to West',
      displayName: 'THE GLOBE AND MAIL',
      sourceDomain: 'theglobeandmail.com',
      sourceType: 'national' as const,
      countryCode: 'CA',
      politicalLean: 'center-left',
      publishedAt: '2026-01-08T14:30:00Z'
    },
    {
      uri: 'https://www.dailymail.co.uk/news/article-russia-oreshnik-revenge-strike/',
      title: 'Putin\'s revenge: Russia launches terrifying Oreshnik missile after Ukraine targets Kremlin',
      displayName: 'DAILY MAIL',
      sourceDomain: 'dailymail.co.uk',
      sourceType: 'corporate' as const,
      countryCode: 'UK',
      politicalLean: 'right',
      publishedAt: '2026-01-08T15:00:00Z'
    },
    {
      uri: 'https://www.reuters.com/world/europe/russia-fires-oreshnik-missile-ukraine/',
      title: 'Russia fires Oreshnik missile at Ukraine gas facility, Kyiv says',
      displayName: 'REUTERS',
      sourceDomain: 'reuters.com',
      sourceType: 'wire' as const,
      countryCode: 'INT',
      politicalLean: 'center',
      publishedAt: '2026-01-08T13:45:00Z'
    },
    {
      uri: 'https://www.foxnews.com/world/russia-oreshnik-missile-strike-ukraine-warning',
      title: 'Russia launches Oreshnik missile strike on Ukraine, warns of more to come',
      displayName: 'FOX NEWS',
      sourceDomain: 'foxnews.com',
      sourceType: 'corporate' as const,
      countryCode: 'US',
      politicalLean: 'right',
      publishedAt: '2026-01-08T16:00:00Z'
    },
    {
      uri: 'https://www.msnbc.com/world/russia-oreshnik-missile-escalation',
      title: 'Russia escalates with Oreshnik missile as Trump calls for peace talks',
      displayName: 'MSNBC',
      sourceDomain: 'msnbc.com',
      sourceType: 'corporate' as const,
      countryCode: 'US',
      politicalLean: 'left',
      publishedAt: '2026-01-08T17:30:00Z'
    },
    {
      uri: 'https://apnews.com/article/russia-ukraine-oreshnik-missile',
      title: 'Russia fires new Oreshnik missile at Ukraine in latest escalation',
      displayName: 'AP NEWS',
      sourceDomain: 'apnews.com',
      sourceType: 'wire' as const,
      countryCode: 'US',
      politicalLean: 'center',
      publishedAt: '2026-01-08T14:00:00Z'
    }
  ]
};

// Bar colors for coverage distribution
const BAR_COLORS: Record<string, string> = {
  'left': '#2563eb',
  'center-left': '#06b6d4',
  'center': '#a855f7',
  'center-right': '#f97316',
  'right': '#dc2626',
};

// Country flags
const countryFlags: Record<string, { flag: string; label: string }> = {
  US: { flag: '🇺🇸', label: 'US' },
  UK: { flag: '🇬🇧', label: 'UK' },
  CA: { flag: '🇨🇦', label: 'CA' },
  INT: { flag: '🌐', label: 'Intl' },
};

function parseMarkdownBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function VerticalBar({ count, maxCount, label, colorKey, isHighlighted }: { count: number; maxCount: number; label: string; colorKey: string; isHighlighted?: boolean }) {
  const heightPercent = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 25 : 8) : 8;

  return (
    <div className={`text-center flex-shrink-0 ${isHighlighted ? 'relative' : ''}`}>
      {isHighlighted && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-blue-600 font-medium whitespace-nowrap">
          📍 Your article
        </div>
      )}
      <div className="h-28 flex items-end justify-center mb-2">
        <div
          className={`w-14 rounded-t-lg flex items-end justify-center pb-2 transition-all duration-300 ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
          style={{
            backgroundColor: count > 0 ? (BAR_COLORS[colorKey] || BAR_COLORS['center']) : '#e2e8f0',
            height: `${heightPercent}%`,
            minHeight: '1.5rem'
          }}
        >
          <span className={`font-bold text-sm ${count > 0 ? 'text-white' : 'text-slate-400'}`}>{count}</span>
        </div>
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${isHighlighted ? 'text-blue-600' : 'text-slate-600'}`}>{label}</span>
    </div>
  );
}

export default function DemoPage() {
  // Calculate coverage distribution
  const dist = { left: 1, centerLeft: 1, center: 2, centerRight: 0, right: 2 };
  const maxCount = Math.max(dist.left, dist.centerLeft, dist.center, dist.centerRight, dist.right);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Image src="/logo.png" alt="MirrorSource" width={160} height={40} priority className="h-9 w-auto" />
            <div className="flex items-center gap-6">
              <nav className="flex items-center gap-6 text-sm">
                <span className="text-slate-600">About</span>
                <span className="text-slate-600">Sources</span>
                <span className="text-slate-600">Extension</span>
              </nav>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="font-medium text-slate-600">23/25 left</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Search Bar */}
      <div className="sticky top-[65px] z-40 bg-slate-50/95 backdrop-blur-sm py-3 px-4 shadow-sm border-b border-slate-200">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-2 border-slate-200 rounded-lg shadow-lg p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value="https://www.theglobeandmail.com/world/article-russia-oreshnik-missile-ukraine/"
                readOnly
                className="flex-1 px-4 py-3 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-sm"
              />
              <button className="bg-[#2563eb] text-white font-medium py-3 px-6 rounded-full text-sm">
                Analyze
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 bg-slate-50 px-4 pb-16">
        <div className="max-w-4xl mx-auto space-y-8 pt-6">

          {/* Summary */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-slate-900">Summary</h2>
            </div>
            <p className="text-lg leading-8 text-slate-600 max-w-prose">
              {parseMarkdownBold(MOCK_DATA.summary)}
            </p>
          </div>

          {/* Intel Brief */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
              <h2 className="text-2xl font-bold text-slate-900">Intel Brief</h2>
            </div>

            {/* Story Provenance */}
            <ProvenanceCard provenance={MOCK_DATA.provenance} />

            {/* Narrative Style */}
            <NarrativeCard narrative={MOCK_DATA.narrative} />

            {/* Divergence Meter - High */}
            <div className="mb-6 px-4 py-2.5 rounded-lg bg-red-100 flex items-center gap-2 flex-wrap">
              <span className="text-lg">🔴</span>
              <span className="font-semibold text-red-800">High Divergence</span>
              <span className="text-slate-600 text-sm">— Sources disagree on key facts or framing</span>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Common Ground */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Common Ground</h3>
                </div>
                <ul className="space-y-2">
                  {MOCK_DATA.commonGround.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-base text-slate-600">
                      <Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span><span className="font-medium text-slate-700">{fact.label}:</span> {fact.value}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Differences */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="w-4 h-4 text-orange-600" />
                  <h3 className="text-sm font-semibold text-orange-800 uppercase tracking-wide">Key Differences</h3>
                </div>
                <ul className="space-y-2">
                  {MOCK_DATA.keyDifferences.map((diff, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-base text-orange-700">
                      <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span><span className="font-medium text-orange-800">{diff.label}:</span> {parseMarkdownBold(diff.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Coverage Distribution */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-8">
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Coverage Distribution</h3>
              </div>

              {/* Input source indicator */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center gap-2 flex-wrap">
                <span className="text-blue-600 font-medium text-sm">📍 Your article:</span>
                <span className="font-semibold text-slate-800">The Globe and Mail</span>
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-cyan-100 text-cyan-700">
                  Center-Left
                </span>
              </div>

              {/* Vertical bar chart */}
              <div className="flex justify-center gap-6 pt-6">
                <VerticalBar count={dist.left} maxCount={maxCount} label="Left" colorKey="left" />
                <VerticalBar count={dist.centerLeft} maxCount={maxCount} label="Center-Left" colorKey="center-left" isHighlighted />
                <VerticalBar count={dist.center} maxCount={maxCount} label="Center" colorKey="center" />
                <VerticalBar count={dist.centerRight} maxCount={maxCount} label="Center-Right" colorKey="center-right" />
                <VerticalBar count={dist.right} maxCount={maxCount} label="Right" colorKey="right" />
              </div>
            </div>
          </div>

          {/* Source Analysis Cards */}
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Scale size={22} className="text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">Source Analysis</h2>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">6 sources</span>
              </div>
              <p className="text-slate-500 text-sm">Tap any card to see ownership transparency</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOCK_DATA.results.map((source, idx) => {
                const lean = source.politicalLean as PoliticalLean;
                const colors = LEAN_COLORS[lean] || LEAN_COLORS['center'];
                const label = LEAN_LABELS[lean] || 'Center';
                const country = countryFlags[source.countryCode] || countryFlags['US'];

                return (
                  <article
                    key={idx}
                    className="group relative bg-white rounded-xl border border-slate-200 shadow-sm p-4 transition-all hover:bg-slate-50 hover:shadow-md hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-2.5">
                      {/* Top row: Name + Country */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold uppercase tracking-wide text-blue-600">
                          {source.displayName}
                        </span>
                        <span className="text-sm" title={country.label}>
                          {country.flag}
                        </span>
                      </div>

                      {/* Badge row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors.bg} ${colors.text}`}>
                          {label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {source.sourceType === 'wire' ? 'Wire' : source.sourceType === 'national' ? 'National' : 'Corporate'}
                        </span>
                      </div>

                      {/* Headline */}
                      <h3 className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                        {source.title}
                      </h3>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-slate-500">
          <p>&copy; 2026 MirrorSource</p>
          <div className="flex items-center gap-6">
            <span>About</span>
            <span>Sources</span>
            <span>Legal</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
