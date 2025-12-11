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

function getSourceType(url: string): 'Wire' | 'Corporate' | 'Public' | 'International' | 'Local' | 'Syndicated' | 'Magazine' | 'Specialized' | 'Analysis' | 'Platform' | 'National' {
  const domain = new URL(url).hostname.toLowerCase();
  
  // Wire services
  if (domain.includes('apnews') || domain.includes('reuters') || domain.includes('afp')) {
    return 'Wire';
  }
  
  // Public media
  if (domain.includes('pbs.org') || domain.includes('npr.org') || domain.includes('bbc.com') || domain.includes('bbc.co.uk') || domain.includes('cbc.ca') || domain.includes('abc.net.au')) {
    return 'Public';
  }
  
  // International
  if (domain.includes('theguardian') || domain.includes('aljazeera') || domain.includes('dw.com') || 
      domain.includes('france24') || domain.includes('scmp.com') || domain.includes('euronews') ||
      domain.includes('timesofisrael') || domain.includes('jpost.com') || domain.includes('ynetnews') ||
      domain.includes('haaretz') || domain.includes('thehindu') || domain.includes('arabnews')) {
    return 'International';
  }
  
  // Syndicated
  if (domain.includes('yahoo') || domain.includes('msn.com') || domain.includes('aol.com')) {
    return 'Syndicated';
  }
  
  // Analysis / Think tanks
  if (domain.includes('politico') || domain.includes('thehill') || domain.includes('foreignpolicy') ||
      domain.includes('foreignaffairs') || domain.includes('cfr.org') || domain.includes('brookings') ||
      domain.includes('cato.org') || domain.includes('heritage.org') || domain.includes('carnegie') ||
      domain.includes('rand.org') || domain.includes('responsiblestatecraft') || domain.includes('diplomaticopinion') ||
      domain.includes('harvardpoliticalreview')) {
    return 'Analysis';
  }
  
  // Magazines
  if (domain.includes('time.com') || domain.includes('newsweek') || domain.includes('forbes') ||
      domain.includes('theatlantic') || domain.includes('newyorker') || domain.includes('economist')) {
    return 'Magazine';
  }
  
  // Specialized / Business
  if (domain.includes('bloomberg') || domain.includes('cnbc') || domain.includes('ft.com') ||
      domain.includes('wsj.com') || domain.includes('wired') || domain.includes('techcrunch') ||
      domain.includes('theverge') || domain.includes('livemint') || domain.includes('business-standard')) {
    return 'Specialized';
  }
  
  // Platforms
  if (domain.includes('youtube') || domain.includes('reddit') || domain.includes('medium') || domain.includes('substack')) {
    return 'Platform';
  }
  
  // National
  if (domain.includes('usatoday') || domain.includes('axios')) {
    return 'National';
  }
  
  // Local (regional papers)
  if (domain.includes('tribune') || domain.includes('post') || 
      domain.includes('herald') || domain.includes('gazette') || domain.includes('journal') ||
      domain.includes('chronicle') || domain.includes('sentinel') || domain.includes('daily')) {
    return 'Local';
  }
  
  // Default to Corporate
  return 'Corporate';
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
  const [showKeywordFallback, setShowKeywordFallback] = useState(false);
  const [keywords, setKeywords] = useState("");

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

  // Rotate scanner icons - 1100ms is optimal (research: 1000-1200ms feels steady, not frantic)
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setScannerIconIndex((prev) => (prev + 1) % scannerIcons.length);
      }, 1100);
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

  // Helper to detect URLs with no readable keywords (UUIDs, numbers only)
  function isOpaqueUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname.toLowerCase();
      
      // Known sites that typically use UUID/opaque URLs
      const opaqueUrlDomains = ['ft.com', 'bloomberg.com', 'economist.com'];
      const isKnownOpaqueSite = opaqueUrlDomains.some(domain => hostname.includes(domain));
      
      // For FT, Bloomberg, Economist: check if URL ends with UUID pattern
      if (isKnownOpaqueSite) {
        // UUID pattern: 8-4-4-4-12 hex chars, or just long hex string
        const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
        const longHexPattern = /\/[a-f0-9\-]{20,}$/i;
        if (uuidPattern.test(path) || longHexPattern.test(path)) {
          return true;
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
      
      return words.length < 2;
    } catch {
      return false;
    }
  }

  async function handleSearchWithUrl(url: string) {
    if (!url.trim()) return;
    setLastSubmittedUrl(url);
    setLoadingFactIndex(0);
    setScannerIconIndex(0);
    setVisibleIcons(0);
    setShowKeywordFallback(false);
    setKeywords("");
    
    // Check for opaque URLs (FT, Bloomberg, etc. with UUIDs)
    if (isOpaqueUrl(url)) {
      setError(null);
      setShowKeywordFallback(true);
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
    } catch (e: unknown) {
      // Network error - browser couldn't reach the server
      setError("Unable to connect. Please check your internet connection and try again.");
      setErrorRetryable(true);
    } finally {
      setIsLoading(false);
      refreshUsage();
    }
  }

  async function handleKeywordSearch() {
    if (!keywords.trim()) return;
    
    setLoadingFactIndex(0);
    setScannerIconIndex(0);
    setVisibleIcons(0);
    setShowKeywordFallback(false);
    
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
        body: JSON.stringify({ keywords: keywords.trim() }),
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
    setShowKeywordFallback(false);
    setKeywords("");
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

        {/* Opaque URL detected - proactive headline prompt (no error) */}
        {showKeywordFallback && !error && (
          <div className="mt-6 w-full max-w-2xl lg:max-w-3xl bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6">
            <div className="text-center mb-4">
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
                This {getSourceName(lastSubmittedUrl)} link is protected. Enter the headline or main topic to lock on.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
                placeholder="e.g., US trade deficit drops to lowest since 2020"
                className="flex-1 px-4 py-3 rounded-full border border-slate-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                onClick={handleKeywordSearch}
                disabled={loading || !keywords.trim()}
                className="inline-flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-full transition-colors text-sm whitespace-nowrap"
              >
                Lock on
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
                  Enter the headline to help us find this {getSourceName(lastSubmittedUrl)} story.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
                    placeholder="e.g., Oracle shares sink on data center spending"
                    className="flex-1 px-4 py-3 rounded-full border border-amber-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleKeywordSearch}
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
      </div>

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
            <div className="flex justify-center gap-4 py-4">
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
                {summary ? <p className="text-base md:text-lg leading-7 md:leading-8 text-slate-600">{parseMarkdownBold(summary, 'summary')}</p> : <p className="text-slate-400 italic">No summary available.</p>}
              </div>
            </div>

            {/* Intel Brief */}
            {(commonGround || keyDifferences) && (
              <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">Intel Brief</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  {commonGround && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Common Ground</h3>
                      </div>
                      <p className="text-sm md:text-base text-slate-600 leading-relaxed">{parseMarkdownBold(commonGround, 'intel')}</p>
                    </div>
                  )}
                  {keyDifferences && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Scale className="w-4 h-4 text-orange-600" />
                        <h3 className="text-sm font-semibold text-orange-800 uppercase tracking-wide">Key Differences</h3>
                      </div>
                      <p className="text-sm md:text-base text-orange-700 leading-relaxed">{parseMarkdownBold(keyDifferences, 'intel')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alternative Sources */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 md:p-8 lg:p-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Alternative Sources</h2>
                {results.length >= 2 && (
                  <Link
                    href={`/compare?sources=${encodeURIComponent(JSON.stringify(
                      // De-duplicate by domain and pass all sources
                      results
                        .map((r, i) => ({
                          id: `source-${i}`,
                          name: r.title?.split(' - ')[0] || new URL(r.uri).hostname.replace('www.', ''),
                          type: getSourceType(r.uri),
                          url: r.uri,
                          domain: new URL(r.uri).hostname.replace('www.', ''),
                        }))
                        .filter((source, index, self) => 
                          index === self.findIndex(s => s.domain === source.domain)
                        )
                    ))}`}
                    className="text-sm text-[#2563eb] hover:underline flex items-center gap-1"
                  >
                    <Scale size={16} />
                    <span className="hidden sm:inline">Compare coverage</span>
                  </Link>
                )}
              </div>

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