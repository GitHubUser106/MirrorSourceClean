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

## Template for Recording Advances

```
## [Date] - [Title]

**Uncertainty Resolved:** [What we didn't know before]

**Finding:** [What we now know]

**Evidence:** [Link to experiment/data]

**Implication:** [How this changes our approach]
```
