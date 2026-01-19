"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Check, X as XIcon, Link2, ChevronDown } from "lucide-react";
import { track } from "@vercel/analytics";
import { getIntensityWord } from "@/lib/briefHash";

interface BriefData {
  originalUrl: string;
  topic: string;
  summary?: string | null;
  commonGround?: unknown;
  keyDifferences?: unknown;
  provenance?: unknown;
  narrative?: unknown;
  sources?: Array<{ displayName: string; uri: string; politicalLean?: string }>;
  emotionalIntensity?: number;
  narrativeType?: string;
}

interface ShareBriefButtonProps {
  briefData: BriefData;
}

export function ShareBriefButton({ briefData }: ShareBriefButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Create shareable brief (lazy - only when user clicks share)
  async function createShareableBrief(): Promise<string | null> {
    if (shareUrl) return shareUrl; // Already created

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl: briefData.originalUrl,
          topic: briefData.topic,
          summary: briefData.summary,
          commonGround: briefData.commonGround,
          keyDifferences: briefData.keyDifferences,
          provenance: briefData.provenance,
          narrative: briefData.narrative,
          sources: briefData.sources,
          emotionalIntensity: briefData.emotionalIntensity,
          narrativeType: briefData.narrativeType,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to create shareable brief");
      }

      setShareUrl(data.shareUrl);
      return data.shareUrl;
    } catch (err) {
      setError("Failed to create share link. Please try again.");
      console.error("Share brief error:", err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }

  // Share to X/Twitter
  async function handleShareToX() {
    const url = await createShareableBrief();
    if (!url) return;

    const sourceCount = briefData.sources?.length || 0;
    const intensity = briefData.emotionalIntensity || 5;
    const intensityWord = getIntensityWord(intensity);

    // Build tweet text
    const tweetLines = [
      `Compared ${sourceCount} sources on "${briefData.topic}"`,
      "",
      `Emotional intensity: ${intensity}/10 ${intensityWord}`,
      "",
      `Full breakdown: ${url}`,
      "",
      "@UseMirrorSource – testing a news comparison tool",
    ];

    const tweetText = tweetLines.join("\n");
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    // Track event
    track("share_to_x", {
      emotionalIntensity: intensity,
      sourceCount,
    });

    window.open(twitterUrl, "_blank", "width=550,height=420");
    setIsOpen(false);
  }

  // Copy link to clipboard
  async function handleCopyLink() {
    const url = await createShareableBrief();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Track event
      track("copy_share_link", {
        emotionalIntensity: briefData.emotionalIntensity || 5,
      });
    } catch (err) {
      setError("Failed to copy link");
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Share button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-slate-100"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Share2 size={16} />
        <span className="hidden sm:inline">Share</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          {error && (
            <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}

          {/* Share to X */}
          <button
            onClick={handleShareToX}
            disabled={isCreating}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <XIcon size={16} className="text-slate-600" />
            <span>{isCreating ? "Creating link..." : "Share to X"}</span>
          </button>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            disabled={isCreating}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check size={16} className="text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Link2 size={16} className="text-slate-600" />
                <span>{isCreating ? "Creating link..." : "Copy link"}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
