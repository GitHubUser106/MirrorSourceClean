'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Mail, Sparkles, Check, AlertCircle } from 'lucide-react';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  /** Number of free lookups per day before gate appears */
  FREE_LOOKUPS_PER_DAY: 5,

  /** localStorage key for tracking usage */
  STORAGE_KEY: 'ms_usage',

  /** localStorage key for email (if user is "logged in") */
  EMAIL_KEY: 'ms_user_email',

  /** Cookie consent key */
  CONSENT_KEY: 'ms_email_consent',
};

// =============================================================================
// TYPES
// =============================================================================

interface UsageData {
  count: number;
  date: string; // ISO date string (YYYY-MM-DD)
}

interface EmailSubmission {
  email: string;
  marketingOptIn: boolean;
  timestamp: string;
  source: 'email_gate';
}

interface EmailGateProps {
  /** Whether the gate modal is currently open */
  isOpen: boolean;

  /** Callback when user closes the modal (without signing up) */
  onClose: () => void;

  /** Callback when user successfully submits email */
  onSuccess: (email: string) => void;

  /** Optional: Custom Supabase client for direct integration */
  supabaseClient?: any;

  /** Optional: API endpoint for email submission (if not using Supabase directly) */
  apiEndpoint?: string;
}

// =============================================================================
// USAGE TRACKING UTILITIES
// =============================================================================

const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const getUsageData = (): UsageData => {
  if (typeof window === 'undefined') {
    return { count: 0, date: getTodayString() };
  }

  try {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!stored) {
      return { count: 0, date: getTodayString() };
    }

    const data: UsageData = JSON.parse(stored);

    // Reset if it's a new day
    if (data.date !== getTodayString()) {
      return { count: 0, date: getTodayString() };
    }

    return data;
  } catch {
    return { count: 0, date: getTodayString() };
  }
};

export const incrementUsage = (): UsageData => {
  const current = getUsageData();
  const updated: UsageData = {
    count: current.count + 1,
    date: getTodayString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(updated));
  }

  return updated;
};

export const shouldShowGate = (): boolean => {
  // Check if user already has email stored (they're "logged in")
  if (typeof window !== 'undefined') {
    const storedEmail = localStorage.getItem(CONFIG.EMAIL_KEY);
    if (storedEmail) {
      return false; // User already signed up
    }
  }

  const usage = getUsageData();
  return usage.count >= CONFIG.FREE_LOOKUPS_PER_DAY;
};

export const getRemainingLookups = (): number => {
  const usage = getUsageData();
  return Math.max(0, CONFIG.FREE_LOOKUPS_PER_DAY - usage.count);
};

export const storeUserEmail = (email: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CONFIG.EMAIL_KEY, email);
  }
};

export const getUserEmail = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONFIG.EMAIL_KEY);
};

export const clearUserEmail = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CONFIG.EMAIL_KEY);
  }
};

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const EmailGate: React.FC<EmailGateProps> = ({
  isOpen,
  onClose,
  onSuccess,
  supabaseClient,
  apiEndpoint = '/api/subscribe',
}) => {
  const [email, setEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setMarketingOptIn(false);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    const submission: EmailSubmission = {
      email: email.trim().toLowerCase(),
      marketingOptIn,
      timestamp: new Date().toISOString(),
      source: 'email_gate',
    };

    try {
      // Option 1: Direct Supabase integration
      if (supabaseClient) {
        const { error: dbError } = await supabaseClient
          .from('subscribers')
          .upsert({
            email: submission.email,
            marketing_opt_in: submission.marketingOptIn,
            created_at: submission.timestamp,
            source: submission.source,
          }, {
            onConflict: 'email',
          });

        if (dbError) throw dbError;
      }
      // Option 2: API endpoint
      else {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to subscribe. Please try again.');
        }
      }

      // Store email locally
      storeUserEmail(submission.email);

      // Store consent preference
      if (typeof window !== 'undefined') {
        localStorage.setItem(CONFIG.CONSENT_KEY, JSON.stringify({
          marketingOptIn: submission.marketingOptIn,
          timestamp: submission.timestamp,
        }));
      }

      // Track success (for analytics)
      if (typeof window !== 'undefined' && (window as any).plausible) {
        (window as any).plausible('email_signup', {
          props: { marketing_opt_in: submission.marketingOptIn },
        });
      }

      setSuccess(true);

      // Delay callback to show success state
      setTimeout(() => {
        onSuccess(submission.email);
      }, 1500);

    } catch (err) {
      console.error('Email submission error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, marketingOptIn, supabaseClient, apiEndpoint, onSuccess]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-gate-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-8">
          {success ? (
            // Success State
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                You&apos;re in!
              </h2>
              <p className="text-gray-600">
                Unlimited Intel Briefs unlocked.
              </p>
            </div>
          ) : (
            // Form State
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-blue-600" />
                </div>
                <h2
                  id="email-gate-title"
                  className="text-xl font-bold text-gray-900 mb-2"
                >
                  Get Unlimited Access
                </h2>
                <p className="text-gray-600 text-sm">
                  You&apos;ve used your {CONFIG.FREE_LOOKUPS_PER_DAY} free Intel Briefs today.
                  <br />
                  Enter your email to continue—no payment required.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      className={`
                        w-full pl-10 pr-4 py-3 rounded-lg border
                        bg-white
                        text-gray-900
                        placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        transition-colors
                        ${error ? 'border-red-500' : 'border-gray-300'}
                      `}
                    />
                  </div>
                </div>

                {/* Marketing Opt-in */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    Send me occasional product updates and tips (optional)
                  </span>
                </label>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`
                    w-full py-3 px-4 rounded-lg font-medium
                    text-white bg-blue-600 hover:bg-blue-700
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                  `}
                >
                  {isSubmitting ? 'Unlocking...' : 'Continue →'}
                </button>

                {/* Privacy Notice */}
                <p className="text-xs text-center text-gray-500">
                  By continuing, you agree to our{' '}
                  <a
                    href="/legal"
                    target="_blank"
                    className="underline hover:text-gray-700"
                  >
                    Privacy Policy
                  </a>
                  . We&apos;ll only email you about your account unless you opt in above.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// HOOK FOR EASY INTEGRATION
// =============================================================================

interface UseEmailGateReturn {
  /** Whether the gate should be shown */
  shouldShowGate: boolean;

  /** Current remaining free lookups */
  remainingLookups: number;

  /** Whether user has email stored (is "logged in") */
  isSubscribed: boolean;

  /** Stored user email (if any) */
  userEmail: string | null;

  /** Call this after each lookup to increment usage */
  recordLookup: () => void;

  /** Call this when user successfully submits email */
  handleEmailSuccess: (email: string) => void;

  /** Call this to clear user data (logout) */
  clearUser: () => void;
}

export const useEmailGate = (): UseEmailGateReturn => {
  const [state, setState] = useState({
    shouldShowGate: false,
    remainingLookups: CONFIG.FREE_LOOKUPS_PER_DAY,
    isSubscribed: false,
    userEmail: null as string | null,
  });

  // Initialize state on mount
  useEffect(() => {
    const email = getUserEmail();
    const usage = getUsageData();

    setState({
      shouldShowGate: shouldShowGate(),
      remainingLookups: getRemainingLookups(),
      isSubscribed: !!email,
      userEmail: email,
    });
  }, []);

  const recordLookup = useCallback(() => {
    const updated = incrementUsage();
    setState(prev => ({
      ...prev,
      shouldShowGate: !prev.isSubscribed && updated.count >= CONFIG.FREE_LOOKUPS_PER_DAY,
      remainingLookups: Math.max(0, CONFIG.FREE_LOOKUPS_PER_DAY - updated.count),
    }));
  }, []);

  const handleEmailSuccess = useCallback((email: string) => {
    storeUserEmail(email);
    setState(prev => ({
      ...prev,
      shouldShowGate: false,
      isSubscribed: true,
      userEmail: email,
    }));
  }, []);

  const clearUser = useCallback(() => {
    clearUserEmail();
    setState(prev => ({
      ...prev,
      isSubscribed: false,
      userEmail: null,
    }));
  }, []);

  return {
    ...state,
    recordLookup,
    handleEmailSuccess,
    clearUser,
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

export default EmailGate;
export { CONFIG as EMAIL_GATE_CONFIG };
