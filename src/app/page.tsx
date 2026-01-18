"use client";

import { Suspense, useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";
import SourceFlipCard from "@/components/SourceFlipCard";
import { ProvenanceCard } from "@/components/ProvenanceCard";
import { NarrativeCard } from "@/components/NarrativeCard";
import { AuthorModal } from "@/components/AuthorModal";
import { EmailGate, useEmailGate, shouldShowGate as checkShouldShowGate, getRemainingLookups as checkRemainingLookups } from "@/components/EmailGate";
import type { GroundingSource } from "@/types";
import { Copy, Check, RefreshCw, Share2, CheckCircle2, Scale, AlertCircle, AlertTriangle, BarChart3, ExternalLink, ThumbsUp, ThumbsDown, Send, Flag } from "lucide-react";
import { getPoliticalLean, getSourceInfo, LEAN_COLORS, LEAN_LABELS, SOURCE_COUNT, type PoliticalLean } from "@/lib/sourceData";

// Political lean spectrum order for sorting (Left → Right)
const LEAN_ORDER: Record<string, number> = {
  'left': 1,
  'center-left': 2,
  'center': 3,
  'center-right': 4,
  'right': 5,
};

type Usage = { used: number; remaining: number; limit: number; resetAt: string };
type CommonGroundFact = { label: string; value: string };
type KeyDifference = { label: string; value: string };
type ProvenanceInfo = {
  origin: 'wire_service' | 'single_outlet' | 'press_release' | 'unknown';
  originSource: string | null;
  originConfidence: 'high' | 'medium' | 'low';
  originalReporting: string[];
  aggregators: string[];
  explanation: string;
};
type NarrativeType = 'policy' | 'horse_race' | 'culture_war' | 'scandal' | 'human_interest';
type NarrativeAnalysis = {
  emotionalIntensity: number;
  narrativeType: NarrativeType;
  isClickbait: boolean;
};

const loadingFacts = [
  "Scanning news sources...",
  "Finding alternative perspectives...",
  "Comparing coverage across outlets...",
  "Checking international sources...",
  "Looking for wire services...",
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

// Parse markdown bold and optionally convert source names to clickable links
function parseMarkdownBold(
  text: string,
  variant: 'summary' | 'intel' = 'summary',
  sources?: GroundingSource[]
): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);

      // If sources provided, try to match and create a link
      if (sources && sources.length > 0) {
        const matchedSource = sources.find(s => {
          const displayName = s.displayName.toLowerCase();
          const boldLower = boldText.toLowerCase();
          // Match exact name, or common variations
          return displayName === boldLower ||
                 displayName.includes(boldLower) ||
                 boldLower.includes(displayName) ||
                 // Handle abbreviations like "NYT" for "New York Times"
                 s.sourceDomain.toLowerCase().replace(/\.(com|org|net|co\.uk)$/, '').includes(boldLower.replace(/\s+/g, ''));
        });

        if (matchedSource) {
          return (
            <a
              key={index}
              href={matchedSource.uri}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-semibold underline hover:no-underline transition-colors inline-flex items-center gap-0.5 ${
                variant === 'intel'
                  ? 'text-orange-800 hover:text-orange-900'
                  : 'text-slate-900 hover:text-blue-700'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {boldText}
              <ExternalLink className="w-3 h-3 inline" />
            </a>
          );
        }
      }

      // Default: render as bold text
      return (
        <strong key={index} className={variant === 'summary' ? "font-semibold text-slate-900" : "font-semibold"}>
          {boldText}
        </strong>
      );
    }
    return part;
  });
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

// ColorBrewer RdBu diverging palette - industry standard for political spectrum
const BAR_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  'left': { bg: '#2166AC', text: '#FFFFFF' },
  'center-left': { bg: '#67A9CF', text: '#1E3A5F' },
  'center': { bg: '#F7F7F7', text: '#374151', border: '#D1D5DB' },
  'center-right': { bg: '#EF8A62', text: '#7C2D12' },
  'right': { bg: '#B2182B', text: '#FFFFFF' },
};

// Inline Feedback Widget for search results
function ResultFeedbackWidget({ pageUrl }: { pageUrl: string }) {
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportComment, setReportComment] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);

  async function handleSubmit(helpfulValue: boolean | null, commentText?: string) {
    setIsSubmitting(true);
    try {
      await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          helpful: helpfulValue,
          comment: commentText || null,
          timestamp: new Date().toISOString(),
        }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleThumbClick(isHelpful: boolean) {
    setHelpful(isHelpful);
    if (isHelpful) {
      await handleSubmit(true);
    } else {
      setShowComment(true);
    }
  }

  async function handleReportSubmit() {
    setIsSubmitting(true);
    try {
      await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          helpful: null,
          comment: reportComment,
          timestamp: new Date().toISOString(),
        }),
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
        setReportComment("");
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 pt-4 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Feedback */}
        {submitted ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check size={16} />
            <span>Thanks for your feedback!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">Was this helpful?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleThumbClick(true)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    helpful === true
                      ? "bg-green-100 text-green-600"
                      : "hover:bg-slate-100 text-slate-400 hover:text-green-600"
                  }`}
                  aria-label="Yes, helpful"
                >
                  <ThumbsUp size={18} />
                </button>
                <button
                  onClick={() => handleThumbClick(false)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                    helpful === false
                      ? "bg-red-100 text-red-600"
                      : "hover:bg-slate-100 text-slate-400 hover:text-red-600"
                  }`}
                  aria-label="No, not helpful"
                >
                  <ThumbsDown size={18} />
                </button>
              </div>
            </div>

            {showComment && !submitted && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us more (optional)"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleSubmit(helpful, comment)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-1 text-sm"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            )}
          </div>
        )}

        {/* Report Issue Link */}
        <button
          onClick={() => setShowReportModal(true)}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          <Flag size={12} />
          Report an issue
        </button>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Report an Issue</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="text-slate-400 text-xl">&times;</span>
              </button>
            </div>

            {reportSubmitted ? (
              <div className="text-center py-4">
                <p className="text-green-600 font-medium">Thanks for reporting!</p>
                <p className="text-sm text-slate-500 mt-1">We&apos;ll look into this.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  Help us improve MirrorSource. Describe the issue you encountered.
                </p>

                <textarea
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                  placeholder="What went wrong?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
                />

                <p className="text-xs text-slate-400 mb-4">
                  We&apos;ll include: Page URL, Timestamp, Build version. No personal data.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-2 px-4 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReportSubmit}
                    disabled={isSubmitting || !reportComment.trim()}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? "Sending..." : "Send Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Interactive vertical bar for Coverage Distribution - click to filter sources
function VerticalBar({
  count,
  maxCount,
  label,
  colorKey,
  isHighlighted,
  isSelected,
  isAnySelected,
  onClick
}: {
  count: number;
  maxCount: number;
  label: string;
  colorKey: string;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isAnySelected?: boolean;
  onClick?: () => void;
}) {
  const heightPercent = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 25 : 8) : 8;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-center flex-shrink-0 cursor-pointer transition-all duration-200 bg-transparent border-none p-0 min-w-[48px]
        ${isHighlighted ? 'relative' : ''}
        ${isSelected ? 'scale-105' : 'hover:scale-[1.02]'}
        ${isAnySelected && !isSelected ? 'opacity-50' : 'opacity-100'}
      `}
      aria-pressed={isSelected}
      aria-label={`${label}: ${count} sources. Click to filter.`}
    >
      {isHighlighted && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-blue-600 font-medium whitespace-nowrap pointer-events-none">
          📍 Your article
        </div>
      )}
      <div className="h-32 sm:h-28 flex items-end justify-center mb-2">
        <div
          className={`w-10 sm:w-12 md:w-14 rounded-t-lg flex items-end justify-center pb-2 transition-all duration-200
            ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
            ${isSelected ? 'ring-2 ring-slate-800 ring-offset-2' : ''}
          `}
          style={{
            backgroundColor: count > 0 ? (BAR_COLORS[colorKey]?.bg || BAR_COLORS['center'].bg) : '#e2e8f0',
            border: count > 0 && BAR_COLORS[colorKey]?.border ? `1px solid ${BAR_COLORS[colorKey].border}` : undefined,
            height: `${heightPercent}%`,
            minHeight: '1.5rem'
          }}
        >
          <span
            className="font-bold text-xs sm:text-sm"
            style={{ color: count > 0 ? (BAR_COLORS[colorKey]?.text || '#FFFFFF') : '#94a3b8' }}
          >
            {count}
          </span>
        </div>
      </div>
      <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${isHighlighted ? 'text-blue-600' : isSelected ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>{label}</span>
    </button>
  );
}

// Coverage Distribution Chart with vertical bars (v0 style) - now interactive
function CoverageDistributionChart({
  results,
  lastSubmittedUrl,
  selectedBias,
  onBarClick
}: {
  results: GroundingSource[];
  lastSubmittedUrl: string;
  selectedBias: PoliticalLean | null;
  onBarClick: (bias: PoliticalLean) => void;
}) {
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
  const isAnySelected = selectedBias !== null;

  return (
    <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Coverage Distribution</h3>
        </div>
        {selectedBias && (
          <button
            onClick={() => onBarClick(selectedBias)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Hint text */}
      <p className="text-xs text-slate-500 mb-3">Click a bar to filter sources by perspective</p>

      {/* Input source indicator */}
      {inputSourceName && dist.inputLean && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center gap-2 flex-wrap">
          <span className="text-blue-600 font-medium text-sm">📍 Your article:</span>
          <span className="font-semibold text-slate-800">{inputSourceName}</span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${LEAN_COLORS[dist.inputLean].headerBg} ${LEAN_COLORS[dist.inputLean].headerText}`}>
            {LEAN_LABELS[dist.inputLean]}
          </span>
        </div>
      )}

      {/* Vertical bar chart - now clickable */}
      <div className="flex justify-center gap-2 sm:gap-4 md:gap-6 pt-6">
        <VerticalBar
          key="left"
          count={dist.left}
          maxCount={maxCount}
          label="Left"
          colorKey="left"
          isHighlighted={dist.inputLean === 'left'}
          isSelected={selectedBias === 'left'}
          isAnySelected={isAnySelected}
          onClick={() => onBarClick('left')}
        />
        <VerticalBar
          key="center-left"
          count={dist.centerLeft}
          maxCount={maxCount}
          label="Center-Left"
          colorKey="center-left"
          isHighlighted={dist.inputLean === 'center-left'}
          isSelected={selectedBias === 'center-left'}
          isAnySelected={isAnySelected}
          onClick={() => onBarClick('center-left')}
        />
        <VerticalBar
          key="center"
          count={dist.center}
          maxCount={maxCount}
          label="Center"
          colorKey="center"
          isHighlighted={dist.inputLean === 'center'}
          isSelected={selectedBias === 'center'}
          isAnySelected={isAnySelected}
          onClick={() => onBarClick('center')}
        />
        <VerticalBar
          key="center-right"
          count={dist.centerRight}
          maxCount={maxCount}
          label="Center-Right"
          colorKey="center-right"
          isHighlighted={dist.inputLean === 'center-right'}
          isSelected={selectedBias === 'center-right'}
          isAnySelected={isAnySelected}
          onClick={() => onBarClick('center-right')}
        />
        <VerticalBar
          key="right"
          count={dist.right}
          maxCount={maxCount}
          label="Right"
          colorKey="right"
          isHighlighted={dist.inputLean === 'right'}
          isSelected={selectedBias === 'right'}
          isAnySelected={isAnySelected}
          onClick={() => onBarClick('right')}
        />
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
  const [provenance, setProvenance] = useState<ProvenanceInfo | null>(null);
  const [narrative, setNarrative] = useState<NarrativeAnalysis | null>(null);
  const [authorModal, setAuthorModal] = useState<{ name: string; outlet: string } | null>(null);
  const [results, setResults] = useState<GroundingSource[]>([]);
  const [isPaywalled, setIsPaywalled] = useState(false);
  const [diversityWarning, setDiversityWarning] = useState<string | null>(null);
  const [queryBiasWarning, setQueryBiasWarning] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const hasAutoSearchedRef = useRef(false);
  const [loadingFactIndex, setLoadingFactIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [lastSubmittedUrl, setLastSubmittedUrl] = useState("");
  const [showKeywordFallback, setShowKeywordFallback] = useState(false);
  const [keywordFallbackType, setKeywordFallbackType] = useState<'share' | 'premium' | null>(null);
  const [keywords, setKeywords] = useState("");
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [inlineComparison, setInlineComparison] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const hasAutoSelected = useRef(false);
  const [selectedBias, setSelectedBias] = useState<PoliticalLean | null>(null);
  const [showEmailGate, setShowEmailGate] = useState(false);

  // Email gate hook for tracking free lookups
  const {
    remainingLookups,
    isSubscribed,
    recordLookup,
    handleEmailSuccess
  } = useEmailGate();

  // Political lean order for sorting (Left → Right)
  const BIAS_ORDER: PoliticalLean[] = ['left', 'center-left', 'center', 'center-right', 'right'];

  // Create GroundingSource for the original article from the submitted URL
  const createOriginalArticleSource = (url: string): GroundingSource & { isOriginal: true } | null => {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const sourceInfo = getSourceInfo(url);

      return {
        uri: url,
        title: '', // Will show "Your starting point" in the card
        snippet: 'This is the article you submitted. Compare it with the alternative sources below.',
        displayName: sourceInfo?.displayName || domain.split('.')[0].toUpperCase(),
        sourceDomain: domain,
        sourceType: (sourceInfo?.sourceType as any) || 'national',
        countryCode: sourceInfo?.countryCode || 'US',
        isSyndicated: false,
        ownership: sourceInfo?.ownership,
        funding: sourceInfo?.funding,
        politicalLean: sourceInfo?.lean || getPoliticalLean(url),
        isIndependent: sourceInfo?.isIndependent,
        isOriginal: true, // Special marker for the original article
      };
    } catch {
      return null;
    }
  };

  // Sort sources by political lean - original article first, then selected bias, then spectrum order
  const sortSourcesByBias = (
    sources: (GroundingSource & { isOriginal?: boolean })[],
    selected: PoliticalLean | null,
    inputBias: PoliticalLean | null
  ): (GroundingSource & { isOriginal?: boolean })[] => {
    const getBias = (s: GroundingSource): PoliticalLean =>
      (s.politicalLean?.toLowerCase() || getPoliticalLean(s.sourceDomain || s.uri)) as PoliticalLean;

    return [...sources].sort((a, b) => {
      const aOriginal = (a as any).isOriginal === true;
      const bOriginal = (b as any).isOriginal === true;
      const aBias = getBias(a);
      const bBias = getBias(b);

      // Original article handling
      if (selected) {
        // When filter active: original comes first WITHIN its bias group
        const aSelected = aBias === selected;
        const bSelected = bBias === selected;

        // Selected bias group comes first
        if (aSelected && !bSelected) return -1;
        if (bSelected && !aSelected) return 1;

        // Within selected group, original comes first
        if (aSelected && bSelected) {
          if (aOriginal) return -1;
          if (bOriginal) return 1;
        }
      } else {
        // Default: original article always comes first
        if (aOriginal) return -1;
        if (bOriginal) return 1;
      }

      // Within same priority, sort by spectrum order
      return BIAS_ORDER.indexOf(aBias) - BIAS_ORDER.indexOf(bBias);
    });
  };

  // Get the input article's political lean for default sorting
  const inputLean = useMemo(() => {
    if (!lastSubmittedUrl) return null;
    return getPoliticalLean(lastSubmittedUrl);
  }, [lastSubmittedUrl]);

  // Create the original article source object
  const originalArticleSource = useMemo(() =>
    createOriginalArticleSource(lastSubmittedUrl),
    [lastSubmittedUrl]
  );

  // Combine original article with search results and sort
  const sortedResults = useMemo(() => {
    const allSources: (GroundingSource & { isOriginal?: boolean })[] = [];

    // Add original article if it exists and we have results
    if (originalArticleSource && results.length > 0) {
      allSources.push(originalArticleSource);
    }

    // Add all search results
    allSources.push(...results);

    return sortSourcesByBias(allSources, selectedBias, inputLean);
  }, [results, selectedBias, inputLean, originalArticleSource]);

  // Handle bar click - toggle filter and scroll to Source Analysis
  const handleBarClick = (bias: PoliticalLean) => {
    // Toggle off if clicking same bar, otherwise select
    setSelectedBias(prev => prev === bias ? null : bias);

    // Smooth scroll to Source Analysis section after a short delay
    setTimeout(() => {
      document.getElementById('source-analysis')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

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

  // Rotate loading facts
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingFactIndex((prev) => (prev + 1) % loadingFacts.length);
      }, 2500);
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

      // Fix: Use exact match or subdomain match, not substring (prevents "nypost.com" matching "t.co")
      if (shortenerDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        return 'share';
      }

      // Known sites that typically use UUID/opaque URLs (paywalled)
      const opaqueUrlDomains = ['ft.com', 'bloomberg.com', 'economist.com'];
      const isKnownOpaqueSite = opaqueUrlDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));

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

    // Check if non-subscribed user has exhausted free lookups
    // Use direct localStorage check to avoid stale hook state
    if (checkShouldShowGate()) {
      setShowEmailGate(true);
      return;
    }

    setLastSubmittedUrl(url);
    setLoadingFactIndex(0);
    setShowKeywordFallback(false);
    setKeywordFallbackType(null);
    setKeywords("");
    setSelectedForCompare([]);
    hasAutoSelected.current = false;
    setSelectedBias(null); // Reset filter on new search

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
      setProvenance(data.provenance ?? null);
      setNarrative(data.narrative ?? null);
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
        provenance: data.provenance,
        narrative: data.narrative,
        results: data.alternatives,
        isPaywalled: data.isPaywalled
      }));

      // Record lookup for email gate tracking (only on successful results)
      if (!isSubscribed) {
        recordLookup();
      }
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
    setShowKeywordFallback(false);
    setSelectedForCompare([]);
    hasAutoSelected.current = false;
    setSelectedBias(null); // Reset filter on new search

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
      setProvenance(data.provenance ?? null);
      setNarrative(data.narrative ?? null);
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
        provenance: data.provenance,
        narrative: data.narrative,
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
        setProvenance(data.provenance || null);
        setNarrative(data.narrative || null);
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
    setProvenance(null);
    setNarrative(null);
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
    setSelectedBias(null); // Reset filter
    window.history.pushState({}, '', '/');
  }

  const hasContent = summary || results.length > 0;
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
                <a href="https://chromewebstore.google.com/detail/mirrorsource/pbkhmfaocbdakhlpbdebghpdmkpbfohk" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-blue-600 transition-colors">Extension</a>
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

      {/* Sticky Search Bar - When loading or results exist */}
      {(hasContent || loading) && (
        <div className="sticky top-[65px] z-40 bg-slate-50/95 backdrop-blur-sm py-3 px-4 shadow-sm border-b border-slate-200">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border-2 border-slate-200 rounded-lg shadow-lg p-4">
              <UrlInputForm onSubmit={handleSubmit} isLoading={loading} value={currentUrl} onChange={setCurrentUrl} buttonLabel={loading ? "Analyzing..." : "Analyze"} />
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Only shown in idle state */}
      {!hasContent && !loading && (
        <section className="transition-all duration-300 flex flex-col items-center px-4 pt-16 md:pt-24 pb-16 md:pb-20">
          <div className="max-w-4xl mx-auto text-center w-full">
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

            {/* Trust Strip */}
            <p className="text-sm text-gray-500 text-center mt-4 mb-4">
              <span className="inline-flex items-center gap-4 flex-wrap justify-center">
                <span>🍁 Built in BC</span>
                <span>•</span>
                <span>🔒 No tracking</span>
                <span>•</span>
                <span>⚡ Fast on slow connections</span>
              </span>
            </p>

            {/* Remaining lookups indicator */}
            {!isSubscribed && (
              <p className="text-sm text-slate-500 mb-4">
                {remainingLookups > 0 ? (
                  <>
                    <span className="font-medium">{remainingLookups}</span> free {remainingLookups === 1 ? 'lookup' : 'lookups'} remaining today
                  </>
                ) : (
                  <button
                    onClick={() => setShowEmailGate(true)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Enter your email for unlimited access
                  </button>
                )}
              </p>
            )}

            {/* Try an example link */}
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

            {/* Extension CTA */}
            <div className="mt-10 max-w-md mx-auto">
              <a
                href="https://chromewebstore.google.com/detail/mirrorsource/pbkhmfaocbdakhlpbdebghpdmkpbfohk"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                  <Image src="/icon.png" alt="MirrorSource" width={40} height={40} className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">Get the Chrome Extension</p>
                  <p className="text-sm text-slate-500">Analyze any article with one click</p>
                </div>
                <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            {/* Trust Signals */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Analyzing <strong className="text-slate-700">{SOURCE_COUNT}+ news sources</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                <span>Bias ratings from <a href="https://www.allsides.com/media-bias/ratings" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">AllSides</a> & <a href="https://adfontesmedia.com/interactive-media-bias-chart/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Ad Fontes</a></span>
              </div>
              <Link href="/methodology" className="flex items-center gap-1 text-blue-600 hover:underline">
                View our methodology
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Below the Fold - Built for Understanding */}
      {!hasContent && !loading && (
        <section className="py-16 px-4 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-12">
              Built for understanding, not outrage
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Scale className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">See the Whole Story</h3>
                <p className="text-slate-600 text-sm">
                  Compare coverage from {SOURCE_COUNT}+ sources across major outlets
                </p>
              </div>

              {/* Card 2 */}
              <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Spot the Spin</h3>
                <p className="text-slate-600 text-sm">
                  Our Intel Brief shows what sources agree on — and where they diverge
                </p>
              </div>

              {/* Card 3 */}
              <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Transparency First</h3>
                <p className="text-slate-600 text-sm">
                  We link to original sources. No tracking. No filter bubbles.
                </p>
              </div>
            </div>

            {/* CTA to Pilot */}
            <div className="mt-12 text-center">
              <Link
                href="/pilot"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-colors"
              >
                Join the Pilot
                <ExternalLink size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}


      {/* Opaque URL detected - proactive headline prompt (no error) */}
      {showKeywordFallback && !error && (
          <div className="mt-6 w-full max-w-2xl lg:max-w-3xl mx-auto bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6">
            <div className="text-center mb-4">
              {keywordFallbackType === 'share' ? (
                <>
                  <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-medium mb-2">
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
                  <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-medium mb-2">
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
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-full transition-colors text-sm whitespace-nowrap"
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
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-full transition-colors text-sm whitespace-nowrap"
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

      {/* Loading - Simplified skeleton preview */}
      {loading && (
        <div className="flex flex-col items-center px-4 pt-2 pb-12 animate-in fade-in duration-500">
          {/* Minimal status indicator */}
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm">{loadingFacts[loadingFactIndex]}</p>
          </div>

          {/* Skeleton preview - shows what's coming */}
          <div className="w-full max-w-4xl space-y-4">
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

            {/* Skeleton Coverage Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4"></div>
              <div className="flex justify-center gap-4">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-10 bg-slate-200 rounded-t animate-pulse" style={{ height: `${30 + i * 15}px` }}></div>
                    <div className="h-3 w-12 bg-slate-100 rounded animate-pulse mt-2"></div>
                  </div>
                ))}
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

                {/* Story Provenance - Where did this story originate? */}
                {provenance && (
                  <ProvenanceCard provenance={provenance} />
                )}

                {/* Narrative Style - How is this story being framed? */}
                {narrative && (
                  <NarrativeCard narrative={narrative} />
                )}

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
                              <span><span className="font-medium text-orange-800">{diff.label}:</span> {parseMarkdownBold(diff.value, 'intel', results)}</span>
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

            {/* Coverage Distribution */}
            {results.length > 0 && (
              <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
                <CoverageDistributionChart
                  results={results}
                  lastSubmittedUrl={lastSubmittedUrl}
                  selectedBias={selectedBias}
                  onBarClick={handleBarClick}
                />
              </div>
            )}

            {/* Source Analysis - Flip Cards */}
            {results.length > 0 && (
              <div id="source-analysis" className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10 scroll-mt-32">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Scale size={22} className="text-blue-600" />
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900">Source Analysis</h2>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{results.length} sources</span>
                    {selectedBias && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAN_COLORS[selectedBias].headerBg} ${LEAN_COLORS[selectedBias].headerText}`}>
                        Showing: {LEAN_LABELS[selectedBias]}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm">
                    {selectedBias
                      ? `Filtered by ${LEAN_LABELS[selectedBias]} sources first`
                      : 'Tap any card to see ownership transparency'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedResults.map((source, idx) => {
                    // Find analysis for this source if it exists (from inline comparison)
                    const analysisIdx = inlineComparison?.sortedSourceUrls?.findIndex((url: string) => url === source.uri);
                    const analysis = analysisIdx >= 0 ? inlineComparison?.analyses?.[analysisIdx] : undefined;

                    return (
                      <SourceFlipCard
                        key={source.uri || idx}
                        source={source}
                        analysis={analysis}
                        getPoliticalLean={getPoliticalLean}
                        onAuthorClick={(name, outlet) => setAuthorModal({ name, outlet })}
                      />
                    );
                  })}
                </div>

                {/* Retry Button */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500 text-center mb-3">Results may vary. Try again for different sources.</p>
                  <button
                    onClick={() => handleSearchWithUrl(lastSubmittedUrl)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-medium py-3 px-6 rounded-full transition-colors border border-slate-200"
                  >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Find different sources
                  </button>
                </div>

                {/* Feedback Widget */}
                <ResultFeedbackWidget pageUrl={lastSubmittedUrl} />
              </div>
            )}

            {/* No Results State */}
            {results.length === 0 && !loading && (
              <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-slate-600 font-medium">Limited coverage found</p>
                      <p className="text-sm text-slate-500 mt-1">We searched but couldn&apos;t find free alternative sources for this specific article. This can happen with breaking news or niche topics.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSearchWithUrl(lastSubmittedUrl)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-full transition-colors"
                  >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Try searching again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Author Modal */}
      {authorModal && (
        <AuthorModal
          authorName={authorModal.name}
          outlet={authorModal.outlet}
          onClose={() => setAuthorModal(null)}
        />
      )}

      {/* Email Gate Modal */}
      <EmailGate
        isOpen={showEmailGate}
        onClose={() => setShowEmailGate(false)}
        onSuccess={(email) => {
          handleEmailSuccess(email);
          setShowEmailGate(false);
        }}
      />
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