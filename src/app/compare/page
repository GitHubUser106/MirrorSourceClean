"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Check, X, Minus, ChevronDown, ChevronUp } from "lucide-react";

interface SourceData {
  id: string;
  name: string;
  type: 'Wire' | 'Corporate' | 'Public' | 'International' | 'Local' | 'Syndicated';
  url: string;
  domain: string;
  headline?: string;
  keyPoints?: string[];
  tone?: string;
  focus?: string;
  missing?: string;
}

const typeColors: Record<string, string> = {
  Wire: 'bg-blue-100 text-blue-700 border-blue-200',
  Corporate: 'bg-slate-100 text-slate-700 border-slate-200',
  Public: 'bg-green-100 text-green-700 border-green-200',
  International: 'bg-purple-100 text-purple-700 border-purple-200',
  Local: 'bg-teal-100 text-teal-700 border-teal-200',
  Syndicated: 'bg-gray-100 text-gray-600 border-gray-200',
};

const typeDescriptions: Record<string, string> = {
  Wire: 'News agencies that provide factual reporting to other outlets',
  Corporate: 'Privately-owned media companies, often ad-supported',
  Public: 'Publicly funded broadcasting, less commercial pressure',
  International: 'Non-US outlets offering global perspective',
  Local: 'Regional newspapers and stations',
  Syndicated: 'Content republished from other sources',
};

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<SourceData[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showTypeInfo, setShowTypeInfo] = useState<string | null>(null);

  // Load sources from URL params or localStorage
  useEffect(() => {
    const sourcesParam = searchParams.get('sources');
    if (sourcesParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sourcesParam));
        setSources(parsed);
        // Auto-select first 2-3 sources
        setSelectedIds(parsed.slice(0, Math.min(3, parsed.length)).map((s: SourceData) => s.id));
      } catch (e) {
        console.error('Failed to parse sources:', e);
      }
    }
    setLoading(false);
  }, [searchParams]);

  const selectedSources = sources.filter(s => selectedIds.includes(s.id));
  const availableSources = sources.filter(s => !selectedIds.includes(s.id));

  const toggleSource = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(s => s !== id));
    } else if (selectedIds.length < 3) {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  // Group sources by type for the insight
  const typeGroups = selectedSources.reduce((acc, source) => {
    acc[source.type] = (acc[source.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getInsight = () => {
    const types = Object.keys(typeGroups);
    if (types.length === 1) {
      return `You're comparing ${types.length} ${types[0].toLowerCase()} source${typeGroups[types[0]] > 1 ? 's' : ''}. Consider adding sources with different ownership models for a broader perspective.`;
    }
    if (types.length >= 3) {
      return `Great diversity! You're comparing sources across ${types.length} different ownership models, giving you a well-rounded view of this story.`;
    }
    return `You're comparing ${types.join(' and ').toLowerCase()} sources. Each ownership model brings different editorial priorities and perspectives.`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading comparison...</div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">No sources to compare</h1>
        <p className="text-slate-600 mb-6">Search for a story first, then select sources to compare.</p>
        <Link href="/" className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-full font-medium">
          Go to MirrorSource
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back to results</span>
            </Link>
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="MirrorSource" width={140} height={35} className="h-8 w-auto" />
            </Link>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Compare Coverage</h1>
          <p className="text-slate-600">See how different sources cover the same story</p>
        </div>

        {/* Source Selector */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600 mr-2">Comparing:</span>
            {selectedSources.map(source => (
              <button
                key={source.id}
                onClick={() => toggleSource(source.id)}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 text-sm transition-colors"
              >
                <img src={getFaviconUrl(source.domain)} alt="" className="w-4 h-4 rounded" />
                <span className="font-medium text-slate-700">{source.name}</span>
                <X size={14} className="text-slate-400 hover:text-slate-600" />
              </button>
            ))}
            {availableSources.length > 0 && selectedIds.length < 3 && (
              <select
                className="bg-white border border-slate-200 rounded-full px-3 py-1.5 text-sm text-slate-600 cursor-pointer hover:border-slate-300"
                onChange={(e) => {
                  if (e.target.value) {
                    toggleSource(e.target.value);
                    e.target.value = '';
                  }
                }}
                value=""
              >
                <option value="">+ Add source</option>
                {availableSources.map(source => (
                  <option key={source.id} value={source.id}>{source.name}</option>
                ))}
              </select>
            )}
          </div>
          {selectedIds.length >= 3 && (
            <p className="text-xs text-slate-500 mt-2">Maximum 3 sources for comparison</p>
          )}
        </div>

        {/* Side-by-Side Cards */}
        {selectedSources.length > 0 ? (
          <div className={`grid gap-4 mb-8 ${
            selectedSources.length === 1 ? 'md:grid-cols-1 max-w-xl' : 
            selectedSources.length === 2 ? 'md:grid-cols-2' : 
            'md:grid-cols-3'
          }`}>
            {selectedSources.map(source => (
              <div key={source.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Source Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <img src={getFaviconUrl(source.domain)} alt="" className="w-6 h-6 rounded" />
                      <span className="font-semibold text-slate-900">{source.name}</span>
                    </div>
                    <button
                      onClick={() => setShowTypeInfo(showTypeInfo === source.type ? null : source.type)}
                      className={`text-xs px-2 py-1 rounded-full border ${typeColors[source.type]} cursor-help`}
                    >
                      {source.type}
                    </button>
                  </div>
                  {showTypeInfo === source.type && (
                    <p className="text-xs text-slate-500 mt-2 p-2 bg-white rounded border border-slate-200">
                      {typeDescriptions[source.type]}
                    </p>
                  )}
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#2563eb] hover:underline text-sm flex items-center gap-1"
                  >
                    Read full article <ExternalLink size={12} />
                  </a>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* Headline */}
                  {source.headline && (
                    <div className="mb-4 pb-4 border-b border-slate-100">
                      <h3 className="font-medium text-slate-900 leading-snug">
                        "{source.headline}"
                      </h3>
                    </div>
                  )}

                  {/* Key Points */}
                  {source.keyPoints && source.keyPoints.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Points</h4>
                      <ul className="space-y-2">
                        {source.keyPoints.map((point, i) => (
                          <li key={i} className="text-sm text-slate-700 flex gap-2">
                            <span className="text-slate-400">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Analysis (collapsible on mobile) */}
                  <div className="mt-auto">
                    <button
                      onClick={() => setExpandedCard(expandedCard === source.id ? null : source.id)}
                      className="flex items-center justify-between w-full text-left md:hidden py-2 text-sm text-slate-600"
                    >
                      <span>View analysis</span>
                      {expandedCard === source.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className={`space-y-3 ${expandedCard === source.id || 'hidden md:block'}`}>
                      {source.tone && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tone</span>
                          <p className="text-sm text-slate-700">{source.tone}</p>
                        </div>
                      )}
                      {source.focus && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Focus</span>
                          <p className="text-sm text-slate-700">{source.focus}</p>
                        </div>
                      )}
                      {source.missing && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Not Covered</span>
                          <p className="text-sm text-slate-500 italic">{source.missing}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mb-8">
            <p className="text-slate-600">Select at least one source to compare</p>
          </div>
        )}

        {/* Ownership Type Legend */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">Understanding Ownership Types</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(typeDescriptions).map(([type, desc]) => (
              <div key={type} className="flex gap-3">
                <span className={`text-xs px-2 py-1 rounded-full border h-fit whitespace-nowrap ${typeColors[type]}`}>
                  {type}
                </span>
                <p className="text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Insight Box */}
        {selectedSources.length >= 2 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span>💡</span> Perspective Check
            </h3>
            <p className="text-slate-700 text-sm leading-relaxed">
              {getInsight()}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} MirrorSource</p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-[#2563eb] transition-colors">About</Link>
            <Link href="/legal" className="hover:text-[#2563eb] transition-colors">Legal</Link>
            <Link href="/contact" className="hover:text-[#2563eb] transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}