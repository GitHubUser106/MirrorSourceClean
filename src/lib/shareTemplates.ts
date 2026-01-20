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
    const questionText = generateQuestionFormat(data, topicShort, sourceCount, shareUrl);
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
 * Format: "The Receipts" - Direct source contrast (HIGH DIVERGENCE ONLY)
 */
function generateReceiptsFormat(
  data: BriefDataForShare,
  realDiffs: KeyDifference[],
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const sources = data.sources || [];

  // Get sources from different political leans
  const leftSource = sources.find(s =>
    s.politicalLean === 'left' || s.politicalLean === 'center-left'
  );
  const rightSource = sources.find(s =>
    s.politicalLean === 'right' || s.politicalLean === 'center-right'
  );

  const source1 = leftSource?.displayName || sources[0]?.displayName || 'Left-leaning outlet';
  const source2 = rightSource?.displayName || sources[1]?.displayName || 'Right-leaning outlet';

  // Extract actual framing difference if available
  let framingDesc = 'frames it differently';
  if (realDiffs.length > 0) {
    // Use the label (like "Scope:", "Framing:") rather than the full text
    const diffLabel = realDiffs[0].label;
    if (diffLabel && diffLabel !== 'Difference') {
      framingDesc = `different ${diffLabel.replace(':', '').toLowerCase()}`;
    }
  }

  return `${source1} vs ${source2}

Same story. ${framingDesc}.

${sourceCount} sources compared:
${shareUrl}

What did YOUR feed show you?`;
}

/**
 * Format: "The Question" - Engagement bait (HIGH DIVERGENCE)
 */
function generateQuestionFormat(
  data: BriefDataForShare,
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const sources = data.sources || [];
  const sourceNames = sources.slice(0, 3).map(s => s.displayName);
  const bulletPoints = sourceNames.map(name => `• ${name}`).join('\n');

  return `How is "${topicShort}" being framed?

Depends who you ask:
${bulletPoints}

${sourceCount} sources compared:
${shareUrl}

Which version did YOUR feed show?`;
}

/**
 * Format: "The Discovery" - Personal observation (HIGH DIVERGENCE)
 */
function generateDiscoveryFormat(
  data: BriefDataForShare,
  realDiffs: KeyDifference[],
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  let finding = 'The framing varies significantly across outlets.';

  if (realDiffs.length > 0) {
    const diff = realDiffs[0];
    const label = diff.label !== 'Difference' ? diff.label.replace(':', '') : 'framing';
    finding = `Biggest gap: ${label.toLowerCase()}`;
  }

  return `${sourceCount} sources on "${topicShort}"

${finding}

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

    // Tweet 1: Hook
    tweets.push(`I compared how ${sourceCount} outlets covered "${topicShort}"

The differences are revealing. Here's what I found:`);

    // Tweet 2: Key differences
    if (realDiffs.length > 0) {
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
