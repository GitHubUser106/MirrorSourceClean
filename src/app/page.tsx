"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import type { GroundingSource } from "@/types";
import { Copy, Check, RefreshCw, Share2, CheckCircle2, Scale, AlertCircle, AlertTriangle, ArrowRight, FileText, BarChart3, Sparkles } from "lucide-react";
import { getPoliticalLean, LEAN_COLORS, LEAN_LABELS, type PoliticalLean } from "@/lib/sourceData";

// Political lean spectrum order for sorting (Left → Right)
const LEAN_ORDER: Record<string, number> = {
  'left': 1,
  'center-left': 2,
  'center': 3,
  'center-right': 4,
  'right': 5,
};

// Border colors for Compare Coverage cards based on political lean
const LEAN_BORDER_COLORS: Record<string, string> = {
  'left': 'border-l-4 border-l-blue-500',
  'center-left': 'border-l-4 border-l-cyan-500',
  'center': 'border-l-4 border-l-purple-400',
  'center-right': 'border-l-4 border-l-orange-500',
  'right': 'border-l-4 border-l-red-500',
};

type Usage = { used: number; remaining: number; limit: number; resetAt: string };
type CommonGroundFact = { label: string; value: string };
type KeyDifference = { label: string; value: string };

const loadingFacts = [
  "Scanning news sources...",
  "Finding alternative perspectives...",
  "Comparing coverage across outlets...",
  "Checking international sources...",
  "Looking for wire services...",
];

const scannerIcons = [
  { domain: "apnews.com", name: "AP News" },
  { domain: "reuters.com", name: "Reuters" },
  { domain: "bbc.com", name: "BBC" },
  { domain: "theguardian.com", name: "The Guardian" },
  { domain: "npr.org", name: "NPR" },
  { domain: "cbsnews.com", name: "CBS News" },
  { domain: "nbcnews.com", name: "NBC News" },
  { domain: "cnn.com", name: "CNN" },
  { domain: "foxnews.com", name: "Fox News" },
  { domain: "pbs.org", name: "PBS" },
  { domain: "politico.com", name: "Politico" },
  { domain: "axios.com", name: "Axios" },
  { domain: "thehill.com", name: "The Hill" },
  { domain: "usatoday.com", name: "USA Today" },
  { domain: "aljazeera.com", name: "Al Jazeera" },
  { domain: "forbes.com", name: "Forbes" },
];

const FEATURED_STORIES = [
  {
    headline: "New Epstein Files Released: Trump & Clinton Named",
    topic: "Politics & Accountability",
    icon: "⚖️",
    url: "https://www.nytimes.com/2025/12/18/us/jeffrey-epstein-donald-trump.html"
  },
  {
    headline: "HHS Proposes Ban on Gender Care Funding",
    topic: "Healthcare Policy",
    icon: "🏥",
    url: "https://www.nytimes.com/2025/12/18/health/trump-gender-affirming-care-funding.html"
  },
  {
    headline: "Fed Holds Rates Steady Amid Inflation Concerns",
    topic: "Economy & Markets",
    icon: "📉",
    url: "https://www.nytimes.com/2025/12/18/business/economy/inflation-cpi-interest-rates.html"
  }
];

// Rotate story daily based on date
const getDailyStory = () => {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return FEATURED_STORIES[dayIndex % FEATURED_STORIES.length];
};

function parseMarkdownBold(text: string, variant: 'summary' | 'intel' = 'summary'): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className={variant === 'summary' ? "font-semibold text-slate-900" : "font-semibold"}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function getHighResFavicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain.replace(/^www\./, '')}&sz=128`;
}

// Divergence level indicator for Intel Brief
function getDivergenceLevel(keyDifferences: KeyDifference[] | string | null): { level: string; color: string; bg: string; icon: string; description: string } {
  if (Array.isArray(keyDifferences)) {
    if (keyDifferences.length >= 2) {
      return {
        level: 'High',
        color: 'text-red-800',
        bg: 'bg-red-100',
        icon: '🔴',
        description: 'Sources disagree on key facts or framing'
      };
    } else if (keyDifferences.length === 1) {
      return {
        level: 'Moderate',
        color: 'text-yellow-800',
        bg: 'bg-yellow-100',
        icon: '🟡',
        description: 'Sources agree on facts but differ in framing'
      };
    }
  }
  return {
    level: 'Low',
    color: 'text-green-800',
    bg: 'bg-green-100',
    icon: '🟢',
    description: 'Sources largely agree on facts and framing'
  };
}

// Coverage distribution helper - shows 5 political lean categories
// Uses shared getPoliticalLean as fallback for consistent categorization
// Includes the input source URL if provided
function getCoverageDistribution(results: GroundingSource[], inputUrl?: string): {
  left: number;
  centerLeft: number;
  center: number;
  centerRight: number;
  right: number;
  total: number;
  inputLean?: PoliticalLean;
} {
  let left = 0, centerLeft = 0, center = 0, centerRight = 0, right = 0;
  let inputLean: PoliticalLean | undefined;

  // Include the INPUT source first (the URL the user pasted)
  if (inputUrl) {
    inputLean = getPoliticalLean(inputUrl);
    switch (inputLean) {
      case 'left': left++; break;
      case 'center-left': centerLeft++; break;
      case 'center-right': centerRight++; break;
      case 'right': right++; break;
      default: center++; break;
    }
  }

  // Then count all FOUND sources
  if (results && results.length) {
    for (const r of results) {
      // Use API-provided lean, or fall back to shared source data lookup
      const lean = (r.politicalLean?.toLowerCase() || getPoliticalLean(r.sourceDomain || r.uri)) as PoliticalLean;

      switch (lean) {
        case 'left': left++; break;
        case 'center-left': centerLeft++; break;
        case 'center-right': centerRight++; break;
        case 'right': right++; break;
        default: center++; break; // 'center' and any unknown
      }
    }
  }

  const total = (inputUrl ? 1 : 0) + (results?.length || 0);
  return { left, centerLeft, center, centerRight, right, total, inputLean };
}

// Hex colors for vertical bars (avoids Tailwind purge issues with dynamic classes)
const BAR_COLORS: Record<string, string> = {
  'left': '#2563eb',        // blue-600
  'center-left': '#06b6d4', // cyan-500
  'center': '#a855f7',      // purple-500
  'center-right': '#f97316', // orange-500
  'right': '#dc2626',       // red-600
};

// Static vertical bar for Coverage Distribution
function VerticalBar({ count, maxCount, label, colorKey }: { count: number; maxCount: number; label: string; colorKey: string }) {
  const heightPercent = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 25 : 0) : 0;

  return (
    <div className="text-center flex-shrink-0">
      <div className="h-28 flex items-end justify-center mb-2">
        <div
          className="w-10 sm:w-12 md:w-14 rounded-t-lg flex items-end justify-center pb-2"
          style={{
            backgroundColor: BAR_COLORS[colorKey] || BAR_COLORS['center'],
            height: `${heightPercent}%`,
            minHeight: count > 0 ? '2.5rem' : '0'
          }}
        >
          {count > 0 && (
            <span className="text-white font-bold text-xs sm:text-sm">{count}</span>
          )}
        </div>
      </div>
      <span className="text-[10px] sm:text-xs text-slate-600 font-medium whitespace-nowrap">{label}</span>
    </div>
  );
}

// Coverage Distribution Chart with vertical bars (v0 style)
function CoverageDistributionChart({ results, lastSubmittedUrl }: { results: GroundingSource[]; lastSubmittedUrl: string }) {
  const dist = getCoverageDistribution(results, lastSubmittedUrl);

  const inputSourceName = (() => {
    try {
      const hostname = new URL(lastSubmittedUrl).hostname.replace('www.', '');
      return hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
    } catch {
      return null;
    }
  })();

  const maxCount = Math.max(dist.left, dist.centerLeft, dist.center, dist.centerRight, dist.right, 1);

  return (
    <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Coverage Distribution</h3>
      </div>

      {/* Input source indicator */}
      {inputSourceName && dist.inputLean && (
        <p className="text-sm text-gray-500 mb-4 flex items-center gap-2 flex-wrap">
          <span>📍 Your article:</span>
          <span className="font-medium text-slate-700">{inputSourceName}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${LEAN_COLORS[dist.inputLean].bg} ${LEAN_COLORS[dist.inputLean].text}`}>
            {LEAN_LABELS[dist.inputLean]}
          </span>
        </p>
      )}

      {/* Vertical bar chart */}
      <div className="flex justify-center gap-2 sm:gap-4 md:gap-6">
        <VerticalBar key="left" count={dist.left} maxCount={maxCount} label="Left" colorKey="left" />
        <VerticalBar key="center-left" count={dist.centerLeft} maxCount={maxCount} label="Center-Left" colorKey="center-left" />
        <VerticalBar key="center" count={dist.center} maxCount={maxCount} label="Center" colorKey="center" />
        <VerticalBar key="center-right" count={dist.centerRight} maxCount={maxCount} label="Center-Right" colorKey="center-right" />
        <VerticalBar key="right" count={dist.right} maxCount={maxCount} label="Right" colorKey="right" />
      </div>

      {/* Gap warnings */}
      {(dist.left + dist.centerLeft === 0) && dist.total > 0 && (
        <p className="mt-4 text-sm text-orange-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Coverage gap: no left-leaning sources found
        </p>
      )}
      {(dist.right + dist.centerRight === 0) && dist.total > 0 && (
        <p className="mt-4 text-sm text-orange-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Coverage gap: no right-leaning sources found
        </p>
      )}
    </div>
  );
}

// Select one source from each of the 5 political lean categories for full spectrum coverage
// Uses shared getPoliticalLean for consistent categorization
function getSpectrumSources(results: GroundingSource[]): string[] {
  if (!results || results.length === 0) {
    return [];
  }

  // Helper to get lean with fallback to shared source data
  const getLean = (r: GroundingSource): PoliticalLean =>
    (r.politicalLean?.toLowerCase() || getPoliticalLean(r.sourceDomain || r.uri)) as PoliticalLean;

  // Separate into 5 distinct buckets - one for each lean category
  const buckets: Record<PoliticalLean, GroundingSource[]> = {
    'left': [],
    'center-left': [],
    'center': [],
    'center-right': [],
    'right': [],
  };

  for (const r of results) {
    const lean = getLean(r);
    buckets[lean].push(r);
  }

  const selected: string[] = [];
  const usedUris = new Set<string>();

  // Helper to pick first unused source from a bucket
  const pickFrom = (bucket: GroundingSource[]): string | null => {
    for (const source of bucket) {
      if (!usedUris.has(source.uri)) {
        usedUris.add(source.uri);
        return source.uri;
      }
    }
    return null;
  };

  // Pick one from each category in spectrum order (Left → Right)
  const leanOrder: PoliticalLean[] = ['left', 'center-left', 'center', 'center-right', 'right'];
  for (const lean of leanOrder) {
    const pick = pickFrom(buckets[lean]);
    if (pick) selected.push(pick);
  }

  // If we don't have 4 yet, fill from any remaining sources
  if (selected.length < 4) {
    for (const r of results) {
      if (!usedUris.has(r.uri)) {
        usedUris.add(r.uri);
        selected.push(r.uri);
        if (selected.length >= 4) break;
      }
    }
  }


  return selected.slice(0, 4);
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [commonGround, setCommonGround] = useState<CommonGroundFact[] | string | null>(null);
  const [keyDifferences, setKeyDifferences] = useState<KeyDifference[] | string | null>(null);
  const [results, setResults] = useState<GroundingSource[]>([]);
  const [isPaywalled, setIsPaywalled] = useState(false);
  const [diversityWarning, setDiversityWarning] = useState<string | null>(null);
  const [queryBiasWarning, setQueryBiasWarning] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const hasAutoSearchedRef = useRef(false);
  const [loadingFactIndex, setLoadingFactIndex] = useState(0);
  const [scannerIconIndex, setScannerIconIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [lastSubmittedUrl, setLastSubmittedUrl] = useState("");
  const [showKeywordFallback, setShowKeywordFallback] = useState(false);
  const [keywordFallbackType, setKeywordFallbackType] = useState<'share' | 'premium' | null>(null);
  const [keywords, setKeywords] = useState("");
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [inlineComparison, setInlineComparison] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const hasAutoSelected = useRef(false);

  // Auto-select divergent trio (Left + Center + Right) when results load - only once per search
  useEffect(() => {
    if (results && results.length >= 3 && !hasAutoSelected.current) {
      const autoSelected = getSpectrumSources(results);
      setSelectedForCompare(autoSelected);
      hasAutoSelected.current = true;
    }
  }, [results]);

  // Auto-fetch inline comparison when spectrum sources are selected
  useEffect(() => {
    async function fetchInlineComparison() {
      if (selectedForCompare.length >= 2 && results.length > 0) {
        setLoadingComparison(true);
        setInlineComparison(null);
        try {
          // Get selected sources and sort by political lean (Left → Right)
          const selectedSources = results
            .filter(r => selectedForCompare.includes(r.uri))
            .slice(0, 5)
            .sort((a, b) => {
              const leanA = (a.politicalLean?.toLowerCase() || getPoliticalLean(a.sourceDomain || '')) as string;
              const leanB = (b.politicalLean?.toLowerCase() || getPoliticalLean(b.sourceDomain || '')) as string;
              return (LEAN_ORDER[leanA] ?? 3) - (LEAN_ORDER[leanB] ?? 3);
            })
            .map((r, i) => ({
              id: `source-${i}`,
              name: r.displayName || r.sourceDomain,
              type: r.sourceType || 'unknown',
              url: r.uri,
              domain: r.sourceDomain,
              title: r.title || '',
              snippet: r.snippet || '',
              politicalLean: (r.politicalLean?.toLowerCase() || getPoliticalLean(r.sourceDomain || '')) as string,
            }));

          const res = await fetch('/api/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources: selectedSources, storyContext: summary || '' }),
          });

          if (res.ok) {
            const data = await res.json();
            // Store sorted source URLs with the comparison data
            data.sortedSourceUrls = selectedSources.map(s => s.url);
            setInlineComparison(data);
          }
        } catch (err) {
          console.error('Inline comparison failed:', err);
        } finally {
          setLoadingComparison(false);
        }
      }
    }

    fetchInlineComparison();
  }, [selectedForCompare, results, summary]);

  // Helper to extract source name from URL
  function getSourceName(url: string): string {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      const name = hostname.split('.')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return "this source";
    }
  }

  // Toggle source selection for compare
  function handleToggleCompare(uri: string) {
    setSelectedForCompare(prev =>
      prev.includes(uri)
        ? prev.filter(id => id !== uri)
        : [...prev, uri]
    );
  }

  // Rotate loading facts
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingFactIndex((prev) => (prev + 1) % loadingFacts.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Rotate scanner icons - 1100ms is optimal (research: 1000-1200ms feels steady, not frantic)
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setScannerIconIndex((prev) => (prev + 1) % scannerIcons.length);
      }, 1100);
      return () => clearInterval(interval);
    }
  }, [loading]);

  async function refreshUsage() {
    try {
      const r = await fetch("/api/usage", { cache: "no-store" });
      if (r.ok) setUsage(await r.json());
    } catch {}
  }

  // Helper to detect URLs with no readable keywords (UUIDs, shorteners, etc.)
  // Returns: 'share' for share links, 'premium' for paywalled sites, null if OK
  function getOpaqueUrlType(url: string): 'share' | 'premium' | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname.toLowerCase();

      // URL shorteners and share services - these NEVER have readable keywords
      const shortenerDomains = [
        'share.google',      // Google News share links
        'goo.gl',            // Google URL shortener
        'bit.ly',            // Bitly
        't.co',              // Twitter
        'tinyurl.com',       // TinyURL
        'ow.ly',             // Hootsuite
        'buff.ly',           // Buffer
        'news.google.com',   // Google News (often redirects)
        'apple.news',        // Apple News
        'flipboard.com',     // Flipboard shares
        'smartnews.link',    // SmartNews
        'ground.news',       // Ground News shares
      ];

      if (shortenerDomains.some(domain => hostname.includes(domain))) {
        return 'share';
      }

      // Known sites that typically use UUID/opaque URLs (paywalled)
      const opaqueUrlDomains = ['ft.com', 'bloomberg.com', 'economist.com'];
      const isKnownOpaqueSite = opaqueUrlDomains.some(domain => hostname.includes(domain));

      // For FT, Bloomberg, Economist: check if URL ends with UUID pattern
      if (isKnownOpaqueSite) {
        // UUID pattern: 8-4-4-4-12 hex chars, or just long hex string
        const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
        const longHexPattern = /\/[a-f0-9\-]{20,}$/i;
        if (uuidPattern.test(path) || longHexPattern.test(path)) {
          return 'premium';
        }
      }

      // For all sites: Extract words from path and check if readable
      const words = path
        .split(/[\/\-_.]/)
        .filter(segment => segment.length > 3) // Need at least 4 chars
        .filter(segment => !/^[0-9a-f]+$/i.test(segment)) // Remove pure hex
        .filter(segment => !/^\d+$/.test(segment)) // Remove pure numbers
        .filter(segment => /[g-z]/i.test(segment)) // Must have non-hex letter
        .filter(segment => !/^(content|article|story|news|post|index|html|htm|php|aspx|world|us|uk|business|tech|opinion|markets)$/i.test(segment));

      return words.length < 2 ? 'premium' : null;
    } catch {
      return null;
    }
  }

  async function handleSearchWithUrl(url: string) {
    if (!url.trim()) return;
    setLastSubmittedUrl(url);
    setLoadingFactIndex(0);
    setScannerIconIndex(0);
    setShowKeywordFallback(false);
    setKeywordFallbackType(null);
    setKeywords("");
    setSelectedForCompare([]);
    hasAutoSelected.current = false;

    // Check for opaque URLs (share links, premium sites with UUIDs)
    const opaqueType = getOpaqueUrlType(url);
    if (opaqueType) {
      setError(null);
      setShowKeywordFallback(true);
      setKeywordFallbackType(opaqueType);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setErrorRetryable(true);
      setSummary(null);
      setCommonGround(null);
      setKeyDifferences(null);
      setResults([]);
      setIsPaywalled(false);

      const res = await fetch("/api/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMsg = data?.error || "Something went wrong. Please try again.";
        setError(errorMsg);
        setErrorRetryable(data?.retryable !== false);
        
        // Check if error indicates article couldn't be read
        if (errorMsg.toLowerCase().includes("cannot access") || 
            errorMsg.toLowerCase().includes("unable to find") ||
            errorMsg.toLowerCase().includes("couldn't read") ||
            errorMsg.toLowerCase().includes("need to know what")) {
          setShowKeywordFallback(true);
        }
        
        if (res.status === 429) {
          await refreshUsage();
        }
        return;
      }

      const data = await res.json();
      setSummary(data.summary ?? null);
      setCommonGround(data.commonGround ?? null);
      setKeyDifferences(data.keyDifferences ?? null);
      setResults(Array.isArray(data.alternatives) ? data.alternatives : []);
      setIsPaywalled(data.isPaywalled ?? false);
      setDiversityWarning(data.diversityAnalysis?.warning ?? null);
      setQueryBiasWarning(data.queryBiasWarning ?? null);

      // Save to sessionStorage for back navigation
      sessionStorage.setItem('mirrorSourceResults', JSON.stringify({
        url: url,
        summary: data.summary,
        diversityWarning: data.diversityAnalysis?.warning ?? null,
        queryBiasWarning: data.queryBiasWarning ?? null,
        commonGround: data.commonGround,
        keyDifferences: data.keyDifferences,
        results: data.alternatives,
        isPaywalled: data.isPaywalled
      }));
    } catch (e: unknown) {
      // Network error - browser couldn't reach the server
      setError("Unable to connect. Please check your internet connection and try again.");
      setErrorRetryable(true);
    } finally {
      setIsLoading(false);
      refreshUsage();
    }
  }

  async function handleKeywordSearch(keywordsOverride?: string) {
    const searchTerms = keywordsOverride ?? keywords;
    if (!searchTerms.trim()) return;

    setLoadingFactIndex(0);
    setScannerIconIndex(0);
    setShowKeywordFallback(false);
    setSelectedForCompare([]);
    hasAutoSelected.current = false;

    try {
      setIsLoading(true);
      setError(null);
      setErrorRetryable(true);
      setSummary(null);
      setCommonGround(null);
      setKeyDifferences(null);
      setResults([]);
      setIsPaywalled(false);

      const res = await fetch("/api/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: searchTerms.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Something went wrong. Please try again.");
        setErrorRetryable(data?.retryable !== false);
        if (res.status === 429) {
          await refreshUsage();
        }
        return;
      }

      const data = await res.json();
      setSummary(data.summary ?? null);
      setCommonGround(data.commonGround ?? null);
      setKeyDifferences(data.keyDifferences ?? null);
      setResults(Array.isArray(data.alternatives) ? data.alternatives : []);
      setIsPaywalled(data.isPaywalled ?? false);
      setDiversityWarning(data.diversityAnalysis?.warning ?? null);
      setQueryBiasWarning(data.queryBiasWarning ?? null);

      // Save to sessionStorage for back navigation
      sessionStorage.setItem('mirrorSourceResults', JSON.stringify({
        url: keywords.trim(),
        summary: data.summary,
        diversityWarning: data.diversityAnalysis?.warning ?? null,
        queryBiasWarning: data.queryBiasWarning ?? null,
        commonGround: data.commonGround,
        keyDifferences: data.keyDifferences,
        results: data.alternatives,
        isPaywalled: data.isPaywalled
      }));
    } catch (e: unknown) {
      setError("Unable to connect. Please check your internet connection and try again.");
      setErrorRetryable(true);
    } finally {
      setIsLoading(false);
      refreshUsage();
    }
  }

  useEffect(() => {
    refreshUsage();

    // Try searchParams first, then fall back to window.location for mobile PWA
    let urlParam = searchParams.get('url');
    let textParam = searchParams.get('text');

    // Mobile PWA fallback: searchParams may be empty during hydration
    if (!urlParam && !textParam && typeof window !== 'undefined') {
      const windowParams = new URLSearchParams(window.location.search);
      urlParam = windowParams.get('url') || urlParam;
      textParam = windowParams.get('text') || textParam;
      if (urlParam || textParam) {
        console.log('[Init] Used window.location fallback for mobile');
      }
    }

    console.log('[Init] Params - url:', urlParam, 'text:', textParam, 'hasAutoSearched:', hasAutoSearchedRef.current);

    // ANDROID SHARE: Extract headline from shared text (e.g., "Headline here https://share.google...")
    if (textParam && !hasAutoSearchedRef.current) {
      console.log('[Init] Text from Android share:', textParam);
      sessionStorage.removeItem('mirrorSourceResults');

      // Extract headline: everything before the URL, or the whole text if no URL
      const urlMatch = textParam.match(/https?:\/\/\S+/);
      const headline = urlMatch
        ? textParam.substring(0, urlMatch.index).trim()
        : textParam.trim();

      if (headline) {
        console.log('[Init] Extracted headline:', headline);
        hasAutoSearchedRef.current = true;
        setTimeout(() => handleKeywordSearch(headline), 100);
        return;
      }
    }

    // URL parameter takes priority - clear any stale sessionStorage
    if (urlParam) {
      console.log('[Init] URL from params:', urlParam);
      sessionStorage.removeItem('mirrorSourceResults'); // Clear stale data
      setCurrentUrl(urlParam);
      // Trigger search with this URL
      if (!hasAutoSearchedRef.current) {
        hasAutoSearchedRef.current = true;
        setTimeout(() => handleSearchWithUrl(urlParam), 100);
      }
      return; // Don't check sessionStorage
    }

    // Only use sessionStorage if NO URL parameter
    const saved = sessionStorage.getItem('mirrorSourceResults');
    if (saved && !hasAutoSearchedRef.current) {
      try {
        const data = JSON.parse(saved);
        setCurrentUrl(data.url || '');
        setSummary(data.summary);
        setCommonGround(data.commonGround);
        setKeyDifferences(data.keyDifferences);
        setResults(data.results || []);
        setIsPaywalled(data.isPaywalled || false);
        setDiversityWarning(data.diversityWarning || null);
        setQueryBiasWarning(data.queryBiasWarning || null);
        hasAutoSearchedRef.current = true;
      } catch (e) {
        console.error('Failed to restore results:', e);
      }
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSearchWithUrl(currentUrl);
  }

  async function handleCopySummary() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.replace(/\*\*/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleShare() {
    const shareData = {
      title: 'MirrorSource - See the Whole Story',
      text: summary ? summary.replace(/\*\*/g, '').slice(0, 100) + '...' : 'Find free, public coverage of any news story.',
      url: window.location.origin,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {}
  }

  function handleLogoClick(e: React.MouseEvent) {
    e.preventDefault();
    setSummary(null);
    setCommonGround(null);
    setKeyDifferences(null);
    setResults([]);
    setIsPaywalled(false);
    setError(null);
    setErrorRetryable(true);
    setCurrentUrl("");
    setLastSubmittedUrl("");
    hasAutoSearchedRef.current = true;
    setShowKeywordFallback(false);
    setKeywords("");
    setSelectedForCompare([]);
    setInlineComparison(null);
    hasAutoSelected.current = false;
    window.history.pushState({}, '', '/');
  }

  const hasContent = summary || results.length > 0;
  const isActive = loading || hasContent;
  const currentScannerIcon = scannerIcons[scannerIconIndex];
  const todaysStory = getDailyStory();

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col relative overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .icon-pop { animation: popIn 0.4s ease-out forwards; }
        
        @keyframes progress {
          0% { width: 0%; }
          10% { width: 15%; }
          30% { width: 40%; }
          50% { width: 60%; }
          70% { width: 75%; }
          90% { width: 88%; }
          100% { width: 95%; }
        }
        .animate-progress { 
          animation: progress 20s ease-out forwards;
        }
      `}} />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={handleLogoClick} className="hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0" type="button">
              <Image src="/logo.png" alt="MirrorSource" width={160} height={40} priority className="h-9 w-auto" />
            </button>
            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-6 text-sm">
                <Link href="/about" className="text-slate-600 hover:text-blue-600 transition-colors">About</Link>
                <Link href="/sources" className="text-slate-600 hover:text-blue-600 transition-colors">Sources</Link>
              </nav>
              {usage && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
                  <span className={`w-2 h-2 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium text-slate-600">{usage.remaining}/{usage.limit} left</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={`transition-all duration-500 flex flex-col items-center px-4 ${isActive ? 'pt-8 pb-4' : 'pt-16 md:pt-24 pb-16 md:pb-20'}`}>
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-slate-900">
            See the whole story.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Compare how different sources cover the same news. Get AI-powered summaries and see the full political spectrum.
          </p>

          {/* Card-based URL Input */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-white border-2 border-slate-200 rounded-lg shadow-lg p-6">
              <UrlInputForm onSubmit={handleSubmit} isLoading={loading} value={currentUrl} onChange={setCurrentUrl} buttonLabel={loading ? "Analyzing..." : "Analyze"} />
            </div>
          </div>

          {/* Try an example link */}
          {!hasContent && !loading && (
            <p className="text-sm text-slate-500">
              Try an example:{' '}
              <button
                onClick={() => {
                  setCurrentUrl(todaysStory.url);
                  handleSearchWithUrl(todaysStory.url);
                }}
                className="text-[color:var(--primary)] hover:underline font-medium"
              >
                {todaysStory.topic} Article
              </button>
            </p>
          )}

        </div>
      </section>

      {/* Features Grid - Only show on empty homepage */}
      {!hasContent && !loading && (
        <section className="container mx-auto px-4 pb-16 md:pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight text-slate-900">Understanding the full picture</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Get comprehensive insights into how stories are covered across the political spectrum
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Feature 1: Summary */}
              <div className="bg-white border-2 border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[color:var(--primary)]/10 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-[color:var(--primary)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">Summary</h3>
                <p className="text-slate-600 leading-relaxed">
                  AI-generated overview of the core facts and key points from all sources
                </p>
              </div>

              {/* Feature 2: Intel Brief */}
              <div className="bg-white border-2 border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[color:var(--primary)]/10 rounded-lg flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6 text-[color:var(--primary)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">Intel Brief</h3>
                <p className="text-slate-600 leading-relaxed">
                  Critical divergence points where coverage differs significantly across outlets
                </p>
              </div>

              {/* Feature 3: Coverage Distribution */}
              <div className="bg-white border-2 border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[color:var(--primary)]/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-[color:var(--primary)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">Coverage Distribution</h3>
                <p className="text-slate-600 leading-relaxed">
                  Visual breakdown of source coverage across Left, Center, and Right perspectives
                </p>
              </div>

              {/* Feature 4: Source Compare */}
              <div className="bg-white border-2 border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[color:var(--primary)]/10 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-[color:var(--primary)]" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">Source Compare</h3>
                <p className="text-slate-600 leading-relaxed">
                  Side-by-side comparison showing how each outlet frames the narrative
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Opaque URL detected - proactive headline prompt (no error) */}
      {showKeywordFallback && !error && (
          <div className="mt-6 w-full max-w-2xl lg:max-w-3xl bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6">
            <div className="text-center mb-4">
              {keywordFallbackType === 'share' ? (
                <>
                  <div className="inline-flex items-center gap-2 text-slate-500 text-xs font-medium mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    SHARED LINK DETECTED
                  </div>
                  <p className="text-lg font-semibold text-slate-800 mb-1">
                    What&apos;s this article about?
                  </p>
                  <p className="text-slate-600 text-sm">
                    Share links hide the original URL. Paste the headline to find other coverage.
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 text-slate-500 text-xs font-medium mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    PREMIUM LINK DETECTED
                  </div>
                  <p className="text-lg font-semibold text-slate-800 mb-1">
                    Identify the story
                  </p>
                  <p className="text-slate-600 text-sm">
                    Paste the headline or describe the event to triangulate coverage.
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
                placeholder={keywordFallbackType === 'share'
                  ? "e.g., Trump announces new tariffs on China"
                  : "e.g., ECB warns AI bubble may burst if rates hold"
                }
                className="flex-1 px-4 py-3 rounded-full border border-slate-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                onClick={() => handleKeywordSearch()}
                disabled={loading || !keywords.trim()}
                className="inline-flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-full transition-colors text-sm whitespace-nowrap"
              >
                Find coverage
              </button>
            </div>
          </div>
        )}

        {/* API error with optional keyword fallback */}
        {error && (
          <div className="mt-6 w-full max-w-2xl lg:max-w-3xl bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-amber-800 font-medium mb-2 text-center">{error}</p>
            
            {showKeywordFallback ? (
              <div className="mt-4">
                <p className="text-amber-700 text-sm mb-3 text-center">
                  Paste the headline or describe the event to triangulate coverage.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
                    placeholder="e.g., Fed signals rate cuts despite inflation concerns"
                    className="flex-1 px-4 py-3 rounded-full border border-amber-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={() => handleKeywordSearch()}
                    disabled={loading || !keywords.trim()}
                    className="inline-flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-full transition-colors text-sm whitespace-nowrap"
                  >
                    Lock on
                  </button>
                </div>
              </div>
            ) : (
              errorRetryable && (
                <div className="text-center">
                  <p className="text-amber-600 text-sm mb-4">Search results vary each time. Give it another shot!</p>
                  <button
                    onClick={() => handleSearchWithUrl(currentUrl)}
                    disabled={loading || !currentUrl}
                    className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium py-2 px-5 rounded-full transition-colors text-sm"
                  >
                    <RefreshCw size={16} />
                    Try Again
                  </button>
                </div>
              )
            )}
          </div>
        )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center px-4 pt-6 pb-12 animate-in fade-in duration-500">
          {/* Progress section */}
          <div className="flex flex-col items-center gap-4 mb-8">
            {/* Animated icon */}
            <div className="relative">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center shadow-lg">
                <img key={currentScannerIcon.domain} src={getHighResFavicon(currentScannerIcon.domain)} alt={currentScannerIcon.name} className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-lg animate-in fade-in zoom-in duration-300" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.ico'; }} />
              </div>
            </div>
            
            {/* Status text */}
            <div className="text-center">
              <p className="text-cyan-600 font-semibold text-sm uppercase tracking-wider mb-1">Scanning...</p>
              <p className="text-slate-500 text-sm">{loadingFacts[loadingFactIndex]}</p>
            </div>

            {/* Progress bar */}
            <div className="w-64 md:w-80">
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-progress"></div>
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">Usually takes 10-15 seconds</p>
              <p className="text-xs text-slate-400 text-center mt-1">Results vary — tap "Try Again" if needed</p>
            </div>
          </div>

          {/* Skeleton preview - shows what's coming */}
          <div className="w-full max-w-4xl space-y-4 opacity-40">
            {/* Skeleton source icons */}
            <div className="flex flex-wrap justify-center gap-4 py-4">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-slate-200 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}></div>
              ))}
            </div>
            
            {/* Skeleton summary card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="h-5 w-24 bg-slate-200 rounded animate-pulse mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-11/12"></div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5"></div>
              </div>
            </div>

            {/* Skeleton Intel Brief */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="h-5 w-28 bg-slate-200 rounded animate-pulse mb-4"></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-full"></div>
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4"></div>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <div className="h-3 w-24 bg-orange-200 rounded animate-pulse mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-orange-100 rounded animate-pulse w-full"></div>
                    <div className="h-3 bg-orange-100 rounded animate-pulse w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && hasContent && (
        <div className="flex-1 bg-slate-50 px-4 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="max-w-4xl mx-auto space-y-8">

            {/* Summary */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Summary</h2>
                {summary && (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopySummary} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-slate-100">
                      {copied ? <><Check size={16} className="text-green-600" /><span className="hidden sm:inline text-green-600">Copied!</span></> : <><Copy size={16} /><span className="hidden sm:inline">Copy</span></>}
                    </button>
                    <button onClick={handleShare} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-slate-100">
                      {shared ? <><Check size={16} className="text-green-600" /><span className="hidden sm:inline text-green-600">Link copied!</span></> : <><Share2 size={16} /><span className="hidden sm:inline">Share</span></>}
                    </button>
                  </div>
                )}
              </div>
              <div className="leading-relaxed">
                {summary ? <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600 max-w-prose">{parseMarkdownBold(summary, 'summary')}</p> : <p className="text-slate-400 italic">No summary available.</p>}
              </div>
            </div>

            {/* Intel Brief */}
            {(commonGround || keyDifferences) && (
              <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">Intel Brief</h2>
                </div>

                {/* Divergence Meter */}
                <div className={`mb-6 px-4 py-2.5 rounded-lg ${getDivergenceLevel(keyDifferences).bg} flex items-center gap-2 flex-wrap`}>
                  <span className="text-lg">{getDivergenceLevel(keyDifferences).icon}</span>
                  <span className={`font-semibold ${getDivergenceLevel(keyDifferences).color}`}>
                    {getDivergenceLevel(keyDifferences).level} Divergence
                  </span>
                  <span className="text-slate-600 text-sm">
                    — {getDivergenceLevel(keyDifferences).description}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  {commonGround && (Array.isArray(commonGround) ? commonGround.length > 0 : commonGround) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Common Ground</h3>
                      </div>
                      {Array.isArray(commonGround) ? (
                        <ul className="space-y-2">
                          {commonGround.map((fact, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm md:text-base text-slate-600">
                              <Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span><span className="font-medium text-slate-700">{fact.label}:</span> {fact.value}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm md:text-base text-slate-600 leading-relaxed">{parseMarkdownBold(commonGround, 'intel')}</p>
                      )}
                    </div>
                  )}
                  {keyDifferences && (Array.isArray(keyDifferences) ? keyDifferences.length > 0 : keyDifferences) && (
                    <div className={Array.isArray(keyDifferences) ? "bg-orange-50 border border-orange-200 rounded-xl p-5" : "bg-green-50 border border-green-200 rounded-xl p-5"}>
                      <div className="flex items-center gap-2 mb-3">
                        {Array.isArray(keyDifferences) ? (
                          <>
                            <Scale className="w-4 h-4 text-orange-600" />
                            <h3 className="text-sm font-semibold text-orange-800 uppercase tracking-wide">Key Differences</h3>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide">Consensus</h3>
                          </>
                        )}
                      </div>
                      {Array.isArray(keyDifferences) ? (
                        <ul className="space-y-2">
                          {keyDifferences.map((diff, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm md:text-base text-orange-700">
                              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                              <span><span className="font-medium text-orange-800">{diff.label}:</span> {parseMarkdownBold(diff.value, 'intel')}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm md:text-base text-green-700 leading-relaxed">{keyDifferences}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Perspective Warnings (Query Bias + Diversity) */}
                {(queryBiasWarning || diversityWarning) && (
                  <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <span className="text-amber-500 text-xl">⚠️</span>
                      <div>
                        <h4 className="font-semibold text-amber-800 text-sm">Perspective Alert</h4>
                        {queryBiasWarning && (
                          <p className="text-amber-700 text-sm mt-1">{queryBiasWarning}</p>
                        )}
                        {diversityWarning && (
                          <p className="text-amber-700 text-sm mt-1">{diversityWarning}</p>
                        )}
                        <p className="text-amber-600 text-xs mt-2">
                          Consider searching for additional viewpoints to get the full picture.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inline Comparison Cards - The "Zing" */}
            {loadingComparison && (
              <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8">
                <div className="flex items-center justify-center gap-3">
                  <RefreshCw size={20} className="animate-spin text-blue-500" />
                  <p className="text-slate-600 font-medium">Analyzing how each source covers this story...</p>
                </div>
              </div>
            )}

            {inlineComparison && inlineComparison.analyses && inlineComparison.analyses.length > 0 && (
              <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale size={22} className="text-blue-600" />
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900">Compare Coverage</h2>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Auto-selected</span>
                  </div>
                  <p className="text-slate-500 text-sm">See how different sources cover the same story</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {inlineComparison.analyses.slice(0, 4).map((analysis: any, idx: number) => {
                    // Use sorted source URLs from the comparison data
                    const sourceUrl = inlineComparison.sortedSourceUrls?.[idx] || selectedForCompare[idx];
                    const source = results.find(r => r.uri === sourceUrl);
                    const sourceName = source?.displayName || source?.sourceDomain?.split('.')[0].toUpperCase() || 'Source';
                    const lean = (source?.politicalLean?.toLowerCase() || getPoliticalLean(source?.sourceDomain || '')) as string;
                    const borderClass = LEAN_BORDER_COLORS[lean] || LEAN_BORDER_COLORS['center'];

                    return (
                      <div key={idx} className={`border border-slate-200 rounded-xl p-5 bg-slate-50 hover:shadow-md transition-shadow ${borderClass}`}>
                        {/* Source Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${source?.sourceDomain}&sz=32`}
                            alt=""
                            className="w-5 h-5 rounded flex-shrink-0"
                          />
                          <span className="font-semibold text-slate-900">{sourceName}</span>
                          {source?.countryCode && (
                            <span className="text-xs flex-shrink-0">{source.countryCode === 'US' ? '🇺🇸' : source.countryCode === 'GB' ? '🇬🇧' : source.countryCode === 'CA' ? '🇨🇦' : '🌍'}</span>
                          )}
                        </div>
                        {/* Political Lean Badge */}
                        <div className="mb-2">
                          {(() => {
                            const lean = (source?.politicalLean?.toLowerCase() || getPoliticalLean(source?.sourceDomain || '')) as PoliticalLean;
                            const colors = LEAN_COLORS[lean] || LEAN_COLORS['center'];
                            const label = LEAN_LABELS[lean] || 'Center';
                            return (
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors.bg} ${colors.text}`}>
                                {label}
                              </span>
                            );
                          })()}
                        </div>

                        <a href={source?.uri} target="_blank" rel="noopener noreferrer"
                           className="text-blue-600 text-sm hover:underline inline-flex items-center gap-1">
                          Read full article <ArrowRight size={12} />
                        </a>

                        {/* Headline */}
                        <p className="font-medium mt-4 text-slate-900 leading-snug">"{analysis.headline}"</p>

                        {/* Tone Badge */}
                        <div className="mt-4">
                          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Tone</span>
                          <span className={`ml-2 text-sm px-2.5 py-0.5 rounded-full font-medium ${
                            ['Critical', 'Alarming', 'Concerned', 'Skeptical', 'Warning'].some(t => analysis.tone?.includes(t))
                              ? 'bg-red-100 text-red-700'
                              : ['Supportive', 'Approving', 'Optimistic', 'Positive'].some(t => analysis.tone?.includes(t))
                              ? 'bg-green-100 text-green-700'
                              : ['Urgent', 'Alert'].some(t => analysis.tone?.includes(t))
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {analysis.tone}
                          </span>
                        </div>

                        {/* Focus */}
                        <div className="mt-4">
                          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-1">Focus</span>
                          <p className="text-sm text-slate-700 leading-relaxed">{analysis.focus}</p>
                        </div>

                        {/* Unique Angle */}
                        <div className="mt-4">
                          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium block mb-1">Unique Angle</span>
                          <p className="text-sm text-slate-700 leading-relaxed">{analysis.uniqueAngle}</p>
                        </div>

                        {/* Not Covered */}
                        {analysis.notCovered && (
                          <div className="mt-4">
                            <span className="text-xs text-red-500 uppercase tracking-wide font-medium block mb-1">Not Covered</span>
                            <p className="text-sm text-slate-600 italic leading-relaxed">{analysis.notCovered}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Share & Full Compare */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  {/* Share Buttons */}
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <button
                      onClick={async () => {
                        const shareUrl = `${window.location.origin}/compare?sources=${encodeURIComponent(JSON.stringify(
                          results
                            .filter(r => selectedForCompare.includes(r.uri))
                            .map((r, i) => ({
                              id: `source-${i}`,
                              name: r.displayName || r.sourceDomain,
                              type: r.sourceType || 'Corporate',
                              url: r.uri,
                            }))
                        ))}&context=${encodeURIComponent(summary || '')}`;
                        await navigator.clipboard.writeText(shareUrl);
                        const btn = document.activeElement as HTMLButtonElement;
                        const original = btn.innerHTML;
                        btn.innerHTML = '✓ Copied!';
                        setTimeout(() => { btn.innerHTML = original; }, 2000);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      🔗 Copy
                    </button>

                    <span className="text-slate-300">|</span>

                    <button
                      onClick={() => {
                        const headlines = inlineComparison.analyses.slice(0, 4).map((a: any, i: number) => {
                          const src = results.find(r => selectedForCompare[i] === r.uri);
                          return `${src?.displayName || 'Source'}: "${a.headline}"`;
                        }).join('\n');
                        const tweetText = `See how different sources cover this story:\n\n${headlines}\n\nCompare coverage:`;
                        const shareUrl = `${window.location.origin}/compare?sources=${encodeURIComponent(JSON.stringify(
                          results
                            .filter(r => selectedForCompare.includes(r.uri))
                            .map((r, i) => ({
                              id: `source-${i}`,
                              name: r.displayName || r.sourceDomain,
                              type: r.sourceType || 'Corporate',
                              url: r.uri,
                            }))
                        ))}&context=${encodeURIComponent(summary || '')}`;
                        window.open(
                          `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`,
                          '_blank',
                          'width=550,height=420'
                        );
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      𝕏 Tweet
                    </button>

                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => {
                            const headlines = inlineComparison.analyses.slice(0, 4).map((a: any, i: number) => {
                              const src = results.find(r => selectedForCompare[i] === r.uri);
                              return `${src?.displayName || 'Source'}: "${a.headline}"`;
                            }).join('\n');
                            const shareUrl = `${window.location.origin}/compare?sources=${encodeURIComponent(JSON.stringify(
                              results
                                .filter(r => selectedForCompare.includes(r.uri))
                                .map((r, i) => ({
                                  id: `source-${i}`,
                                  name: r.displayName || r.sourceDomain,
                                  type: r.sourceType || 'Corporate',
                                  url: r.uri,
                                }))
                            ))}&context=${encodeURIComponent(summary || '')}`;
                            navigator.share({
                              title: 'Compare News Coverage - MirrorSource',
                              text: `See how different sources cover this story:\n${headlines}`,
                              url: shareUrl
                            });
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          📤 Share
                        </button>
                      </>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* Coverage Distribution */}
            {results.length > 0 && (
              <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
                <CoverageDistributionChart results={results} lastSubmittedUrl={lastSubmittedUrl} />
              </div>
            )}

            {/* More Sources */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">More Sources</h2>
                  <p className="text-sm text-slate-500 mt-1">Select different sources to compare</p>
                </div>
              </div>

              {results.length > 0 ? (
                <>
                  <ResultsDisplay
                    results={results}
                    selectedIds={selectedForCompare}
                    onToggleSelect={handleToggleCompare}
                  />
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    {/* Compare Selected Button */}
                    {selectedForCompare.length >= 2 && (
                      <div className="mb-4">
                        <Link
                          href={`/compare?sources=${encodeURIComponent(JSON.stringify(
                            results
                              .filter(r => selectedForCompare.includes(r.uri))
                              .slice(0, 5)
                              .map((r, i) => ({
                                id: `source-${i}`,
                                name: r.displayName || r.sourceDomain?.split('.')[0].toUpperCase() || 'Unknown',
                                type: r.sourceType || 'unknown',
                                url: r.uri,
                                title: (r.title || '').slice(0, 100),
                                snippet: (r.snippet || '').slice(0, 150)
                              }))
                          ))}`}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition"
                        >
                          Compare {selectedForCompare.length} Sources →
                        </Link>
                      </div>
                    )}
                    <p className="text-sm text-slate-500 text-center mb-3">Results may vary. Try again for different sources.</p>
                    <button onClick={() => handleSearchWithUrl(lastSubmittedUrl)} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-medium py-3 px-6 rounded-full transition-colors border border-slate-200">
                      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                      Find different sources
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-slate-600 font-medium">Limited coverage found</p>
                      <p className="text-sm text-slate-500 mt-1">We searched but couldn't find free alternative sources for this specific article. This can happen with breaking news or niche topics.</p>
                    </div>
                  </div>
                  
                  <button onClick={() => handleSearchWithUrl(lastSubmittedUrl)} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#6b9aef] text-white font-medium py-3 px-6 rounded-full transition-colors">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Try searching again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <HomeContent />
    </Suspense>
  );
}