// =============================================================================
// src/lib/briefHash.ts
// Hash generation utility for shareable Intel Briefs
// =============================================================================

/**
 * Generate a URL-safe hash for brief sharing
 * Returns an 8-character alphanumeric string
 * Uses Web Crypto API for edge runtime compatibility
 */
export function generateBriefHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(8);

  // Use crypto.getRandomValues if available (works in edge runtime)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for server-side Node.js
    for (let i = 0; i < 8; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Visual word mapping for emotional intensity scores
 */
export function getIntensityWord(score: number): string {
  if (score <= 3) return 'Measured';
  if (score <= 6) return 'Moderate';
  if (score <= 8) return 'Heated';
  return 'Inflammatory';
}
