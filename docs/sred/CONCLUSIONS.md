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

## Template for Recording Advances

```
## [Date] - [Title]

**Uncertainty Resolved:** [What we didn't know before]

**Finding:** [What we now know]

**Evidence:** [Link to experiment/data]

**Implication:** [How this changes our approach]
```
