"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 antialiased">
        <div className="max-w-md text-center">
          {/* Error icon */}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>

          {/* Error message */}
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Something went wrong
          </h1>
          <p className="text-slate-600 mb-8">
            We ran into an unexpected issue. This has been logged and we&apos;ll look into it.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-full transition-all"
            >
              <RefreshCw size={18} />
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-6 rounded-full border border-slate-200 transition-all"
            >
              <Home size={18} />
              Go to homepage
            </Link>
          </div>

          {/* Error details (for debugging) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="mt-8 p-4 bg-slate-100 rounded-lg text-left">
              <p className="text-xs text-slate-500 font-mono break-all">
                {error.message}
              </p>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
