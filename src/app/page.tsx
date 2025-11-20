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
    // Reset state
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

        // JSON error
        if (contentType && contentType.includes("application/json")) {
          const errData = await response.json();
          throw new Error(errData.error || "AI temporarily unavailable");
        }

        // Non-JSON error (HTML from server)
        const raw = await response.text();
        console.error("Non-JSON API response:", raw);
        throw new Error(
          `MirrorSource couldn't analyze that article right now. Please try again shortly.`
        );
      }

      const data = await response.json();
      setSummary(data.summary || null);
      setResults(data.alternatives || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "MirrorSource is experiencing a high load. Please try again shortly."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start py-24 px-4">
      <div className="w-full max-w-3xl space-y-10">

        {/* --- LOGO SECTION --- */}
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
            MirrorSource helps you see the whole story. Paste a news link to get a clear summary
            and find public articles covering the same story, avoiding paywalls whenever possible.
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
            <p className="text-slate-700" style={{ whiteSpace: "pre-wrap" }}>
              {summary}
            </p>
          </article>
        )}

        {results && results.length > 0 && (
          <>
            <h2 className="text-2xl font-bold pt-6 text-slate-800">
              Alternative Sources
            </h2>
            <ResultsDisplay results={results} />
          </>
        )}
      </div>
    </main>
  );
}
