"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import { SummarySkeleton, SourcesSkeleton } from "@/components/LoadingSkeletons";
import type { GroundingSource } from "@/types";
import { Copy, Check, RefreshCw, Share2, CheckCircle2, Scale } from "lucide-react";

type Usage = { used: number; remaining: number; limit: number; resetAt: string };

const loadingFacts = [
  "Scanning thousands of news sources...",
  "Finding alternative perspectives...",
  "Comparing coverage across outlets...",
  "Analyzing different viewpoints...",
  "Discovering free sources for you...",
  "Checking international coverage...",
  "Looking for diverse perspectives...",
  "Searching public news archives...",
];

// Sample news source icons to rotate through during scanning
const scannerIcons = [
  { domain: "theguardian.com", name: "The Guardian" },
  { domain: "reuters.com", name: "Reuters" },
  { domain: "apnews.com", name: "AP News" },
  { domain: "bbc.com", name: "BBC" },
  { domain: "forbes.com", name: "Forbes" },
  { domain: "cbsnews.com", name: "CBS News" },
  { domain: "npr.org", name: "NPR" },
  { domain: "washingtonpost.com", name: "Washington Post" },
];

// Helper function to parse markdown bold (**text**) to JSX
function parseMarkdownBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function getFaviconUrl(domain: string): string {
  const cleanDomain = domain.replace(/^www\./, '');
  return `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [commonGround, setCommonGround] = useState<string | null>(null);
  const [keyDifferences, setKeyDifferences] = useState<string | null>(null);
  const [results, setResults] = useState<GroundingSource[]>([]);
  const [isPaywalled, setIsPaywalled] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [loadingFactIndex, setLoadingFactIndex] = useState(0);
  const [scannerIconIndex, setScannerIconIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [lastSubmittedUrl, setLastSubmittedUrl] = useState("");
  const [storiesCount, setStoriesCount] = useState<number | null>(null);
  const [visibleIcons, setVisibleIcons] = useState(0);

  // Rotate loading facts
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingFactIndex((prev) => (prev + 1) % loadingFacts.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Rotate scanner icons during loading
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setScannerIconIndex((prev) => (prev + 1) % scannerIcons.length);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Staggered icon reveal animation after results load
  useEffect(() => {
    if (!loading && results.length > 0) {
      setVisibleIcons(0);
      const timer = setInterval(() => {
        setVisibleIcons((prev) => {
          if (prev >= results.length) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, 150);
      return () => clearInterval(timer);
    }
  }, [loading, results.length]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ms_stories');
      if (stored) {
        setStoriesCount(parseInt(stored, 10));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (summary && !loading) {
      try {
        const current = parseInt(localStorage.getItem('ms_stories') || '0', 10);
        const newCount = current + 1;
        localStorage.setItem('ms_stories', String(newCount));
        setStoriesCount(newCount);
      } catch {}
    }
  }, [summary, loading]);

  async function refreshUsage() {
    try {
      const r = await fetch("/api/usage", { cache: "no-store" });
      if (r.ok) {
        const data = (await r.json()) as Usage;
        setUsage(data);
      }
    } catch {}
  }

  async function handleSearchWithUrl(url: string) {
    if (!url.trim()) return;
    setLastSubmittedUrl(url);
    setLoadingFactIndex(0);
    setScannerIconIndex(0);
    setVisibleIcons(0);
    
    try {
      setIsLoading(true);
      setError(null);
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
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.error || "You've reached today's limit.";
          setError(msg);
          await refreshUsage();
          return;
        }
        throw new Error("Unable to process search. Please check the URL and try again.");
      }

      const data = await res.json();
      setSummary(data.summary ?? null);
      setCommonGround(data.commonGround ?? null);
      setKeyDifferences(data.keyDifferences ?? null);
      setResults(Array.isArray(data.alternatives) ? data.alternatives : []);
      setIsPaywalled(data.isPaywalled ?? false);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      refreshUsage();
    }
  }

  useEffect(() => {
    refreshUsage();
    const urlParam = searchParams.get('url');
    if (urlParam && !hasAutoSearched) {
      setCurrentUrl(urlParam);
      setHasAutoSearched(true);
      setTimeout(() => {
        handleSearchWithUrl(urlParam);
      }, 100);
    }
  }, [searchParams, hasAutoSearched]);

  async function handleSearch() {
    handleSearchWithUrl(currentUrl);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSearch();
  }

  async function handleCopySummary() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function handleShare() {
    const shareData = {
      title: 'MirrorSource - See the Whole Story',
      text: summary ? summary.slice(0, 100) + '...' : 'Find free, public coverage of any news story.',
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
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  function handleLogoClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSummary(null);
    setCommonGround(null);
    setKeyDifferences(null);
    setResults([]);
    setIsPaywalled(false);
    setError(null);
    setCurrentUrl("");
    setLastSubmittedUrl("");
    setHasAutoSearched(true);
    setVisibleIcons(0);
    window.history.pushState({}, '', '/');
  }

  const hasContent = summary || results.length > 0;
  const isActive = loading || hasContent;

  let buttonLabel = "Look for other sources";
  if (loading) {
    buttonLabel = "Searching...";
  }

  const currentScannerIcon = scannerIcons[scannerIconIndex];

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col relative">
      
      <div className="hidden md:flex fixed top-4 right-4 z-50 items-center gap-3">
        {storiesCount !== null && storiesCount > 0 && (
          <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-md text-sm">
            <span className="font-bold">{storiesCount}</span>
            <span className="text-blue-100">stories</span>
          </div>
        )}
        
        {usage && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-md text-sm">
            <span className={`w-2 h-2 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="font-medium text-slate-600">
              {usage.remaining}/{usage.limit} <span className="hidden lg:inline">left</span>
            </span>
          </div>
        )}
      </div>

      <div className={`transition-all duration-500 ease-in-out flex flex-col items-center px-4 ${isActive ? 'pt-8 pb-6' : 'justify-center min-h-[80vh]'}`}>
        
        <button 
          onClick={handleLogoClick}
          className="mb-6 hover:opacity-90 transition-opacity cursor-pointer bg-transparent border-none p-0"
          type="button"
        >
          <Image
            src="/logo.png"
            alt="MirrorSource Logo"
            width={400}
            height={100}
            priority
            className="w-48 sm:w-64 md:w-72 lg:w-96 h-auto"
          />
        </button>

        <div className="text-center max-w-2xl space-y-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight md:whitespace-nowrap">
            See the whole story.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            One story. Multiple sources. Zero friction.
          </p>
        </div>

        <div className="w-full max-w-2xl relative z-20">
          <UrlInputForm 
            onSubmit={handleSubmit} 
            isLoading={loading}
            value={currentUrl}
            onChange={setCurrentUrl}
            buttonLabel={buttonLabel}
          />
        </div>

        {usage && !hasContent && !loading && (
          <div className="md:hidden mt-6 flex items-center gap-3">
            {storiesCount !== null && storiesCount > 0 && (
              <div className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
                <span className="font-bold">{storiesCount}</span>
                <span className="text-blue-100">stories</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 text-xs text-slate-500">
               <span className={`w-1.5 h-1.5 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
               {usage.remaining}/{usage.limit} left
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 w-full max-w-2xl bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-center text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Loading State - Scanning Animation */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20 animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-4">
            {/* Rotating Scanner Icon */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center shadow-lg animate-pulse">
                <img
                  key={currentScannerIcon.domain}
                  src={getFaviconUrl(currentScannerIcon.domain)}
                  alt={currentScannerIcon.name}
                  className="w-12 h-12 object-contain rounded-lg animate-in fade-in zoom-in duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/favicon.ico';
                  }}
                />
              </div>
              {/* Scanning ring animation */}
              <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-30"></div>
            </div>
            
            {/* Scanning text */}
            <p className="text-cyan-600 font-semibold text-sm uppercase tracking-wider">
              Scanning...
            </p>
            
            {/* Rotating status message */}
            <p className="text-slate-500 text-sm animate-pulse">
              {loadingFacts[loadingFactIndex]}
            </p>
          </div>
        </div>
      )}

      {/* Results Content */}
      {!loading && hasContent && (
        <div className="flex-1 bg-slate-50 px-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Source Icons Header */}
            {results.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 md:gap-6 py-4">
                {results.map((item, index) => {
                  const sourceDomain = item.sourceDomain || '';
                  const isVisible = index < visibleIcons;
                  
                  return (
                    <a
                      key={index}
                      href={item.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex flex-col items-center gap-2 group transition-all duration-300 ${
                        isVisible 
                          ? 'opacity-100 translate-y-0' 
                          : 'opacity-0 translate-y-4'
                      }`}
                      style={{ transitionDelay: `${index * 50}ms` }}
                    >
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center group-hover:shadow-lg group-hover:border-blue-300 transition-all">
                        <img
                          src={getFaviconUrl(sourceDomain)}
                          alt={sourceDomain}
                          className="w-8 h-8 md:w-10 md:h-10 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide group-hover:text-blue-600 transition-colors text-center max-w-[80px] truncate">
                        {sourceDomain.replace(/^www\./, '').split('.')[0]}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
            
            {/* Summary Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Summary</h2>
                {summary && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySummary}
                      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-slate-100"
                      title="Copy summary"
                    >
                      {copied ? (
                        <>
                          <Check size={16} className="text-green-600" />
                          <span className="hidden sm:inline text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span className="hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-slate-100"
                      title="Share"
                    >
                      {shared ? (
                        <>
                          <Check size={16} className="text-green-600" />
                          <span className="hidden sm:inline text-green-600">Link copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 size={16} />
                          <span className="hidden sm:inline">Share</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="prose prose-slate leading-relaxed text-slate-700">
                {summary ? (
                  <p style={{ whiteSpace: "pre-wrap" }}>{summary}</p>
                ) : (
                  <p className="text-slate-400 italic">No summary available.</p>
                )}
              </div>
            </div>

            {/* Intel Brief Section */}
            {(commonGround || keyDifferences) && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                  </svg>
                  <h2 className="text-xl font-bold text-slate-900">Intel Brief</h2>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Common Ground Box */}
                  {commonGround && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">
                          Common Ground
                        </h3>
                      </div>
                      <p className="text-sm text-emerald-900 leading-relaxed">
                        {commonGround}
                      </p>
                    </div>
                  )}
                  
                  {/* Key Differences Box */}
                  {keyDifferences && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Scale className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">
                          Key Differences
                        </h3>
                      </div>
                      <p className="text-sm text-amber-900 leading-relaxed">
                        {parseMarkdownBold(keyDifferences)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alternative Sources Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Alternative Sources
              </h2>

              {results.length > 0 ? (
                <>
                  <ResultsDisplay results={results} />
                  
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <p className="text-sm text-slate-500 text-center mb-3">
                      Results may vary. Try again for different sources.
                    </p>
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-medium py-3 px-6 rounded-full transition-colors border border-slate-200"
                    >
                      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                      Find different sources
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <p>No sources found for this article.</p>
                  <p className="text-sm mt-2">Try searching again or check if the URL is correct.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <footer className="py-6 px-4 border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} MirrorSource</p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-blue-600 transition-colors">
              About
            </Link>
            <Link href="/legal" className="hover:text-blue-600 transition-colors">
              Legal
            </Link>
            <a href="mailto:contact@mirrorsource.app" className="hover:text-blue-600 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>

    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}