"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Send, Flag, X } from "lucide-react";

interface FeedbackWidgetProps {
  pageUrl: string;
}

export function FeedbackWidget({ pageUrl }: FeedbackWidgetProps) {
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(helpfulValue: boolean | null, commentText?: string) {
    setIsSubmitting(true);
    try {
      await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          helpful: helpfulValue,
          comment: commentText || null,
          timestamp: new Date().toISOString(),
        }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleThumbClick(isHelpful: boolean) {
    setHelpful(isHelpful);
    if (isHelpful) {
      // Positive feedback submitted immediately
      await handleSubmit(true);
    } else {
      // Negative feedback - show comment box
      setShowComment(true);
    }
  }

  async function handleCommentSubmit() {
    await handleSubmit(helpful, comment);
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">Was this helpful?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleThumbClick(true)}
            disabled={isSubmitting}
            className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
              helpful === true
                ? "bg-green-100 text-green-600"
                : "hover:bg-slate-100 text-slate-400 hover:text-green-600"
            }`}
            aria-label="Yes, helpful"
          >
            <ThumbsUp size={18} />
          </button>
          <button
            onClick={() => handleThumbClick(false)}
            disabled={isSubmitting}
            className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
              helpful === false
                ? "bg-red-100 text-red-600"
                : "hover:bg-slate-100 text-slate-400 hover:text-red-600"
            }`}
            aria-label="No, not helpful"
          >
            <ThumbsDown size={18} />
          </button>
        </div>
      </div>

      {showComment && !submitted && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more (optional)"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCommentSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-1 text-sm"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      )}
    </div>
  );
}

interface ReportIssueButtonProps {
  pageUrl: string;
}

export function ReportIssueButton({ pageUrl }: ReportIssueButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          helpful: null,
          comment,
          timestamp: new Date().toISOString(),
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setComment("");
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
      >
        <Flag size={12} />
        Report an issue
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Report an Issue</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-4">
                <p className="text-green-600 font-medium">Thanks for reporting!</p>
                <p className="text-sm text-slate-500 mt-1">We&apos;ll look into this.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  Help us improve MirrorSource. Describe the issue you encountered.
                </p>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What went wrong?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
                />

                <p className="text-xs text-slate-400 mb-4">
                  We&apos;ll include: Page URL, Timestamp, Build version. No personal data.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2 px-4 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !comment.trim()}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? "Sending..." : "Send Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default FeedbackWidget;
