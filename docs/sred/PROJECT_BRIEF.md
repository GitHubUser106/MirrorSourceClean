# SR&ED Project: Transparency Engine Bias Correction

**Project Name:** Transparency Engine Political Spectrum Rebalancing
**Date:** 2026-01-10
**SR&ED Domain:** AI/NLP, Information Retrieval, Political Classification
**Status:** Active Investigation

---

## The Problem

MirrorSource's Transparency Engine consistently returns left-skewed source distributions regardless of the political leaning of the input URL.

### Observed Results

| Input URL | Source Bias | Actual Output | Gap |
|-----------|-------------|---------------|-----|
| nbcnews.com (Left) | Left | 10/12 left-leaning | Right underrepresented |
| pbs.org (Center-Left) | Center-Left | 0 right-leaning | Complete right blackout |
| foxnews.com (Right) | Right | 8 CL, 6 C, 2 R | 50% center-left despite right input |

---

## Technological Uncertainty

### What We Don't Know

1. **Search/retrieval problem?** - Is Google CSE returning biased results?
2. **Classification problem?** - Is our source database incomplete on the right?
3. **Query construction problem?** - Do extracted keywords favor left-leaning coverage?
4. **Coverage reality problem?** - Do right-leaning outlets produce less indexable content?

### Why Standard Practice Can't Resolve

- No existing tool provides verified, balanced cross-spectrum news retrieval
- Political bias in search results is an active research problem
- Multi-variable system with no documented best practice

---

## Hypotheses

| ID | Hypothesis | Description |
|----|------------|-------------|
| H1 | Source Database Gap | Classification database has incomplete right-leaning coverage |
| H2 | Query Formulation Bias | Extracted keywords carry implicit left-leaning framing |
| H3 | CSE Index Bias | Google's index favors left-leaning news domains |
| H4 | Publication Timing | Right-leaning outlets publish later; queries catch left first |
| H5 | Dual-Query Required | Single queries cannot retrieve balance; need parallel queries |

---

## Success Criteria

1. Root cause identified and documented
2. Solution achieves minimum 25% right-leaning sources
3. All three test cases return balanced spectrum coverage
4. SR&ED evidence trail complete
