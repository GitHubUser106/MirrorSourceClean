"use client";

import { Search, ArrowRight, RotateCw } from "lucide-react";

interface UrlInputFormProps {
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  buttonLabel?: string;
  // 👇 NEW: Controlled inputs (Parent controls the text)
  value: string;
  onChange: (val: string) => void;
}

export default function UrlInputForm({ 
  onSubmit, 
  isLoading, 
  buttonLabel = "Find sources",
  value,
  onChange
}: UrlInputFormProps) {

  return (
    <form onSubmit={onSubmit} className="relative w-full group">
      <div className="relative flex items-center">
        <div className="absolute left-4 text-slate-400">
          <Search size={20} />
        </div>
        
        <input
          type="url"
          placeholder="Paste a news article URL..."
          className="w-full pl-12 pr-36 py-4 rounded-full border border-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-slate-700 placeholder:text-slate-400 text-base md:text-lg"
          // 👇 Binds to the parent's state
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-full font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            "Searching..." // 👈 UPDATED: User preference
          ) : (
            <>
              {/* Icon Logic */}
              {buttonLabel.includes("Regenerate") || buttonLabel.includes("Try") ? (
                <RotateCw size={18} />
              ) : null}
              
              {/* Label */}
              <span className="hidden sm:inline">{buttonLabel}</span>
              
              {/* Arrow Logic */}
              {!buttonLabel.includes("Regenerate") && !buttonLabel.includes("Try") && (
                <span className="sm:hidden"><ArrowRight size={20} /></span>
              )}
            </>
          )}
        </button>
      </div>
    </form>
  );
}