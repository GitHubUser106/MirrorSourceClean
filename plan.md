# 🎯 MirrorSource Feature Sprint: Story Provenance Tracking

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, TypeScript 5, Tailwind 3.4, Brave Search API, Gemini AI
* **Feature Branch:** `feature/story-provenance`
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.
* **Coding Style:** "Vibecoding" — prioritize speed and functioning prototypes.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Add Story Provenance tracking to identify where news stories originate

### Context
> **The Problem:** Users see 10 articles covering the same story but can't tell which outlet actually broke the news vs. which ones are just rewriting wire copy. This obscures who's doing real journalism vs. who's aggregating.
> **The Solution:** Analyze story origins and display provenance information — wire service detection, original reporting identification, and aggregator flagging.
> **The Outcome:** Users understand the information supply chain: "This story came from AP, was enriched by NYT and WSJ, and was rewritten by 7 other outlets."
> **Competitive Advantage:** No competitor (Ground News, AllSides, Media Bias Fact Check) offers this. MirrorSource would be first.

### User Value Proposition
| User Question | Provenance Answers |
|---------------|-------------------|
| "I'm reading 5 articles that say the same thing" | "That's because they're all rewriting AP" |
| "Which outlet actually broke this story?" | Shows the original source |
| "Is this outlet doing real journalism?" | Exposes who aggregates vs. who reports |
| "Why does everyone have the same quote?" | "It's from a press release" |

---

## 3. Technical Approach

### What's Detectable (MVP Scope)
| Signal | Detection Method | Difficulty |
|--------|------------------|------------|
| Wire service origin | Text matching — AP/Reuters/AFP stories appear verbatim | Easy |
| Attribution phrases | Regex: "according to [Source]", "first reported by", "as reported by" | Easy |
| Publish timestamps | Brave Search returns timestamps — earliest = likely origin | Easy |
| Press release origin | Detect PR Newswire, Business Wire, company newsroom URLs | Easy |
| Original vs. rewrite | Gemini analysis of unique content/quotes/interviews | Medium |

### What's Out of Scope (V2+)
| Signal | Challenge |
|--------|-----------|
| Twitter/X origin | Would need X API integration |
| Substack/Newsletter origin | Growing trend but harder to detect |
| Embargoed stories | Release simultaneously, hard to trace |

---

## 4. Implementation Plan

### Phase 1: Backend - Gemini Prompt Enhancement

- [ ] **Step 1.1: Update Gemini synthesis prompt in `route.ts`**
    * Add provenance analysis to the existing prompt:
```typescript
const prompt = `You are a news intelligence analyst...

// ... existing prompt content ...

ADDITIONAL ANALYSIS - STORY PROVENANCE:
Analyze the sources to determine story origin:
1. Is this wire service content? Look for verbatim text across multiple sources (AP, Reuters, AFP pattern)
2. Can you identify the likely original source? (earliest timestamp, "first reported by" phrases, unique details)
3. Which outlets have ORIGINAL reporting (unique quotes, interviews, investigation)?
4. Which outlets are AGGREGATING (rewriting wire copy, no original content)?

Add to your JSON response:
"provenance": {
  "origin": "wire_service" | "single_outlet" | "press_release" | "unknown",
  "originSource": "AP" | "Reuters" | "Wall Street Journal" | null,
  "originConfidence": "high" | "medium" | "low",
  "originalReporting": ["outlet1", "outlet2"],  // Outlets with unique content
  "aggregators": ["outlet3", "outlet4"],         // Outlets just rewriting
  "explanation": "Brief explanation of how you determined origin"
}
```

- [ ] **Step 1.2: Update response interface**
```typescript
interface ProvenanceInfo {
  origin: 'wire_service' | 'single_outlet' | 'press_release' | 'unknown';
  originSource: string | null;
  originConfidence: 'high' | 'medium' | 'low';
  originalReporting: string[];
  aggregators: string[];
  explanation: string;
}

interface IntelBrief {
  summary: string;
  commonGround: CommonGroundFact[] | string;
  keyDifferences: KeyDifference[] | string;
  provenance?: ProvenanceInfo;  // NEW
}
```

- [ ] **Step 1.3: Parse provenance from Gemini response**
    * Extract `provenance` object from JSON response
    * Handle missing/malformed provenance gracefully (default to null)

---

### Phase 2: Frontend - Provenance Display

- [ ] **Step 2.1: Create ProvenanceCard component**
    * File: `src/components/ProvenanceCard.tsx`
```tsx
interface ProvenanceCardProps {
  provenance: ProvenanceInfo;
}

export function ProvenanceCard({ provenance }: ProvenanceCardProps) {
  // Origin type icon
  const originIcon = {
    wire_service: '📡',
    single_outlet: '🎯',
    press_release: '📋',
    unknown: '❓'
  }[provenance.origin];

  // Origin type label
  const originLabel = {
    wire_service: 'Wire Service Story',
    single_outlet: 'Original Scoop',
    press_release: 'Press Release',
    unknown: 'Origin Unknown'
  }[provenance.origin];

  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
        📡 Story Origin
      </h3>
      
      {/* Origin Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{originIcon}</span>
        <span className="font-medium">{originLabel}</span>
        {provenance.originSource && (
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-sm">
            {provenance.originSource}
          </span>
        )}
        <ConfidenceBadge level={provenance.originConfidence} />
      </div>

      {/* Original Reporters */}
      {provenance.originalReporting.length > 0 && (
        <div className="mb-2">
          <span className="text-sm text-gray-600">🔍 Original reporting: </span>
          <span className="text-sm font-medium">
            {provenance.originalReporting.join(', ')}
          </span>
        </div>
      )}

      {/* Aggregators */}
      {provenance.aggregators.length > 0 && (
        <div className="mb-2">
          <span className="text-sm text-gray-600">📋 Rewrites: </span>
          <span className="text-sm text-gray-500">
            {provenance.aggregators.join(', ')}
          </span>
        </div>
      )}

      {/* Explanation */}
      <p className="text-xs text-gray-500 mt-2 italic">
        {provenance.explanation}
      </p>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const styles = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-600'
  }[level] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${styles}`}>
      {level} confidence
    </span>
  );
}
```

- [ ] **Step 2.2: Add ProvenanceCard to page.tsx**
    * Place between Summary and Intel Brief (or inside Intel Brief)
```tsx
{results?.provenance && (
  <ProvenanceCard provenance={results.provenance} />
)}
```

- [ ] **Step 2.3: Alternative - Integrate into Intel Brief**
    * Instead of separate card, add as first section of Intel Brief:
```tsx
// Inside Intel Brief card
<div className="border-b pb-3 mb-3">
  <div className="flex items-center gap-2 text-sm">
    <span>📡</span>
    <span className="text-gray-600">Origin:</span>
    <span className="font-medium">{provenance.originSource || 'Unknown'}</span>
    {provenance.origin === 'wire_service' && (
      <span className="text-gray-500">
        (wire story, {provenance.aggregators.length} outlets rewriting)
      </span>
    )}
  </div>
</div>
```

---

### Phase 3: Enhanced Detection (Optional)

- [ ] **Step 3.1: Wire service text matching**
    * Add utility function to detect verbatim wire content:
```typescript
// src/lib/provenanceDetection.ts

const WIRE_SIGNATURES = [
  /\(AP\)\s*[—–-]/,           // (AP) — 
  /\(Reuters\)\s*[—–-]/,       // (Reuters) —
  /\(AFP\)\s*[—–-]/,           // (AFP) —
  /Associated Press/i,
  /Reuters\s+reported/i,
];

export function detectWireService(text: string): string | null {
  for (const pattern of WIRE_SIGNATURES) {
    if (pattern.test(text)) {
      if (/\(AP\)|Associated Press/i.test(text)) return 'AP';
      if (/\(Reuters\)|Reuters/i.test(text)) return 'Reuters';
      if (/\(AFP\)|Agence France/i.test(text)) return 'AFP';
    }
  }
  return null;
}
```

- [ ] **Step 3.2: Attribution phrase extraction**
```typescript
const ATTRIBUTION_PATTERNS = [
  /first reported by ([A-Z][a-zA-Z\s]+)/i,
  /according to ([A-Z][a-zA-Z\s]+)/i,
  /as reported by ([A-Z][a-zA-Z\s]+)/i,
  /([A-Z][a-zA-Z\s]+) first reported/i,
];

export function extractAttributions(text: string): string[] {
  const attributions: string[] = [];
  for (const pattern of ATTRIBUTION_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      attributions.push(match[1].trim());
    }
  }
  return attributions;
}
```

- [ ] **Step 3.3: Timestamp analysis**
    * Use Brave Search timestamps to identify earliest source
    * Pass timestamp data to Gemini for analysis

---

## 5. UI Mockup

### Option A: Standalone Card (Below Summary)
```
┌─────────────────────────────────────────────────────┐
│ 📡 Story Origin                                     │
│                                                     │
│ 📡 Wire Service Story    [AP]    [high confidence]  │
│                                                     │
│ 🔍 Original reporting: WSJ, NYT (added interviews)  │
│ 📋 Rewrites: CNN, Fox News, HuffPost, Daily Mail    │
│                                                     │
│ ℹ️ This story originated from an AP wire report.    │
│    WSJ and NYT added original interviews.           │
└─────────────────────────────────────────────────────┘
```

### Option B: Integrated into Intel Brief
```
┌─────────────────────────────────────────────────────┐
│ 📊 Intel Brief                                      │
│                                                     │
│ 📡 Origin: AP wire → enriched by WSJ, NYT          │
│ ─────────────────────────────────────────────────── │
│ 🟡 Moderate Divergence — Sources agree on facts...  │
│                                                     │
│ ┌─────────────────┐  ┌─────────────────┐           │
│ │ COMMON GROUND   │  │ KEY DIFFERENCES │           │
│ └─────────────────┘  └─────────────────┘           │
└─────────────────────────────────────────────────────┘
```

### Option C: Badge on Source Cards
```
┌─────────────────────┐  ┌─────────────────────┐
│ REUTERS             │  │ CNN                 │
│ [Center] [Wire] 📡  │  │ [Center-Left]       │
│                     │  │ [Rewrite] 📋        │
│ "Trump meets..."    │  │ "Trump meets..."    │
└─────────────────────┘  └─────────────────────┘
```

**Recommendation:** Start with Option B (integrated into Intel Brief) for MVP. Add Option C badges in V2.

---

## 6. Execution Checklist Summary

### MVP (This Sprint)
- [x] Update Gemini prompt with provenance analysis
- [x] Add ProvenanceInfo interface
- [x] Parse provenance from API response
- [x] Display provenance in Intel Brief section
- [ ] Test with wire service story (AP/Reuters)
- [ ] Test with original scoop (e.g., investigative piece)
- [ ] Test with press release story

### V2 (Future Sprint)
- [ ] Wire signature detection utility
- [ ] Attribution phrase extraction
- [ ] Timestamp-based origin detection
- [ ] "Original" vs "Rewrite" badges on Source Cards
- [ ] Provenance confidence scoring

---

## 7. Success Criteria

- [ ] Gemini returns provenance data for each analysis
- [ ] Wire service stories correctly identified (AP, Reuters, AFP)
- [ ] Original reporting outlets highlighted
- [ ] Aggregator outlets flagged
- [ ] UI displays provenance clearly without cluttering
- [ ] No performance regression (provenance analysis in same Gemini call)

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/find/route.ts` | Update Gemini prompt, parse provenance |
| `src/app/page.tsx` | Display provenance in Intel Brief |
| `src/components/ProvenanceCard.tsx` | NEW - Provenance display component (optional) |
| `src/lib/provenanceDetection.ts` | NEW - Wire/attribution detection utilities (V2) |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Gemini hallucinating provenance | Add confidence levels, verify against known wire signatures |
| Slowing down API response | Provenance in same prompt, not separate call |
| UI clutter | Start minimal (one line in Intel Brief), expand if users want more |
| Incorrect origin detection | Show confidence level, allow "unknown" as valid answer |

---

## 10. Competitive Positioning

| Competitor | Has Provenance? | MirrorSource Advantage |
|------------|-----------------|------------------------|
| Ground News | ❌ No | First to market |
| AllSides | ❌ No | Unique differentiator |
| Media Bias Fact Check | ❌ No | Actionable insight |
| Google News | ❌ No | Transparency focus |

**Tagline opportunity:** *"See where the story started."*

---

**Date:** December 30, 2025
**Status:** Ready for Builder
**Estimated Time:** 2-3 hours (MVP)
**Priority:** High — Unique feature, competitive advantage