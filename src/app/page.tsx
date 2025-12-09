"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import type { GroundingSource } from "@/types";
import { Copy, Check, RefreshCw, Share2, CheckCircle2, Scale, AlertCircle } from "lucide-react";

type Usage = { used: number; remaining: number; limit: number; resetAt: string };

const loadingFacts = [
  "Scanning news sources...",
  "Finding alternative perspectives...",
  "Comparing coverage across outlets...",
  "Checking international sources...",
  "Looking for wire services...",
];

const scannerIcons = [
  { domain: "theguardian.com", name: "The Guardian" },
  { domain: "reuters.com", name: "Reuters" },
  { domain: "apnews.com", name: "AP News" },
  { domain: "bbc.com", name: "BBC" },
  { domain: "cbsnews.com", name: "CBS News" },
  { domain: "npr.org", name: "NPR" },
  { domain: "forbes.com", name: "Forbes" },
  { domain: "bloomberg.com", name: "Bloomberg" },
];

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

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain.replace(/^www\./, '')}&sz=64`;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(true);
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

  // Rotate scanner icons
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setScannerIconIndex((prev) => (prev + 1) % scannerIcons.length);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Staggered icon reveal
  useEffect(() => {
    if (!loading && results.length > 0) {
      setVisibleIcons(0);
      const timer = setInterval(() => {
        setVisibleIcons((prev) => {
          if (prev >= results.length) { clearInterval(timer); return prev; }
          return prev + 1;
        });
      }, 150);
      return () => clearInterval(timer);
    }
  }, [loading, results.length]);

  async function refreshUsage() {
    try {
      const r = await fetch("/api/usage", { cache: "no-store" });
      if (r.ok) setUsage(await r.json());
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
    } catch (e: unknown) {
      // Network error - browser couldn't reach the server
      setError("Unable to connect. Please check your internet connection and try again.");
      setErrorRetryable(true);
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
      setTimeout(() => handleSearchWithUrl(urlParam), 100);
    }
  }, [searchParams, hasAutoSearched]);

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
    setHasAutoSearched(true);
    setVisibleIcons(0);
    window.history.pushState({}, '', '/');
  }

  const hasContent = summary || results.length > 0;
  const isActive = loading || hasContent;
  const currentScannerIcon = scannerIcons[scannerIconIndex];

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col relative">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .icon-pop { animation: popIn 0.4s ease-out forwards; }
      `}} />
      
      {/* Usage badge - rate limit only */}
      {usage && (
        <div className="hidden md:flex fixed top-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-md text-sm">
            <span className={`w-2 h-2 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="font-medium text-slate-600">{usage.remaining}/{usage.limit} left</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`transition-all duration-500 flex flex-col items-center px-4 ${isActive ? 'pt-8 pb-4' : 'justify-center min-h-[80vh]'}`}>
        <button onClick={handleLogoClick} className="mb-6 hover:opacity-90 transition-opacity cursor-pointer bg-transparent border-none p-0" type="button">
          <Image src="/logo.png" alt="MirrorSource Logo" width={400} height={100} priority className="w-48 sm:w-64 md:w-80 lg:w-[420px] h-auto" />
        </button>

        <div className="text-center max-w-2xl space-y-4 mb-8">
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold text-slate-900 tracking-tight md:whitespace-nowrap">See the whole story.</h1>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed">One story. Multiple sources. Zero friction.</p>
        </div>

        <div className="w-full max-w-2xl lg:max-w-3xl relative z-20">
          <UrlInputForm onSubmit={handleSubmit} isLoading={loading} value={currentUrl} onChange={setCurrentUrl} buttonLabel={loading ? "Searching..." : "Look for other sources"} />
        </div>

        {usage && !hasContent && !loading && (
          <div className="md:hidden mt-6">
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 text-xs text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {usage.remaining}/{usage.limit} left
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 w-full max-w-2xl lg:max-w-3xl bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-amber-800 font-medium mb-2">{error}</p>
            {errorRetryable && (
              <>
                <p className="text-amber-600 text-sm mb-4">Search results vary each time. Give it another shot!</p>
                <button
                  onClick={() => handleSearchWithUrl(currentUrl)}
                  disabled={loading || !currentUrl}
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium py-2 px-5 rounded-full transition-colors text-sm"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center px-4 pt-8 pb-12 animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center shadow-lg animate-pulse">
                <img key={currentScannerIcon.domain} src={getHighResFavicon(currentScannerIcon.domain)} alt={currentScannerIcon.name} className="w-14 h-14 md:w-16 md:h-16 object-contain rounded-lg animate-in fade-in zoom-in duration-300" onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.ico'; }} />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-30"></div>
            </div>
            <p className="text-cyan-600 font-semibold text-sm uppercase tracking-wider">Scanning...</p>
            <p className="text-slate-500 text-base animate-pulse text-center max-w-sm">{loadingFacts[loadingFactIndex]}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && hasContent && (
        <div className="flex-1 bg-slate-50 px-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* Source Icons */}
            {results.length > 0 && (
              <div className="flex flex-wrap justify-center gap-5 md:gap-8 py-6">
                {results.map((item, index) => {
                  const sourceDomain = item.sourceDomain || '';
                  const isVisible = index < visibleIcons;
                  return (
                    <a key={index} href={item.uri} target="_blank" rel="noopener noreferrer" className={`flex flex-col items-center gap-2 group ${isVisible ? 'icon-pop' : 'opacity-0 scale-0'}`} style={{ animationDelay: `${index * 100}ms` }}>
                      <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center group-hover:shadow-lg group-hover:border-blue-300 transition-all">
                        <img src={getFaviconUrl(sourceDomain)} alt={sourceDomain} className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wide group-hover:text-blue-600 transition-colors text-center max-w-[90px] truncate">{sourceDomain.replace(/^www\./, '').split('.')[0]}</span>
                    </a>
                  );
                })}
              </div>
            )}
            
            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 lg:p-10">
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
                {summary ? <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600">{parseMarkdownBold(summary, 'summary')}</p> : <p className="text-slate-400 italic">No summary available.</p>}
              </div>
            </div>

            {/* Intel Brief */}
            {(commonGround || keyDifferences) && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">Intel Brief</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  {commonGround && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Common Ground</h3>
                      </div>
                      <p className="text-sm md:text-base text-emerald-700 leading-relaxed">{parseMarkdownBold(commonGround, 'intel')}</p>
                    </div>
                  )}
                  {keyDifferences && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Scale className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">Key Differences</h3>
                      </div>
                      <p className="text-sm md:text-base text-amber-700 leading-relaxed">{parseMarkdownBold(keyDifferences, 'intel')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alternative Sources */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 lg:p-10">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-5">Alternative Sources</h2>

              {results.length > 0 ? (
                <>
                  <ResultsDisplay results={results} />
                  <div className="mt-6 pt-6 border-t border-slate-100">
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
                  
                  <button onClick={() => handleSearchWithUrl(lastSubmittedUrl)} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-full transition-colors">
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
            <Link href="/legal" className="hover:text-blue-600 transition-colors">Legal</Link>
            <a href="mailto:contact@mirrorsource.app" className="hover:text-blue-600 transition-colors">Contact</a>
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