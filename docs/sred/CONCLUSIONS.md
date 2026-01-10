# Conclusions & Technological Advances

This document records verified findings that resolve technological uncertainty.

---

## Advances Log

### 2026-01-10 - Brave Search API Systematic Bias Identified

**Uncertainty Resolved:** Why does MirrorSource return left-skewed source distributions regardless of input URL political lean?

**Finding:** Brave Search API returns systematically biased results even when provided balanced site: filters across the political spectrum. The bias is:
- **Input-agnostic:** Same skew whether input is NYTimes (Center-Left) or Fox News (Right)
- **Complete for right-side:** 0% return rate for center-right/right domains
- **Structural:** Single queries with 29 domain filters cannot overcome Brave's ranking algorithm

**Evidence:**
- E1: Database audit confirmed balanced source data (21 Left vs 23 Right)
- E3: Live testing showed 0/11 right-leaning domains returned in any query
- BALANCED_DOMAINS correctly configured with equal representation

**Implication:** Single-query balanced search is fundamentally unsuitable. Solution requires:
1. **Dual/Triple Query Strategy:** Separate queries per political category
2. **Forced inclusion:** Guarantee right-leaning sources through dedicated API calls
3. **Merge logic:** Interleave results to achieve target distribution

This is a novel finding - no existing documentation describes this Brave Search behavior.

---

### 2026-01-10 - Triple-Query Strategy Resolves Bias

**Uncertainty Resolved:** How to force balanced political representation when Brave Search API systematically excludes right-leaning sources?

**Finding:** Parallel ideology-segmented queries (triple-query) successfully overcome Brave's ranking bias:
- Split domains into 3 lists: LEFT_DOMAINS (12), CENTER_DOMAINS (6), RIGHT_DOMAINS (11)
- Run queries in parallel with `Promise.all()` - no latency penalty
- Each category gets dedicated API call - cannot be "crowded out"

**Evidence:**
- E5: Before fix: 0 Center-Right, 0 Right sources
- E5: After fix: 1 Center-Right (Washington Examiner), 1 Right (The Federalist)
- Coverage gap warning eliminated

**Implementation:**
```typescript
const [leftResults, centerResults, rightResults] = await Promise.all([
  searchWithBrave(`${searchQuery} (${leftFilters})`),
  searchWithBrave(`${searchQuery} (${centerFilters})`),
  searchWithBrave(`${searchQuery} (${rightFilters})`),
]);
```

**Implication:** This is a reusable pattern for any application facing search engine ranking bias. When a single query cannot achieve balanced results due to algorithmic favoritism, parallel category-specific queries with controlled domain lists can guarantee representation.

**Commits:**
- `847aa04` - Identified root cause (H3 supported)
- `414e52a` - Implemented and validated fix (H5 supported)

---

### 2026-01-10 - Query Neutralization Resolves Framing Bias

**Uncertainty Resolved:** Why do left-input URLs still return 0 right-leaning sources even with triple-query strategy?

**Finding:** Article titles carry source-specific editorial framing that creates vocabulary mismatch across the political spectrum:
- **Left-framed:** "can't access evidence", "fatal ICE shooting", "won't work jointly"
- **Right-framed:** "federal officer immunity", "ICE crackdown", "destroys narrative"
- **Minimal overlap:** Same story, different keywords → cross-spectrum queries fail

**Solution:** Entity extraction using Gemini flash to neutralize queries for RIGHT_DOMAINS:
- Extract core entities: "ICE", "Minneapolis", "FBI", "shooting"
- Strip framing language: adjectives, opinion words, editorial phrases
- Apply ONLY to right-side query (left/center framing already matches their sources)

**Evidence:**
- E2: PBS input → 0 CR, 0 R (title framing mismatch identified)
- E6: After neutralization → 1 CR (Washington Examiner), 1 R (Fox News)
- Query transformation: "Minnesota officials say they can't access evidence..." → "Minnesota ICE shooting FBI"

**Implementation:**
```typescript
const neutralQuery = await extractNeutralKeywords(searchQuery);

const [leftResults, centerResults, rightResults] = await Promise.all([
  searchWithBrave(`${searchQuery} (${leftFilters})`),    // Original
  searchWithBrave(`${searchQuery} (${centerFilters})`),  // Original
  searchWithBrave(`${neutralQuery} (${rightFilters})`),  // NEUTRAL
]);
```

**Implication:** This is a novel finding about cross-spectrum news retrieval. Headlines are not neutral descriptors - they encode political perspective in vocabulary choices. Effective multi-perspective aggregation requires query normalization to overcome this semantic gap.

**Combined Solution (E5 + E6):**
- E5 (H3 fix): Guarantees API calls reach right-leaning domains
- E6 (H2 fix): Ensures queries match right-leaning vocabulary

---

## Template for Recording Advances

```
## [Date] - [Title]

**Uncertainty Resolved:** [What we didn't know before]

**Finding:** [What we now know]

**Evidence:** [Link to experiment/data]

**Implication:** [How this changes our approach]
```
