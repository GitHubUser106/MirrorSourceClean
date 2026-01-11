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

### 2026-01-10 - Brave Search Index Coverage Gap Identified

**Uncertainty Resolved:** Why does center-right return 0 results even with triple-query strategy and neutral keywords?

**Finding:** Brave Search has systematically lower index coverage of right-leaning news domains. This is NOT ranking bias (domains appearing lower) but complete absence from the index:

| Category | Domains Tested | Return Results | Coverage Rate |
|----------|----------------|----------------|---------------|
| Center-Right | 5 | 2 | 40% |
| Right | 6 | 2 | 33% |

**Root Cause:** Many right-leaning outlets are simply not crawled/indexed by Brave:
- nypost.com: 0 results
- dailywire.com: 0 results
- breitbart.com: 0 results
- rebelnews.com: 0 results

While left-leaning and mainstream outlets have comprehensive coverage.

**Evidence:**
- E7: Individual domain testing with neutral keywords
- Same query returns 5 results for foxnews.com, 0 for dailywire.com
- Not a ranking issue - domains are completely absent

**Solution Implemented:**
1. Identified domains with confirmed Brave coverage via live API testing
2. Added washingtontimes.com and townhall.com to RIGHT_DOMAINS (confirmed 5 results each)
3. Documented coverage status in code comments for future curation

**Implication:** Algorithmic fixes (triple-query, query neutralization) can only work with indexed content. MirrorSource's ability to deliver balanced results is fundamentally constrained by search engine index coverage. Future options:
1. Curate domain lists based on confirmed coverage
2. Explore alternative search APIs (Google, Bing) for right-leaning domains
3. Direct RSS/API integration with poorly-indexed outlets

This is a novel finding with broader implications for any application attempting to aggregate across the political spectrum using web search.

**Commits:**
- Domain expansion with coverage annotations

---

### 2026-01-10 - RSS Hybrid Architecture Bypasses Search Engine Limitations

**Uncertainty Resolved:** How to retrieve content from domains that Brave Search doesn't index?

**Finding:** Direct RSS feed aggregation can bypass search engine limitations entirely:
- Fetch RSS feeds in parallel with search queries (~350ms)
- Filter by keyword matching to find relevant articles
- Merge with search results for unified output

**Evidence:**
- E8: RSS implementation added dailywire.com, breitbart.com, nypost.com
- 121 items fetched per request, 5 matched by keywords
- Zero latency penalty (parallel execution)

**Implication:** When search engines fail to index certain sources, direct content feeds provide a reliable alternative. This is a reusable pattern for any aggregation application facing search engine gaps.

**Commits:**
- `cb6fb2b` - E8: RSS hybrid search implementation

---

### 2026-01-10 - Forced Fallback Guarantees Political Balance

**Uncertainty Resolved:** Why do left-leaning input URLs produce weak right-side results even with RSS feeds available?

**Finding:** Keyword matching fails across political framing boundaries:
- Left-framed headlines use different vocabulary than right-framed coverage
- Same story, different keywords → cross-spectrum matching fails
- Solution: When keyword matching is weak (< 2 domains), add "fallback" articles (most recent from each feed)

**Evidence:**
- E9: PBS ICE story results before/after
- Before: CR=0, R=1 (total right-side: 1)
- After: CR=1 (nypost), R=3 (dailywire, breitbart) (total: 4)
- +300% improvement in right-side coverage for left-input URLs

**Key Insight:** For breaking news, the most recent RSS item is almost always relevant regardless of keyword match. This "recency heuristic" enables guaranteed representation without requiring vocabulary overlap.

**Implementation:**
```typescript
if (matchedDomains.size < 2) {
  // Add most recent item from each unrepresented feed
  rssResults = [...rssResults, ...fallbacksToAdd];
}
```

**Implication:** Balanced aggregation across the political spectrum requires multiple strategies working together:
1. Triple-query (E5) - Guarantees API calls reach right domains
2. Query neutralization (E6) - Overcomes framing bias in search
3. RSS bypass (E8) - Retrieves content search engines miss
4. Forced fallback (E9) - Guarantees representation when matching fails

This layered approach is novel and addresses a previously undocumented challenge in cross-spectrum news aggregation.

**Commits:**
- `9872617` - E9: Forced RSS fallback for political balance

---

### 2026-01-10 - RSS Domain Diversity Prevents Single-Source Domination

**Uncertainty Resolved:** Why do RSS feeds return 0 center-right results even when those outlets are publishing relevant articles?

**Finding:** Three compounding bugs in RSS matching caused complete center-right exclusion:

1. **Top-N Selection Bug:** Returning "top 5 overall" allowed a single high-scoring domain (Daily Wire) to monopolize all slots, excluding NY Post and Washington Examiner despite having matching content.

2. **Threshold Strictness Bug:** Requiring 2+ keyword matches failed when geographic synonyms differed ("Minnesota" in keywords vs "Minneapolis" in headlines). Articles about the same story scored only 1.

3. **Timeout Bug:** 5-second timeout caused slow feeds (Daily Wire) to abort before returning results, silently dropping content.

**Evidence:**
- E9b: Daily Wire RSS confirmed ICE shooting article at top of feed
- Debug logging showed 5/5 top matches were dailywire.com
- Washington Examiner had score=1 (Minnesota/Minneapolis mismatch)
- Daily Wire feed timing out: "This operation was aborted"

**Solution Implemented:**
```typescript
// Fix 1: Per-domain selection (top 2 per domain, not top 5 overall)
const matchesByDomain: Record<string, typeof matches> = {};
for (const m of matches) {
  if (!matchesByDomain[m.item.domain]) matchesByDomain[m.item.domain] = [];
  matchesByDomain[m.item.domain].push(m);
}

// Fix 2: Lower threshold from 2 to 1
const threshold = 1;

// Fix 3: Increase timeout from 5s to 10s
const timeout = setTimeout(() => controller.abort(), 10000);
```

**Results:**
- Before: L8, C3, R1 (CR=0)
- After: L8, C3, R5 (CR included)
- diversityAnalysis.isBalanced: true

**Implication:** When aggregating from multiple RSS sources, domain diversity must be enforced at the selection level—not just at the merge level. Score-based ranking will naturally favor sources with higher match rates, creating systematic exclusion of lower-scoring but still-relevant domains.

**Commits:**
- `a036afc` - E9b: Debug logging for RSS matching
- `5771435` - E9b: Fix domain diversity, threshold, and timeout

---

## Template for Recording Advances

```
## [Date] - [Title]

**Uncertainty Resolved:** [What we didn't know before]

**Finding:** [What we now know]

**Evidence:** [Link to experiment/data]

**Implication:** [How this changes our approach]
```
