"use client";

import { useState } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Send, ArrowLeft } from "lucide-react";

export default function PilotPage() {
  const [email, setEmail] = useState("");
  const [whatBrought, setWhatBrought] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/pilot-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || null,
          whatBrought,
          feedback,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit feedback");
      }

      setIsSubmitted(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="MirrorSource"
                width={160}
                height={40}
                className="h-9 w-auto"
              />
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/about" className="text-slate-600 hover:text-blue-600 transition-colors">About</Link>
              <Link href="/methodology" className="text-slate-600 hover:text-blue-600 transition-colors">Methodology</Link>
              <Link href="/sources" className="text-slate-600 hover:text-blue-600 transition-colors">Sources</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Join the Pilot
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            MirrorSource is in active development. We&apos;re looking for feedback from users who care about media literacy.
          </p>
        </div>
      </section>

      {/* What we're testing */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">What we&apos;re testing</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">Coverage distribution accuracy across outlets</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">Intel Brief usefulness for understanding story context</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">Source transparency and ownership data quality</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">Performance on slow connections and mobile devices</span>
            </li>
          </ul>
        </div>
      </section>

      {/* How feedback is used */}
      <section className="py-12 px-4 bg-white border-y border-slate-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">How feedback is used</h2>
          <p className="text-slate-600 leading-relaxed">
            Your input helps us improve the tool. We don&apos;t track your reading history or build profiles.
          </p>
        </div>
      </section>

      {/* Feedback Form */}
      <section className="py-12 px-4">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Share your feedback</h2>

          {isSubmitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-green-800 mb-2">Thank you!</h3>
              <p className="text-green-700 mb-6">Your feedback has been submitted. We appreciate your help improving MirrorSource.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium"
              >
                <ArrowLeft size={18} />
                Back to MirrorSource
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (optional) */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  Email <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* What brought you here? */}
              <div>
                <label htmlFor="whatBrought" className="block text-sm font-medium text-slate-700 mb-2">
                  What brought you here?
                </label>
                <textarea
                  id="whatBrought"
                  value={whatBrought}
                  onChange={(e) => setWhatBrought(e.target.value)}
                  placeholder="I was looking for a way to compare news coverage..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Any issues or suggestions? */}
              <div>
                <label htmlFor="feedback" className="block text-sm font-medium text-slate-700 mb-2">
                  Any issues or suggestions?
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="The coverage distribution chart was helpful, but..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || (!whatBrought.trim() && !feedback.trim())}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 px-6 rounded-full transition-colors"
              >
                {isSubmitting ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <Send size={18} />
                    Submit Feedback
                  </>
                )}
              </button>
            </form>
          )}

          {/* Privacy note */}
          <div className="mt-8 p-4 bg-slate-100 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong className="text-slate-700">Privacy note:</strong> We store feedback separately from usage. No personal data is required.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
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
    </main>
  );
}
