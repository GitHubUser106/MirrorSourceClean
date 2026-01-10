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
| Status | UNTESTED |
| Started | - |
| Experiment | E2 - Keyword comparison |
| Evidence | - |
| Conclusion | - |

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
| Status | **TESTING** |
| Started | 2026-01-10 |
| Experiment | E5 - Parallel query implementation |
| Evidence | Pending - H3 confirmed single query fails; now testing dual-query approach |
| Conclusion | Pending |

**Proposed Implementation:**
1. Run Query A: Left + Center-Left domains only
2. Run Query B: Right + Center-Right domains only
3. Run Query C: Center domains only
4. Merge results with guaranteed representation from each category
