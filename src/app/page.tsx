"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import HowItWorks from "@/components/HowItWorks";
import { SummarySkeleton, SourcesSkeleton } from "@/components/LoadingSkeletons";
import type { GroundingSource } from "@/types";
import { Copy, Check, RefreshCw, Share2 } from "lucide-react";

type Usage = { used: number; remaining: number; limit: number; resetAt: string };

function HomeContent() {
  const searchParams = useSearchParams();
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [results, setResults] = useState<GroundingSource[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  const [currentUrl, setCurrentUrl] = useState("");
  const [lastSubmittedUrl, setLastSubmittedUrl] = useState("");

  async function refreshUsage() {
    try {
      const r = await fetch("/api/usage", { cache: "no-store" });
      if (r.ok) {
        const data = (await r.json()) as Usage;
        setUsage(data);
      }
    } catch {
      // silent
    }
  }

  async function handleSearchWithUrl(url: string) {
    if (!url.trim()) return;

    setLastSubmittedUrl(url);
    
    try {
      setIsLoading(true);
      setError(null);
      setSummary(null);
      setResults([]);

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
      setResults(Array.isArray(data.alternatives) ? data.alternatives : []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      refreshUsage();
    }
  }

  // Check for URL parameter from extension
  useEffect(() => {
    refreshUsage();
    
    const urlParam = searchParams.get('url');
    if (urlParam && !hasAutoSearched) {
      setCurrentUrl(urlParam);
      setHasAutoSearched(true);
      // Small delay to ensure state is set
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
      text: summary ? `${summary.slice(0, 100)}...` : 'Find free, public coverage of any news story.',
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

  const hasContent = summary || results.length > 0;
  const isActive = loading || hasContent;

  let buttonLabel = "Look for other sources";
  if (loading) {
    buttonLabel = "Searching...";
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col relative">
      
      {/* Usage counter (desktop) */}
      {usage && (
        <div className="hidden md:flex absolute top-4 right-4 z-10 items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm text-sm">
          <span className={`w-2 h-2 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="font-medium text-slate-600">
            {usage.remaining}/{usage.limit} <span className="hidden lg:inline">searches left</span>
          </span>
        </div>
      )}

      {/* Hero section */}
      <div className={`transition-all duration-500 ease-in-out flex flex-col items-center px-4 ${isActive ? 'pt-8 pb-6' : 'justify-center min-h-[80vh]'}`}>
        
        {/* Logo */}
      <Link href="/" className="mb-6 hover:opacity-90 transition-opacity">
{/* Logo */}
<Link href="/" className="mb-6 hover:opacity-90 transition-opacity">
  <Image
    src="/logo.png"
    alt="MirrorSource Logo"
    width={300}
    height={80}
    priority
    className="h-auto w-auto"
  />
</Link>



        {/* Headline */}
        <div className="text-center max-w-2xl space-y-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight md:whitespace-nowrap">
            See the whole story.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Paste <span className="font-medium text-slate-800">any news link</span>. We'll scout the web to generate a neutral summary and find you free, public coverage of the same story.
          </p>
        </div>

        {/* Search bar */}
        <div className="w-full max-w-2xl relative z-20">
          <UrlInputForm 
            onSubmit={handleSubmit} 
            isLoading={loading}
            value={currentUrl}
            onChange={setCurrentUrl}
            buttonLabel={buttonLabel}
          />
        </div>

        {/* Usage counter (mobile) */}
        {usage && !hasContent && (
          <div className="md:hidden mt-6 flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 text-xs text-slate-500">
             <span className={`w-1.5 h-1.5 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
             {usage.remaining}/{usage.limit} searches left
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-6 w-full max-w-2xl bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-center text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results section - STACKED LAYOUT */}
      {isActive && (
        <div className="flex-1 bg-slate-50 px-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Summary card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Summary</h2>
                {summary && !loading && (
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
              
              {loading ? (
                <SummarySkeleton />
              ) : (
                <div className="prose prose-slate leading-relaxed text-slate-700">
                  {summary ? (
                    <p style={{ whiteSpace: "pre-wrap" }}>{summary}</p>
                  ) : (
                    <p className="text-slate-400 italic">No summary available.</p>
                  )}
                </div>
              )}

              {/* How it works - shown after summary loads */}
              {!loading && summary && (
                <div className="mt-6">
                  <HowItWorks />
                </div>
              )}
            </div>

            {/* Alternative Sources card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Alternative Sources
              </h2>

              {loading ? (
                <SourcesSkeleton />
              ) : (
                <>
                  {results.length > 0 ? (
                    <>
                      <ResultsDisplay results={results} />
                      
                      {/* Retry section */}
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
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
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