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
}

export interface ShareTemplate {
  id: string;
  name: string;
  description: string;
  text: string;
  charCount: number;
  isValid: boolean; // Under 280 chars
}

export interface ExtractedHook {
  type: 'contrast' | 'intensity' | 'agreement' | 'coverage';
  headline: string;
  detail: string;
  sources?: [string, string]; // Two contrasting sources
}

// Twitter counts URLs as 23 chars
const URL_CHAR_COUNT = 23;
const MAX_CHARS = 280;
const SAFE_BUFFER = 5;
const EFFECTIVE_MAX = MAX_CHARS - SAFE_BUFFER;

/**
 * Extract the "spiciest" hook from the brief data
 */
export function extractHook(data: BriefDataForShare): ExtractedHook {
  const keyDiffs = normalizeKeyDifferences(data.keyDifferences);
  const commonGround = normalizeCommonGround(data.commonGround);
  const sources = data.sources || [];
  const intensity = data.emotionalIntensity || 5;

  // Priority 1: Find contrasting framings from different sources
  if (keyDiffs.length > 0) {
    const bestDiff = keyDiffs[0];
    // Try to extract source names from the difference
    const sourceMatch = bestDiff.value.match(/\*\*([^*]+)\*\*/);
    const sourceName = sourceMatch ? sourceMatch[1] : null;

    return {
      type: 'contrast',
      headline: bestDiff.label,
      detail: cleanMarkdown(bestDiff.value),
      sources: sourceName ? [sourceName, getContrastingSource(sources, sourceName)] : undefined,
    };
  }

  // Priority 2: High emotional intensity
  if (intensity >= 7) {
    return {
      type: 'intensity',
      headline: `Emotional intensity: ${intensity}/10`,
      detail: intensity >= 9 ? 'Inflammatory coverage detected' : 'Heated framing across sources',
    };
  }

  // Priority 3: Surprising common ground
  if (commonGround.length > 0) {
    return {
      type: 'agreement',
      headline: 'Surprising agreement',
      detail: commonGround[0].value,
    };
  }

  // Priority 4: Coverage breadth
  return {
    type: 'coverage',
    headline: `${sources.length} sources analyzed`,
    detail: getSourceSpread(sources),
  };
}

/**
 * Generate all share template variants
 */
export function generateShareTemplates(
  data: BriefDataForShare,
  shareUrl: string
): ShareTemplate[] {
  const hook = extractHook(data);
  const sourceCount = data.sources?.length || 0;
  const topicShort = truncateTopic(data.topic, 60);

  // URL placeholder for char counting (will be replaced with actual URL)
  const urlPlaceholder = '[URL]';

  const templates: ShareTemplate[] = [];

  // Format A: "The Receipts" (Contrast Hook)
  const receiptsText = generateReceiptsFormat(data, hook, topicShort, sourceCount, shareUrl);
  templates.push({
    id: 'receipts',
    name: 'The Receipts',
    description: 'Contrast two sources directly',
    text: receiptsText,
    charCount: calculateCharCount(receiptsText),
    isValid: calculateCharCount(receiptsText) <= EFFECTIVE_MAX,
  });

  // Format B: "The Question" (Engagement Bait)
  const questionText = generateQuestionFormat(data, hook, topicShort, sourceCount, shareUrl);
  templates.push({
    id: 'question',
    name: 'The Question',
    description: 'Ask a provocative question',
    text: questionText,
    charCount: calculateCharCount(questionText),
    isValid: calculateCharCount(questionText) <= EFFECTIVE_MAX,
  });

  // Format C: "The Discovery" (Personal Observation)
  const discoveryText = generateDiscoveryFormat(data, hook, topicShort, sourceCount, shareUrl);
  templates.push({
    id: 'discovery',
    name: 'The Discovery',
    description: 'Share your finding',
    text: discoveryText,
    charCount: calculateCharCount(discoveryText),
    isValid: calculateCharCount(discoveryText) <= EFFECTIVE_MAX,
  });

  return templates;
}

/**
 * Format A: "The Receipts" - Direct source contrast
 */
function generateReceiptsFormat(
  data: BriefDataForShare,
  hook: ExtractedHook,
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const sources = data.sources || [];
  const keyDiffs = normalizeKeyDifferences(data.keyDifferences);

  // Try to find two contrasting sources
  let source1 = 'One outlet';
  let source2 = 'Another outlet';
  let framing1 = 'one framing';
  let framing2 = 'different framing';

  if (sources.length >= 2) {
    // Get sources from different political leans if possible
    const leftSource = sources.find(s => s.politicalLean === 'left' || s.politicalLean === 'center-left');
    const rightSource = sources.find(s => s.politicalLean === 'right' || s.politicalLean === 'center-right');

    if (leftSource && rightSource) {
      source1 = leftSource.displayName;
      source2 = rightSource.displayName;
    } else {
      source1 = sources[0].displayName;
      source2 = sources[1].displayName;
    }
  }

  // Extract framings from key differences if available
  if (keyDiffs.length > 0 && hook.detail) {
    framing1 = truncateText(hook.detail, 40);
    framing2 = keyDiffs.length > 1 ? truncateText(keyDiffs[1].value, 40) : 'different angle';
  }

  return `${source1}: "${framing1}"

${source2}: different take

Same story. ${sourceCount} sources. Different framings.

🔍 ${shareUrl}

What did YOUR feed show you?`;
}

/**
 * Format B: "The Question" - Engagement bait
 */
function generateQuestionFormat(
  data: BriefDataForShare,
  hook: ExtractedHook,
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const sources = data.sources || [];
  const sourceNames = sources.slice(0, 3).map(s => s.displayName);

  // Create a provocative question based on the hook
  let question = `Is this story being framed fairly?`;

  if (hook.type === 'contrast') {
    question = `Is "${topicShort}" really what it seems?`;
  } else if (hook.type === 'intensity') {
    question = `Why is coverage of "${topicShort}" so heated?`;
  }

  const bulletPoints = sourceNames.map(name => `• ${name}`).join('\n');

  return `${question}

Depends who you ask:
${bulletPoints}

${sourceCount} sources compared → ${shareUrl}

Which framing did YOUR feed show?`;
}

/**
 * Format C: "The Discovery" - Personal observation
 */
function generateDiscoveryFormat(
  data: BriefDataForShare,
  hook: ExtractedHook,
  topicShort: string,
  sourceCount: number,
  shareUrl: string
): string {
  const keyDiffs = normalizeKeyDifferences(data.keyDifferences);

  let finding = 'The framing differences are significant.';

  if (keyDiffs.length > 0) {
    finding = `Biggest gap: ${truncateText(cleanMarkdown(keyDiffs[0].value), 80)}`;
  } else if (hook.type === 'intensity') {
    finding = `Emotional intensity varies wildly across outlets.`;
  }

  return `${sourceCount} sources on "${topicShort}"

${finding}

Same facts. Different stories.

${shareUrl}

@UseMirrorSource – feedback welcome 👇`;
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
  const keyDiffs = normalizeKeyDifferences(data.keyDifferences);
  const commonGround = normalizeCommonGround(data.commonGround);

  const tweets: string[] = [];

  // Tweet 1: Hook
  tweets.push(`🧵 I compared how ${sourceCount} outlets covered "${topicShort}"

The differences are revealing. Here's what I found:`);

  // Tweet 2: Key differences
  if (keyDiffs.length > 0) {
    const diffText = keyDiffs.slice(0, 2).map(d =>
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

  // Tweet 4: CTA
  tweets.push(`Full breakdown with all ${sourceCount} sources:
${shareUrl}

@UseMirrorSource – testing this tool, feedback welcome 👇`);

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

function getContrastingSource(sources: ShareSource[], excludeName: string): string {
  const other = sources.find(s => s.displayName !== excludeName);
  return other?.displayName || 'other outlets';
}

function getSourceSpread(sources: ShareSource[]): string {
  const leans = new Set(sources.map(s => s.politicalLean).filter(Boolean));
  if (leans.size >= 4) return 'Full spectrum coverage';
  if (leans.size >= 2) return 'Multiple perspectives';
  return `${sources.length} sources analyzed`;
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

export { calculateCharCount, EFFECTIVE_MAX, MAX_CHARS };
