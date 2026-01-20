"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Check, X as XIcon, Link2, ChevronDown, MessageSquare, AlertCircle } from "lucide-react";
import { track } from "@vercel/analytics";
import { getIntensityWord } from "@/lib/briefHash";
import {
  generateShareTemplates,
  generateThreadFormat,
  type ShareTemplate,
  type BriefDataForShare,
} from "@/lib/shareTemplates";

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
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("receipts");
  const [templates, setTemplates] = useState<ShareTemplate[]>([]);
  const [threadTweets, setThreadTweets] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close modal on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowModal(false);
      }
    }
    if (showModal) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [showModal]);

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

  // Open the format selection modal
  async function handleOpenModal() {
    setIsOpen(false);
    setShowModal(true);
    setError(null);

    // Create share URL first
    const url = await createShareableBrief();
    if (!url) {
      setShowModal(false);
      return;
    }

    // Generate templates with the share URL
    const briefDataForShare: BriefDataForShare = {
      topic: briefData.topic,
      summary: briefData.summary,
      commonGround: briefData.commonGround as BriefDataForShare["commonGround"],
      keyDifferences: briefData.keyDifferences as BriefDataForShare["keyDifferences"],
      sources: briefData.sources,
      emotionalIntensity: briefData.emotionalIntensity,
    };

    const generatedTemplates = generateShareTemplates(briefDataForShare, url);
    setTemplates(generatedTemplates);

    const thread = generateThreadFormat(briefDataForShare, url);
    setThreadTweets(thread);

    // Select first valid template by default
    const firstValid = generatedTemplates.find((t) => t.isValid);
    if (firstValid) {
      setSelectedTemplate(firstValid.id);
    }
  }

  // Share selected template to X/Twitter
  function handleShareSelectedToX() {
    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template) return;

    // Track event with format selection
    track("share_to_x", {
      format: selectedTemplate,
      charCount: template.charCount,
      emotionalIntensity: briefData.emotionalIntensity || 5,
      sourceCount: briefData.sources?.length || 0,
    });

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(template.text)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
    setShowModal(false);
  }

  // Legacy share to X (simple format)
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
      format: "legacy",
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
    } catch {
      setError("Failed to copy link");
    }
  }

  // Get character count color
  function getCharCountColor(count: number): string {
    if (count <= 250) return "text-green-600";
    if (count <= 275) return "text-yellow-600";
    return "text-red-600";
  }

  return (
    <>
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
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
            {error && (
              <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
                {error}
              </div>
            )}

            {/* Share to X with format options (new) */}
            <button
              onClick={handleOpenModal}
              disabled={isCreating}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <XIcon size={16} className="text-slate-600" />
              <div className="flex flex-col items-start">
                <span>{isCreating ? "Creating link..." : "Share to X"}</span>
                <span className="text-xs text-slate-400">Choose format</span>
              </div>
            </button>

            {/* Quick share (legacy format) */}
            <button
              onClick={handleShareToX}
              disabled={isCreating}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 border-t border-slate-100"
            >
              <MessageSquare size={16} className="text-slate-400" />
              <span className="text-xs">Quick share (simple)</span>
            </button>

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              disabled={isCreating}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 border-t border-slate-100"
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

      {/* Format Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Choose Share Format</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XIcon size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Template Options */}
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
              {isCreating ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                  Creating share link...
                </div>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedTemplate === template.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    {/* Template header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{template.name}</span>
                        {!template.isValid && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            <AlertCircle size={12} />
                            Too long
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-mono ${getCharCountColor(template.charCount)}`}>
                        {template.charCount}/280
                      </span>
                    </div>

                    {/* Template description */}
                    <p className="text-xs text-slate-500 mb-2">{template.description}</p>

                    {/* Template preview */}
                    <div className="text-xs text-slate-600 bg-slate-50 rounded p-2 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">
                      {template.text}
                    </div>
                  </button>
                ))
              )}

              {/* Thread option */}
              {threadTweets.length > 0 && !isCreating && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">
                    Or create a thread ({threadTweets.length} tweets)
                  </p>
                  <button
                    onClick={() => {
                      // Copy thread to clipboard
                      const threadText = threadTweets
                        .map((t, i) => `${i + 1}/${threadTweets.length}\n${t}`)
                        .join("\n\n---\n\n");
                      navigator.clipboard.writeText(threadText);
                      track("copy_thread", {
                        tweetCount: threadTweets.length,
                        emotionalIntensity: briefData.emotionalIntensity || 5,
                      });
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="w-full text-left p-3 rounded-lg border-2 border-slate-200 hover:border-slate-300 bg-white transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-800">🧵 Thread Format</span>
                      <span className="text-xs text-slate-400">{threadTweets.length} tweets</span>
                    </div>
                    <p className="text-xs text-slate-500">Copy full thread to clipboard for manual posting</p>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareSelectedToX}
                disabled={!templates.find((t) => t.id === selectedTemplate)?.isValid}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <XIcon size={16} />
                Share to X
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast for copied feedback */}
      {copied && showModal && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          <div className="flex items-center gap-2">
            <Check size={16} />
            Thread copied to clipboard!
          </div>
        </div>
      )}
    </>
  );
}
