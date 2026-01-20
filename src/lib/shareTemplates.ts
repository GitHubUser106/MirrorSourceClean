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
 * Extract source-specific framings from key_differences text
 * Parses text like: "**Common Dreams** likens Trump's Greenland designs to Putin's invasion"
 */
function extractFramings(realDiffs: KeyDifference[]): ExtractedFraming[] {
  const framings: ExtractedFraming[] = [];

  for (const diff of realDiffs) {
    const text = diff.value;

    // Pattern 1: "**Source Name** [verb] [description]"
    const boldSourceMatch = text.match(/\*\*([^*]+)\*\*\s+([^.]+)/);
    if (boldSourceMatch) {
      const sourceName = boldSourceMatch[1].trim();
      const framingText = boldSourceMatch[2].trim();

      // Check if this framing is unique (mentions "only", "not made by other", "unlike other")
      const isUnique = /only|not made by other|unlike other|a comparison not|the only|uniquely/i.test(text);

      framings.push({
        sourceName,
        framing: cleanFramingText(framingText),
        isUnique,
      });
    }

    // Pattern 2: "Source Name: [description]" (without bold)
    const colonMatch = text.match(/^([A-Z][a-zA-Z\s]+):\s+(.+)/);
    if (!boldSourceMatch && colonMatch) {
      framings.push({
        sourceName: colonMatch[1].trim(),
        framing: cleanFramingText(colonMatch[2]),
        isUnique: /only|unique|unlike/i.test(text),
      });
    }

    // Pattern 3: Look for contrasts like "while X says..., Y says..."
    const whileMatch = text.match(/\*\*([^*]+)\*\*[^*]*while\s+\*\*([^*]+)\*\*/i);
    if (whileMatch && !boldSourceMatch) {
      // Extract the first source's take
      const firstPart = text.split(/while/i)[0];
      const secondPart = text.split(/while/i)[1];

      const source1Framing = extractVerbPhrase(firstPart);
      const source2Framing = extractVerbPhrase(secondPart);

      if (source1Framing) {
        framings.push({
          sourceName: whileMatch[1].trim(),
          framing: source1Framing,
          isUnique: false,
        });
      }
      if (source2Framing) {
        framings.push({
          sourceName: whileMatch[2].trim(),
          framing: source2Framing,
          isUnique: false,
        });
      }
    }
  }

  return framings;
}

/**
 * Clean up extracted framing text for display
 */
function cleanFramingText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove remaining bold
    .replace(/,\s*(a comparison|unlike|which|this).*/i, '') // Remove trailing comparisons
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract the main verb phrase from a sentence fragment
 */
function extractVerbPhrase(text: string): string | null {
  // Clean markdown
  const cleaned = text.replace(/\*\*([^*]+)\*\*/g, '$1').trim();

  // Look for common verb patterns
  const verbMatch = cleaned.match(/(likens?|compares?|calls?|frames?|describes?|labels?|characterizes?|portrays?|presents?)\s+([^,]+)/i);
  if (verbMatch) {
    return verbMatch[0].trim();
  }

  // If no clear verb, take the predicate after the source name
  const predicateMatch = cleaned.match(/(?:says?|states?|reports?|claims?)\s+(?:that\s+)?(.+)/i);
  if (predicateMatch) {
    return predicateMatch[1].substring(0, 60).trim();
  }

  return null;
}

/**
 * Get the most shareable framing (unique takes are more viral)
 */
function getBestFramingForShare(framings: ExtractedFraming[]): ExtractedFraming | null {
  // Prioritize unique takes (more viral)
  const unique = framings.find(f => f.isUnique);
  if (unique) return unique;

  // Otherwise return the first one
  return framings[0] || null;
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

@UseMirrorSource`;
  }

  // Fallback
  return `${sourceCount} sources on "${topicShort}"

The framing varies significantly.

Same facts. Different stories.

${shareUrl}

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
      // Fallback to raw differences
      const diffText = realDiffs.slice(0, 2).map(d =>
        `• ${d.label}: ${truncateText(cleanMarkdown(d.value), 60)}`
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

@UseMirrorSource – feedback welcome`);

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
  if (topic.length <= maxLen) return topic;
  return topic.substring(0, maxLen - 3) + '...';
}

function truncateText(text: string, maxLen: number): string {
  const cleaned = cleanMarkdown(text);
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen - 3) + '...';
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
