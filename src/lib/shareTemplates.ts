// =============================================================================
// src/lib/shareTemplates.ts
// Smart share template generation for viral X/Twitter posts
// =============================================================================

export interface ShareSource {
  displayName: string;
  uri: string;
  politicalLean?: string;
}

export interface KeyDifference {
  label: string;
  value: string;
}

export interface CommonGroundItem {
  label: string;
  value: string;
}

export interface BriefDataForShare {
  topic: string;
  summary?: string | null;
  commonGround?: CommonGroundItem[] | string | null;
  keyDifferences?: KeyDifference[] | string | null;
  sources?: ShareSource[];
  emotionalIntensity?: number;
  divergenceLevel?: 'high' | 'low' | 'medium' | null; // From Intel Brief
}

export interface ShareTemplate {
  id: string;
  name: string;
  description: string;
  text: string;
  charCount: number;
  isValid: boolean; // Under 280 chars
}

// Twitter counts URLs as 23 chars
const URL_CHAR_COUNT = 23;
const MAX_CHARS = 280;
const SAFE_BUFFER = 5;
const EFFECTIVE_MAX = MAX_CHARS - SAFE_BUFFER;

// Phrases that indicate MirrorSource analysis (NOT source quotes)
const ANALYSIS_PHRASES = [
  'sources present a consistent',
  'sources largely agree',
  'sources agree on',
  'consistent narrative',
  'no significant differences',
  'similar framing',
  'outlets report similarly',
  'coverage is consistent',
  'sources report the same',
];

/**
 * Check if text is MirrorSource analysis (not a real source quote)
 */
function isMirrorSourceAnalysis(text: string): boolean {
  const lower = text.toLowerCase();
  return ANALYSIS_PHRASES.some(phrase => lower.includes(phrase));
}

/**
 * Detect if this is a HIGH or LOW divergence story
 */
function detectDivergenceLevel(data: BriefDataForShare): 'high' | 'low' {
  // If explicitly provided, use it
  if (data.divergenceLevel === 'high') return 'high';
  if (data.divergenceLevel === 'low') return 'low';

  const keyDiffs = normalizeKeyDifferences(data.keyDifferences);

  // If keyDifferences is empty or contains only analysis text, it's low divergence
  if (keyDiffs.length === 0) return 'low';

  // Check if the "differences" are actually just MirrorSource saying "sources agree"
  const firstDiff = keyDiffs[0]?.value || '';
  if (isMirrorSourceAnalysis(firstDiff)) return 'low';

  // Check if differences contain actual source-specific info (source names, quotes)
  const hasRealDifferences = keyDiffs.some(diff => {
    const text = diff.value.toLowerCase();
    // Real differences usually mention specific sources or contain contrasting info
    return (
      text.includes('while') ||
      text.includes('whereas') ||
      text.includes('however') ||
      text.includes('but ') ||
      /\*\*[^*]+\*\*/.test(diff.value) // Has bold source names
    );
  });

  return hasRealDifferences ? 'high' : 'low';
}

/**
 * Get real key differences (filter out MirrorSource analysis)
 */
function getRealKeyDifferences(data: BriefDataForShare): KeyDifference[] {
  const keyDiffs = normalizeKeyDifferences(data.keyDifferences);
  return keyDiffs.filter(diff => !isMirrorSourceAnalysis(diff.value));
}

/**
 * Extracted framing from a key difference
 */
interface ExtractedFraming {
  sourceName: string;
  framing: string;
  isUnique: boolean; // True if this outlet is the only one with this take
}

/**
 * Strip ALL markdown from text (bold, italic, links)
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')     // Remove *italic*
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove [links](url)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Taglines for share templates - randomly selected
 */
const TAGLINES = [
  'Built for understanding, not outrage.',
  'Same facts. Different frames.',
  'Compare coverage. Think for yourself.',
];

/**
 * Get a random tagline
 */
function getRandomTagline(): string {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

/**
 * Smart truncate that preserves quoted "punchlines"
 * If text has quotes ('term' or "term"), prioritize keeping them
 * Cuts from BEGINNING if needed to preserve the hook
 */
function smartTruncate(text: string, maxLen: number): string {
  const cleaned = stripMarkdown(text);
  if (cleaned.length <= maxLen) return cleaned;

  // Check for quoted phrases (the "punchline")
  const quoteMatch = cleaned.match(/['"][^'"]+['"]/g);

  if (quoteMatch && quoteMatch.length > 0) {
    // Find the last quoted phrase (usually the punchline)
    const lastQuote = quoteMatch[quoteMatch.length - 1];
    const quotePos = cleaned.lastIndexOf(lastQuote);

    // If quote is near the end and would be cut, truncate from beginning instead
    if (quotePos > maxLen - lastQuote.length - 5) {
      // Cut from beginning to preserve the quote
      const endPortion = cleaned.substring(cleaned.length - maxLen + 3);
      // Find word boundary at start
      const firstSpace = endPortion.indexOf(' ');
      if (firstSpace > 0 && firstSpace < 15) {
        return '...' + endPortion.substring(firstSpace + 1);
      }
      return '...' + endPortion;
    }
  }

  // Default: truncate from end at word boundary
  const truncated = cleaned.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLen * 0.5) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Truncate text at word boundary (never mid-word) - legacy wrapper
 */
function truncateAtWord(text: string, maxLen: number): string {
  return smartTruncate(text, maxLen);
}

/**
 * Extract source names from **bold** text in a string
 */
function extractSourceNames(text: string): string[] {
  const matches = text.match(/\*\*([^*]+)\*\*/g) || [];
  return matches.map(m => m.replace(/\*\*/g, '').trim());
}

/**
 * Extract the actual claim/framing from key_differences text
 * Input: "**Bloomberg** and **ainvest.com** emphasize trade tensions as a key driver"
 * Output: { sources: ["Bloomberg", "ainvest.com"], claim: "trade tensions as key driver" }
 */
function parseKeyDifference(text: string): { sources: string[]; claim: string } | null {
  // Extract all source names first
  const sources = extractSourceNames(text);

  // Strip markdown and normalize
  const cleaned = stripMarkdown(text);

  if (sources.length === 0) {
    // No bold sources - try "Label: content" format
    const colonMatch = cleaned.match(/^([A-Za-z\s]+):\s*(.+)/);
    if (colonMatch) {
      return {
        sources: [colonMatch[1].trim()],
        claim: colonMatch[2].trim(),
      };
    }
    return null;
  }

  // Find where the actual claim starts (after all source mentions)
  // Look for common claim verbs
  const claimVerbs = /\b(emphasize|emphasizes|mention|mentions|highlight|highlights|focus|focuses|report|reports|say|says|claim|claims|argue|argues|note|notes|suggest|suggests|frame|frames|describe|describes|call|calls|liken|likens|compare|compares|portray|portrays|present|presents|characterize|characterizes|state|states)\b/i;

  const verbMatch = cleaned.match(claimVerbs);
  if (verbMatch && verbMatch.index !== undefined) {
    // Get everything from the verb onwards
    let claim = cleaned.substring(verbMatch.index);

    // Clean up: remove "that" after verbs, normalize
    claim = claim
      .replace(/^(emphasize|mention|highlight|focus on|report|say|claim|argue|note|suggest|frame|describe|call|liken|compare|portray|present|characterize|state)s?\s+(that\s+)?/i, '')
      .trim();

    // Remove trailing meta-commentary
    claim = claim
      .replace(/,\s*(a comparison|unlike|which|this|while).*/i, '')
      .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheticals
      .trim();

    if (claim.length > 5) {
      return { sources, claim };
    }
  }

  // Fallback: take everything after the last source name mention
  // Find position after all source names in cleaned text
  let lastSourceEnd = 0;
  for (const source of sources) {
    const pos = cleaned.toLowerCase().indexOf(source.toLowerCase());
    if (pos !== -1) {
      lastSourceEnd = Math.max(lastSourceEnd, pos + source.length);
    }
  }

  if (lastSourceEnd > 0 && lastSourceEnd < cleaned.length - 10) {
    let claim = cleaned.substring(lastSourceEnd).trim();
    // Remove leading "and", "or", connectors
    claim = claim.replace(/^(and|or|,|\s)+/i, '').trim();
    if (claim.length > 5) {
      return { sources, claim };
    }
  }

  return null;
}

/**
 * Extract source-specific framings from key_differences array
 */
function extractFramings(realDiffs: KeyDifference[]): ExtractedFraming[] {
  const framings: ExtractedFraming[] = [];

  for (const diff of realDiffs) {
    const text = diff.value;
    const parsed = parseKeyDifference(text);

    if (parsed && parsed.claim) {
      // Check if this is a unique take
      const isUnique = /only|not made by other|unlike other|a comparison not|the only|uniquely|alone/i.test(text);

      // Use first source as the attribution
      const sourceName = parsed.sources[0] || diff.label.replace(':', '').trim();

      framings.push({
        sourceName,
        framing: parsed.claim,
        isUnique,
      });
    }
  }

  return framings;
}

/**
 * Get the most shareable framing (unique takes are more viral)
 */
function getBestFramingForShare(framings: ExtractedFraming[]): ExtractedFraming | null {
  // Prioritize unique takes (more viral)
  const unique = framings.find(f => f.isUnique);
  if (unique) return unique;

  // Otherwise return the first one with a reasonable claim
  return framings.find(f => f.framing.length > 10) || framings[0] || null;
}

/**
 * Generate all share template variants
 */
export function generateShareTemplates(
  data: BriefDataForShare,
  shareUrl: string
): ShareTemplate[] {
  const divergence = detectDivergenceLevel(data);
  const sourceCount = data.sources?.length || 0;
  const topicShort = truncateTopic(data.topic, 60);

  const templates: ShareTemplate[] = [];

  if (divergence === 'high') {
    // HIGH DIVERGENCE: Use contrast-based templates
    const realDiffs = getRealKeyDifferences(data);

    // Format A: "The Receipts" (Contrast Hook)
    const receiptsText = generateReceiptsFormat(data, realDiffs, topicShort, sourceCount, shareUrl);
    templates.push({
      id: 'receipts',
      name: 'The Receipts',
      description: 'Contrast two sources directly',
      text: receiptsText,
      charCount: calculateCharCount(receiptsText),
      isValid: calculateCharCount(receiptsText) <= EFFECTIVE_MAX,
    });

    // Format B: "The Question" (Engagement Bait)
    const questionText = generateQuestionFormat(data, realDiffs, topicShort, sourceCount, shareUrl);
    templates.push({
      id: 'question',
      name: 'The Question',
      description: 'Ask a provocative question',
      text: questionText,
      charCount: calculateCharCount(questionText),
      isValid: calculateCharCount(questionText) <= EFFECTIVE_MAX,
    });

    // Format C: "The Discovery" (Personal Observation)
    const discoveryText = generateDiscoveryFormat(data, realDiffs, topicShort, sourceCount, shareUrl);
    templates.push({
      id: 'discovery',
      name: 'The Discovery',
      description: 'Share your finding',
      text: discoveryText,
      charCount: calculateCharCount(discoveryText),
      isValid: calculateCharCount(discoveryText) <= EFFECTIVE_MAX,
    });
  } else {
    // LOW DIVERGENCE / CONSENSUS: Use agreement-based templates
    const commonGround = normalizeCommonGround(data.commonGround);

    // Format A: "The Consensus" (Rare Agreement)
    const consensusText = generateConsensusFormat(data, commonGround, topicShort, sourceCount, shareUrl);
    templates.push({
      id: 'consensus',
      name: 'The Consensus',
      description: 'Highlight rare agreement',
      text: consensusText,
      charCount: calculateCharCount(consensusText),
      isValid: calculateCharCount(consensusText) <= EFFECTIVE_MAX,
    });

    // Format B: "The Fact Check" (Nobody's Disputing)
    const factCheckText = generateFactCheckFormat(data, topicShort, sourceCount, shareUrl);
    templates.push({
      id: 'factcheck',
      name: 'The Fact Check',
      description: 'Facts nobody disputes',
      text: factCheckText,
      charCount: calculateCharCount(factCheckText),
      isValid: calculateCharCount(factCheckText) <= EFFECTIVE_MAX,
    });

    // Format C: "The Spectrum" (Full Coverage)
    const spectrumText = generateSpectrumFormat(data, topicShort, sourceCount, shareUrl);
    templates.push({
      id: 'spectrum',
      name: 'The Spectrum',
      description: 'Show political spread',
      text: spectrumText,
      charCount: calculateCharCount(spectrumText),
      isValid: calculateCharCount(spectrumText) <= EFFECTIVE_MAX,
    });
  }

  return templates;
}

// =============================================================================
// HIGH DIVERGENCE Templates
// =============================================================================

/**
 * Format: "The Receipts" - Direct source contrast with ACTUAL quotes (HIGH DIVERGENCE ONLY)
 */
function generateReceiptsFormat(
  data: BriefDataForShare,
  realDiffs: KeyDifference[],
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const framings = extractFramings(realDiffs);
  const bestFraming = getBestFramingForShare(framings);

  if (bestFraming && bestFraming.isUnique) {
    // Unique take format: "Source: '[framing]' / Other sources: No such comparison"
    const framingQuote = truncateText(bestFraming.framing, 50);
    return `${bestFraming.sourceName}: "${framingQuote}"

Other sources: No such comparison

${sourceCount} sources. One outlet went there.

${shareUrl}

Overreach or accurate parallel?`;
  }

  if (framings.length >= 2) {
    // Contrast format: Show two different framings
    const f1 = framings[0];
    const f2 = framings[1];
    return `${f1.sourceName}: "${truncateText(f1.framing, 35)}"

${f2.sourceName}: "${truncateText(f2.framing, 35)}"

Same event. ${sourceCount} sources.

${shareUrl}

${getRandomTagline()}
@UseMirrorSource`;
  }

  if (framings.length === 1) {
    // Single notable framing
    const f = framings[0];
    return `${f.sourceName} frames it as: "${truncateText(f.framing, 50)}"

${sourceCount} sources compared — not all see it that way.

${shareUrl}

What did YOUR feed show?`;
  }

  // Fallback: Generic but with actual label
  const sources = data.sources || [];
  const leftSource = sources.find(s =>
    s.politicalLean === 'left' || s.politicalLean === 'center-left'
  );
  const rightSource = sources.find(s =>
    s.politicalLean === 'right' || s.politicalLean === 'center-right'
  );
  const source1 = leftSource?.displayName || sources[0]?.displayName || 'Left outlet';
  const source2 = rightSource?.displayName || sources[1]?.displayName || 'Right outlet';

  return `${source1} vs ${source2}

Same story. Different framing.

${sourceCount} sources compared:
${shareUrl}

What did YOUR feed show you?`;
}

/**
 * Format: "The Question" - Engagement bait with specific framings (HIGH DIVERGENCE)
 */
function generateQuestionFormat(
  data: BriefDataForShare,
  realDiffs: KeyDifference[],
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const framings = extractFramings(realDiffs);

  if (framings.length >= 2) {
    // Show actual contrasting takes
    const bullets = framings.slice(0, 3).map(f =>
      `• ${f.sourceName}: "${truncateText(f.framing, 30)}"`
    ).join('\n');

    return `"${truncateText(topicShort, 40)}"

${bullets}

${sourceCount} sources. Which version did you see?

${shareUrl}`;
  }

  // Fallback: List source names
  const sources = data.sources || [];
  const sourceNames = sources.slice(0, 3).map(s => s.displayName);
  const bulletPoints = sourceNames.map(name => `• ${name}`).join('\n');

  return `"${topicShort}"

Different outlets, different takes:
${bulletPoints}

${sourceCount} sources compared:
${shareUrl}

Which version did YOUR feed show?`;
}

/**
 * Format: "The Discovery" - Personal observation with actual finding (HIGH DIVERGENCE)
 */
function generateDiscoveryFormat(
  data: BriefDataForShare,
  realDiffs: KeyDifference[],
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const framings = extractFramings(realDiffs);
  const bestFraming = getBestFramingForShare(framings);

  if (bestFraming) {
    const finding = bestFraming.isUnique
      ? `${bestFraming.sourceName} went there alone: "${truncateText(bestFraming.framing, 40)}"`
      : `${bestFraming.sourceName}: "${truncateText(bestFraming.framing, 45)}"`;

    return `Compared ${sourceCount} sources on "${truncateText(topicShort, 35)}"

${finding}

Same facts. Different stories.

${shareUrl}

${getRandomTagline()}
@UseMirrorSource`;
  }

  // Fallback
  return `${sourceCount} sources on "${topicShort}"

The framing varies significantly.

Same facts. Different stories.

${shareUrl}

${getRandomTagline()}
@UseMirrorSource`;
}

// =============================================================================
// LOW DIVERGENCE / CONSENSUS Templates
// =============================================================================

/**
 * Format: "The Consensus" - Highlight rare agreement (LOW DIVERGENCE)
 */
function generateConsensusFormat(
  data: BriefDataForShare,
  commonGround: CommonGroundItem[],
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const sources = data.sources || [];
  const spread = getSourceSpread(sources);

  // Get the key finding they agree on
  let keyFinding = topicShort;
  if (commonGround.length > 0) {
    keyFinding = truncateText(commonGround[0].value, 80);
  } else if (data.summary) {
    // Use first sentence of summary
    const firstSentence = data.summary.split(/[.!?]/)[0];
    keyFinding = truncateText(firstSentence, 80);
  }

  return `${sourceCount} sources. ${spread}.

All reporting the same thing:
"${keyFinding}"

${shareUrl}

Rare consensus or coordinated narrative? You decide.`;
}

/**
 * Format: "The Fact Check" - Facts nobody disputes (LOW DIVERGENCE)
 */
function generateFactCheckFormat(
  data: BriefDataForShare,
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  return `${topicShort}

${sourceCount} sources checked. Nobody's disputing the facts.

Full breakdown:
${shareUrl}

${getRandomTagline()}
@UseMirrorSource`;
}

/**
 * Format: "The Spectrum" - Show political coverage spread (LOW DIVERGENCE)
 */
function generateSpectrumFormat(
  data: BriefDataForShare,
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const sources = data.sources || [];

  // Count by political lean
  const leftCount = sources.filter(s =>
    s.politicalLean === 'left' || s.politicalLean === 'center-left'
  ).length;
  const centerCount = sources.filter(s =>
    s.politicalLean === 'center'
  ).length;
  const rightCount = sources.filter(s =>
    s.politicalLean === 'right' || s.politicalLean === 'center-right'
  ).length;

  const spread = [];
  if (leftCount > 0) spread.push(`${leftCount} left`);
  if (centerCount > 0) spread.push(`${centerCount} center`);
  if (rightCount > 0) spread.push(`${rightCount} right`);

  const spreadText = spread.join(', ') || 'across the spectrum';

  return `"${topicShort}"

${sourceCount} sources (${spreadText}) — all agree on the core facts.

See the full breakdown:
${shareUrl}

${getRandomTagline()}
@UseMirrorSource`;
}

/**
 * Generate thread format (multiple tweets)
 */
export function generateThreadFormat(
  data: BriefDataForShare,
  shareUrl: string
): string[] {
  const sourceCount = data.sources?.length || 0;
  const topicShort = truncateTopic(data.topic, 50);
  const divergence = detectDivergenceLevel(data);
  const commonGround = normalizeCommonGround(data.commonGround);

  const tweets: string[] = [];

  if (divergence === 'high') {
    const realDiffs = getRealKeyDifferences(data);
    const framings = extractFramings(realDiffs);

    // Tweet 1: Hook
    tweets.push(`I compared how ${sourceCount} outlets covered "${topicShort}"

The differences are revealing. Here's what I found:`);

    // Tweet 2: Key differences with ACTUAL framings
    if (framings.length > 0) {
      const diffText = framings.slice(0, 3).map(f =>
        `• ${f.sourceName}: "${truncateText(f.framing, 50)}"`
      ).join('\n');
      tweets.push(`Where they diverge:

${diffText}`);
    } else if (realDiffs.length > 0) {
      // Fallback to raw differences (truncateText strips markdown)
      const diffText = realDiffs.slice(0, 2).map(d =>
        `• ${d.label}: ${truncateText(d.value, 60)}`
      ).join('\n');
      tweets.push(`Where they diverge:

${diffText}`);
    }

    // Tweet 3: Common ground (if any)
    if (commonGround.length > 0) {
      const agreeText = commonGround.slice(0, 2).map(c =>
        `• ${truncateText(c.value, 70)}`
      ).join('\n');
      tweets.push(`What they all agree on:

${agreeText}`);
    }
  } else {
    // Consensus thread
    tweets.push(`I compared how ${sourceCount} outlets covered "${topicShort}"

Surprising finding: They all agree.`);

    if (commonGround.length > 0) {
      const agreeText = commonGround.slice(0, 3).map(c =>
        `• ${truncateText(c.value, 70)}`
      ).join('\n');
      tweets.push(`The consensus:

${agreeText}`);
    }

    tweets.push(`Left, right, center — all reporting the same core facts.

Rare agreement or coordinated narrative?`);
  }

  // Final tweet: CTA
  tweets.push(`Full breakdown with all ${sourceCount} sources:
${shareUrl}

${getRandomTagline()}
@UseMirrorSource`);

  return tweets;
}

// =============================================================================
// Helper functions
// =============================================================================

function normalizeKeyDifferences(kd: unknown): KeyDifference[] {
  if (!kd) return [];
  if (typeof kd === 'string') return [{ label: 'Difference', value: kd }];
  if (Array.isArray(kd)) {
    return kd.map(item => {
      if (typeof item === 'string') return { label: 'Difference', value: item };
      return { label: item.label || 'Difference', value: item.value || String(item) };
    });
  }
  return [];
}

function normalizeCommonGround(cg: unknown): CommonGroundItem[] {
  if (!cg) return [];
  if (typeof cg === 'string') return [{ label: 'Agreement', value: cg }];
  if (Array.isArray(cg)) {
    return cg.map(item => {
      if (typeof item === 'string') return { label: 'Agreement', value: item };
      return { label: item.label || 'Agreement', value: item.value || String(item) };
    });
  }
  return [];
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1')     // Remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .trim();
}

function truncateTopic(topic: string, maxLen: number): string {
  const cleaned = stripMarkdown(topic);
  if (cleaned.length <= maxLen) return cleaned;

  // Find last space before maxLen for word boundary
  const truncated = cleaned.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLen * 0.6) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated.substring(0, maxLen - 3) + '...';
}

function truncateText(text: string, maxLen: number): string {
  // Use smart truncation that preserves quoted punchlines
  return smartTruncate(text, maxLen);
}

function getSourceSpread(sources: ShareSource[]): string {
  const hasLeft = sources.some(s =>
    s.politicalLean === 'left' || s.politicalLean === 'center-left'
  );
  const hasCenter = sources.some(s => s.politicalLean === 'center');
  const hasRight = sources.some(s =>
    s.politicalLean === 'right' || s.politicalLean === 'center-right'
  );

  if (hasLeft && hasCenter && hasRight) return 'Left, right, center';
  if (hasLeft && hasRight) return 'Left and right';
  if (hasLeft && hasCenter) return 'Left and center';
  if (hasRight && hasCenter) return 'Right and center';
  return 'Multiple perspectives';
}

function calculateCharCount(text: string): number {
  // URLs count as 23 chars on Twitter
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  let count = text.length;

  // Subtract actual URL lengths, add 23 for each
  for (const url of urls) {
    count = count - url.length + URL_CHAR_COUNT;
  }

  return count;
}

export { calculateCharCount, EFFECTIVE_MAX, MAX_CHARS, detectDivergenceLevel };
