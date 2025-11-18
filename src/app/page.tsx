"use client";

import { useState } from "react";
import Image from "next/image";
import UrlInputForm from "../components/UrlInputForm";
import ResultsDisplay from "../components/ResultsDisplay";
import { GroundingSource } from "../types"; 

export default function HomePage() {
  const [loading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [results, setResults] = useState<GroundingSource[] | null>(null);

  async function handleSubmit(url: string) {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setSummary(null);

    try {
      const response = await fetch("/api/find", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errData = await response.json();
          throw new Error(errData.error || "Request failed with an unknown server error");
        } else {
          const textError = await response.text();
          console.error("Non-JSON API response:", textError);
          throw new Error(
            `API call failed. Received HTML response (Status ${response.status}). The API route may be incorrect or missing.`
          );
        }
      }

      const data = await response.json();
      setSummary(data.summary);
      setResults(data.alternatives);

    } catch (err) {
      setError(err instanceof Error ? err.message : "A network error occurred. Please try again.");
    }

    setIsLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start py-24 px-4">
      <div className="w-full max-w-3xl space-y-10">
        
        {/* --- LOGO SECTION (border removed) --- */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="MirrorSource Logo"
              width={400}
              height={100}
              priority
              className="border-0 shadow-none outline-none"
              style={{ border: "none", boxShadow: "none" }}
            />
          </div>

          <p className="text-center text-slate-600 mt-6 text-lg">
            Want to see the whole story? Paste a news URL, and MirrorSource will find and summarize 
            free, public articles on the same topic from across the web.
          </p>
        </div>
        {/* --- END LOGO SECTION --- */}

        <UrlInputForm onSubmit={handleSubmit} isLoading={loading} />

        {error && (
          <p className="mt-8 text-red-600 text-center">
            {error}
          </p>
        )}

        {summary && (
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-3">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <p className="text-slate-700" style={{ whiteSpace: "pre-wrap" }}>{summary}</p>
          </article>
        )}

        {results && results.length > 0 && (
          <h2 className="text-2xl font-bold pt-6 text-slate-800">Alternative Sources</h2>
        )}

        <ResultsDisplay results={results} />
      </div>
    </main>
  );
}
