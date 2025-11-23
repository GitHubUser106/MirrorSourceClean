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
    <form onSubmit={onSubmit} className="w-full max-w-2xl mx-auto">
      {/* INPUT CONTAINER */}
      <div className="relative flex items-center">
        <div className="absolute left-4 text-slate-400 pointer-events-none">
          <Search size={20} />
        </div>
        
        <input
          type="url"
          placeholder="Paste the article URL here..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-slate-700 placeholder:text-slate-400 text-base md:text-lg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>

      {/* BUTTON MOVED BELOW */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-full font-medium text-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.99]"
      >
        {isLoading ? (
          "Searching..."
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
    </form>
  );
}