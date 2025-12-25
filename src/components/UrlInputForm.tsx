"use client";

import { Search, ArrowRight, RotateCw } from "lucide-react";

interface UrlInputFormProps {
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  buttonLabel?: string;
  value: string;
  onChange: (val: string) => void;
}

export default function UrlInputForm({
  onSubmit,
  isLoading,
  buttonLabel = "Find Alternatives",
  value,
  onChange
}: UrlInputFormProps) {

  return (
    <form onSubmit={onSubmit} className="w-full max-w-2xl lg:max-w-3xl mx-auto">
      {/* INPUT + BUTTON INLINE */}
      <div className="relative flex items-center gap-3">
        <div className="absolute left-4 lg:left-5 text-slate-400 pointer-events-none">
          <Search size={20} className="md:w-6 md:h-6" />
        </div>

        <input
          type="url"
          placeholder="Paste any news article URL..."
          className="flex-1 pl-12 lg:pl-14 pr-4 py-3 lg:py-4 rounded-lg border border-slate-200 focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20 transition-all outline-none text-slate-700 placeholder:text-slate-400 text-base"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />

        {/* BUTTON - Inline */}
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[color:var(--primary)] hover:opacity-90 text-white py-3 lg:py-4 px-6 lg:px-8 rounded-lg font-medium text-base transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {isLoading ? (
            "Analyzing..."
          ) : (
            <>
              {/* Icon Logic */}
              {buttonLabel.includes("Regenerate") || buttonLabel.includes("Try") ? (
                <RotateCw size={20} />
              ) : null}

              {/* Label */}
              <span>{buttonLabel}</span>

              {/* Arrow Logic */}
              {!buttonLabel.includes("Regenerate") && !buttonLabel.includes("Try") && (
                <ArrowRight size={20} />
              )}
            </>
          )}
        </button>
      </div>
    </form>
  );
}