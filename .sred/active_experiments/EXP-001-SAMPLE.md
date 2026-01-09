# Experiment Manifest: EXP-001

> **STATUS:** 🔬 ACTIVE

---

## 1. UNCERTAINTY GATE (Complete Before Writing Code)

### What technological uncertainty are we investigating?
Can we reliably extract article keywords and metadata from 170+ heterogeneous news site DOM structures without per-site configuration, given that sites use inconsistent HTML patterns, dynamic JavaScript rendering, paywalls, and anti-scraping measures?

### Why can't this be solved through standard practice?
- Standard NLP libraries (newspaper3k, readability) achieve <60% accuracy across our target sites
- StackOverflow solutions assume consistent DOM structures (single-site scrapers)
- Commercial APIs (Diffbot, etc.) are cost-prohibitive at our scale ($500+/month)
- No existing open-source solution handles the combination of: paywalls, JS rendering, and 170+ domain variance

### What is your hypothesis?
We believe that a hybrid approach combining (1) Playwright for JS rendering, (2) multiple fallback extraction strategies, and (3) domain-specific overrides for the worst offenders will achieve >85% extraction accuracy because the 80/20 rule suggests most sites follow a few common patterns.

### What would failure look like?
- Extraction accuracy remains below 80% despite optimizations
- Processing time exceeds 5 seconds per article (unusable for real-time)
- Maintenance burden of domain-specific overrides becomes unsustainable (>10 hours/month)

### Technological Domain (from config.json):
- [x] TD-001: Cross-Domain Content Extraction
- [ ] TD-002: Dual-LLM Orchestration  
- [ ] TD-003: AI Content Detection
- [ ] NEW: _______________

---

## 2. SYSTEMATIC INVESTIGATION LOG

| Date | Type | Commit/Note | What We Tried | What Happened |
|------|------|-------------|---------------|---------------|
| 2025-01-03 | START | abc123 | Initial newspaper3k implementation | 58% accuracy on test set |
| 2025-01-03 | FAIL | def456 | Added readability-lxml fallback | Improved to 62%, still failing on JS-heavy sites |
| 2025-01-04 | FAIL | ghi789 | Playwright for all sites | Accuracy 78% but 12s/article (too slow) |
| 2025-01-04 | PIVOT | jkl012 | Selective Playwright (JS detection) | Investigating DOM pre-analysis |
| 2025-01-05 | FAIL | mno345 | Heuristic JS detection | False positives on static sites with analytics |
| 2025-01-05 | SUCCESS | pqr678 | Response header + DOM pattern check | 84% accuracy, 3.2s average |
| | | | | |

---

## 3. CONCLUSION DIFF (Complete When Closing)

### What did we learn?
1. Static extraction (newspaper3k) works for ~60% of sites
2. JS rendering is only needed for ~25% of sites, detectable via response headers
3. The remaining ~15% require domain-specific CSS selectors
4. Processing time is dominated by Playwright startup; connection pooling critical

### Was the hypothesis confirmed or refuted?
- [x] PARTIALLY CONFIRMED - Worked with modifications
- The hybrid approach works, but the 80/20 assumption was wrong (60/25/15 split)

### What advancement was achieved?
Developed a novel three-tier extraction architecture that achieves 84% accuracy with 3.2s average processing time. The key advancement is the response header analysis technique for predicting JS rendering requirements without parsing the DOM, reducing unnecessary Playwright invocations by 75%.

### Time Investment
- **Start Date:** 2025-01-03
- **End Date:** 2025-01-06
- **Estimated Hours:** 18
- **Billable SR&ED Hours:** 14 (excluding routine coding, testing)

---

## 4. ARTIFACTS & EVIDENCE

### Related Commits:
- abc123: Initial implementation
- def456: Fallback strategy (FAIL)
- ghi789: Playwright integration (FAIL - performance)
- jkl012: Pivot to selective rendering
- mno345: Heuristic detection (FAIL)
- pqr678: Final solution

### Screenshots/Logs:
- `/docs/extraction-accuracy-chart.png`
- `/logs/playwright-timing-analysis.log`

### External References:
- https://stackoverflow.com/q/12345 (showing no existing solution for multi-site extraction)
- https://github.com/newspaper/issues/789 (upstream acknowledges limitation)
- https://docs.diffbot.com/pricing (commercial alternative pricing)

---

## 5. T661 NARRATIVE FRAGMENT (Auto-Generated)

```
[Project: MirrorSource] [Experiment: EXP-001]

TECHNOLOGICAL UNCERTAINTY:
Standard NLP extraction libraries fail to achieve acceptable accuracy (>80%) 
across 170+ heterogeneous news domains due to inconsistent DOM structures, 
dynamic JavaScript rendering, and anti-scraping measures. No existing 
open-source or cost-effective commercial solution addresses this combination.

SYSTEMATIC INVESTIGATION:
We conducted iterative experiments testing: (1) newspaper3k alone (58% accuracy),
(2) readability-lxml fallback (62%), (3) full Playwright rendering (78% but 
12s/article), (4) selective Playwright with heuristic detection (unreliable),
and (5) response header analysis for render prediction (84% accuracy, 3.2s).

TECHNOLOGICAL ADVANCEMENT:
Developed a three-tier extraction architecture using response header analysis
to predict JavaScript rendering requirements. This reduces unnecessary browser
invocations by 75% while maintaining 84% extraction accuracy across the target
domain set. The advancement is the novel use of HTTP response patterns as a
proxy for DOM complexity.
```

---

*Template Version: 1.0 | Generated by SR&ED Pipeline*
