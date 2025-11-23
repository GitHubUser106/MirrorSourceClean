"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { GroundingSource } from "@/types";
import { RotateCw } from "lucide-react";

type Usage = { used: number; remaining: number; limit: number; resetAt: string };

export default function HomePage() {
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [results, setResults] = useState<GroundingSource[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);

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

  useEffect(() => {
    refreshUsage();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUrl.trim()) return;

    setLastSubmittedUrl(currentUrl); 
    
    try {
      setIsLoading(true);
      setError(null);
      setSummary(null);
      setResults([]);

      const res = await fetch("/api/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.error || "You’ve reached today’s limit.";
          setError(msg);
          await refreshUsage(); 
          return;
        }
        // Generic error message
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

  const hasContent = summary || results.length > 0;
  const isActive = loading || hasContent;
  const isNewInput = currentUrl !== lastSubmittedUrl;

  // FINAL BUTTON LABEL LOGIC
  let buttonLabel = "Find Alternatives";
  if (loading) {
    buttonLabel = "Searching...";
  } else if (error && !isNewInput) {
    buttonLabel = "Try again";
  } else if (hasContent && !isNewInput) {
    buttonLabel = "Look for other sources"; // "Look for" implies effort, not guarantee
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col relative">
      
      {/* --- USAGE COUNTER (DESKTOP) --- */}
      {usage && (
        <div className="hidden md:flex absolute top-4 right-4 z-10 items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm text-sm">
          <span className={`w-2 h-2 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="font-medium text-slate-600">
            {usage.remaining}/{usage.limit} <span className="hidden lg:inline">searches left</span>
          </span>
        </div>
      )}

      {/* --- HERO SECTION --- */}
      <div className={`transition-all duration-500 ease-in-out flex flex-col items-center px-4 ${isActive ? 'pt-8 pb-8' : 'justify-center min-h-[80vh]'}`}>
        
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
          {/* 👇 NEW HEADLINE */}
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Don’t let a paywall hide the facts.
          </h1>
          {/* 👇 NEW SUBHEAD */}
         <p className="text-lg text-slate-600 leading-relaxed">
            Paste <span className="font-medium text-slate-800">news link</span>. We’ll scout the web to generate a neutral summary and find you free, public coverage of the same story.
          </p>
        </div>

        {/* Search Bar */}
        <div className="w-full max-w-2xl relative z-20">
          <UrlInputForm 
            onSubmit={handleSubmit} 
            isLoading={loading}
            value={currentUrl}
            onChange={setCurrentUrl}
            buttonLabel={buttonLabel}
          />
        </div>

        {/* --- USAGE COUNTER (MOBILE) --- */}
        {usage && !hasContent && (
          <div className="md:hidden mt-6 flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 text-xs text-slate-500">
             <span className={`w-1.5 h-1.5 rounded-full ${usage.remaining > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
             {usage.remaining}/{usage.limit} searches left
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-6 w-full max-w-2xl bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-center text-sm">
            {error}
          </div>
        )}
      </div>

      {/* --- SPLIT CONTENT SECTION --- */}
      {isActive && (
        <div className="flex-1 bg-slate-50 px-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT COLUMN: Summary */}
            <div className="flex flex-col h-full">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 h-full">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  Summary
                </h2>
                
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse gap-3">
                    <LoadingSpinner size={32} />
                    <p>Reading article...</p>
                  </div>
                ) : (
                  <div className="prose prose-slate leading-relaxed text-slate-700">
                    {summary ? (
                      <p style={{ whiteSpace: "pre-wrap" }}>{summary}</p>
                    ) : (
                      <p className="text-slate-400 italic">No summary available.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Alternative Sources */}
            <div className="flex flex-col h-full">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 h-full flex flex-col">
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                  Alternative Sources
                </h2>

                {loading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse gap-3">
                    <LoadingSpinner size={32} />
                    <p>Searching for sources...</p>
                  </div>
                ) : (
                  <>
                    <ResultsDisplay results={results} />

                    {/* Footer Tip */}
                    {results.length > 0 ? (
                      <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                        <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
                          <RotateCw size={14} />
                          <span>Results may vary. Click <strong>Look for other sources</strong> above to try again.</span>
                        </p>
                      </div>
                    ) : (
                      <div className="mt-8 text-center text-slate-500">
                         <p>No sources found.</p>
                         <p className="text-sm mt-1">Click <strong>Look for other sources</strong> to search again.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}