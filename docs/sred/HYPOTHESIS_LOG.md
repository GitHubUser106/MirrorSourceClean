# Hypothesis Tracking Log

## Status Key
- **UNTESTED** - Not yet investigated
- **TESTING** - Currently under investigation
- **SUPPORTED** - Evidence supports this hypothesis
- **REFUTED** - Evidence contradicts this hypothesis
- **PARTIAL** - Some evidence, inconclusive

---

## H1: Source Database Gap

**Hypothesis:** Our AllSides/MBFC-derived source classification database has incomplete coverage of right-leaning outlets.

| Field | Value |
|-------|-------|
| Status | **REFUTED** |
| Started | 2026-01-10 |
| Completed | 2026-01-10 |
| Experiment | E1 - Database audit |
| Evidence | Database: 21 Left vs 23 Right (nearly equal). BALANCED_DOMAINS: 6L-6CL-6C-5CR-6R (symmetric). |
| Conclusion | Database is NOT the cause of bias. Root cause is downstream in search results. |

---

## H2: Query Formulation Bias

**Hypothesis:** Keywords extracted from stories carry implicit left-leaning framing, biasing CSE results.

| Field | Value |
|-------|-------|
| Status | **SUPPORTED** |
| Started | 2026-01-10 |
| Completed | 2026-01-10 |
| Experiment | E2 - Query formulation analysis |
| Evidence | Same ICE story: PBS input → 0 right sources; Fox input → 5 right sources. Article titles ARE queries, and titles carry source-specific framing. |
| Conclusion | Query formulation bias is a major contributor to skewed results. Titles from left sources use left-framed language that doesn't match right-leaning coverage. |

**Root Cause:**
- Article `<title>` tags are used directly as search queries
- Left sources: "fatal ICE shooting", "can't access evidence"
- Right sources: "massive ICE crackdown", "destroys Dems narrative"
- Minimal keyword overlap between political framings

**Fix Required:** Entity extraction or query neutralization for RIGHT_DOMAINS queries.

**Fix Implemented (E6):**
- Added `extractNeutralKeywords()` using Gemini flash
- Applies neutral query ONLY to RIGHT_DOMAINS search
- Result: PBS input now returns 1 CR + 1 R (was 0+0)

---

## H3: CSE Index Bias

**Hypothesis:** Brave Search API has systematically better indexing/ranking of left-leaning news domains, causing biased results even when balanced site: filters are provided.

| Field | Value |
|-------|-------|
| Status | **SUPPORTED** |
| Started | 2026-01-10 |
| Completed | 2026-01-10 |
| Experiment | E3 - Brave Search API bias investigation |
| Evidence | Two live tests showed 0% return rate for center-right/right domains. Test 1 (NYT input): 0 CR, 0 R. Test 2 (Fox input): 0 CR, 1 R (input only). Bias is input-agnostic and systematic. |
| Conclusion | Brave Search ranking/indexing favors center-left mainstream outlets. Single balanced query cannot overcome this. |

---

## H4: Publication Timing Asymmetry

**Hypothesis:** Right-leaning outlets publish later on breaking stories; real-time queries catch left first.

| Field | Value |
|-------|-------|
| Status | UNTESTED |
| Started | - |
| Experiment | E4 - Time-delayed queries |
| Evidence | - |
| Conclusion | - |

---

## H5: Dual-Query Strategy Required

**Hypothesis:** Single queries cannot retrieve balance; need ideology-aware parallel queries to force inclusion of right-leaning sources.

| Field | Value |
|-------|-------|
| Status | **SUPPORTED** |
| Started | 2026-01-10 |
| Completed | 2026-01-10 |
| Experiment | E5 - Triple-query implementation |
| Evidence | Before: 0 CR, 0 R. After: 1 CR (Washington Examiner), 1 R (The Federalist). Coverage gap eliminated. |
| Conclusion | Triple-query with Promise.all() successfully forces right-side inclusion without latency penalty. |

**Implementation (Deployed):**
1. Query A: LEFT_DOMAINS (12 domains: Left + Center-Left)
2. Query B: CENTER_DOMAINS (6 domains)
3. Query C: RIGHT_DOMAINS (11 domains: Center-Right + Right)
4. Merge with deduplication - each category guaranteed representation

**Commit:** `414e52a`
