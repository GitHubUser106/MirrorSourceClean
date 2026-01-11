# MirrorSource R&D Lab Notebook

> **Purpose:** Automatic capture of SR&ED-eligible research and development work.
> **Maintained by:** Claude Code (automated)
> **Export:** `python .sred/sred_logger.py --year YYYY --format boast`

---

## Technological Domains

| ID | Domain | Description |
|----|--------|-------------|
| TD-001 | Cross-Domain Extraction | Universal extraction across 170+ heterogeneous news site architectures |
| TD-002 | Multi-LLM Orchestration | Prompt-chaining optimization, context management, hallucination mitigation |
| TD-003 | AI Content Detection | Metadata signature analysis, publication pattern anomalies |
| TD-004 | Political Bias Classification | Spectrum positioning algorithms, source credibility scoring |

---

## Log Entries

<!--
Entry Format:
## YYYY-MM-DD | Domain ID | Brief Title
**Uncertainty:** What we didn't know
**Hypothesis:** What we believed might work
**Approach:** What we tried
**Outcome:** SUCCESS / PARTIAL / FAILED - What happened
**Commits:** Related commit hashes
**Time:** Approximate hours
-->

---

## 2026-01-09 | TD-001 | Chrome Web Store Screenshot CSS Loading

**Uncertainty:** Playwright MCP screenshots showed unstyled content (black bars) despite dev server running.

**Hypothesis:** CSS might not be loading due to stale browser connections or server state.

**Approach:**
1. Initial attempt: Refresh page - failed
2. Second attempt: Wait for load - failed
3. Third attempt: Kill server, restart, close browser, reopen - success

**Outcome:** SUCCESS - Issue was stale WebSocket connections between Playwright browser and Next.js dev server. Fresh restart resolved.

**Commits:** bb81275

**Time:** ~1 hour

---

## 2026-01-11 | TD-004 | Gemini Grounded Search for Gap-Targeted Source Discovery (E10)

**Uncertainty:** Can Gemini's Google Search grounding provide alternative source discovery when Brave Search and RSS feeds fail to find right-leaning coverage?

**Hypothesis:** Using `googleSearch` tool with site: operators targeting right-leaning domains will surface articles from a different search index than Brave, providing fallback coverage.

**Approach:**
1. Implemented `geminiGroundedSearch()` function using Gemini 2.0 Flash with `googleSearch` tool
2. Extract URLs from `groundingMetadata.groundingChunks`
3. Trigger only when Right + Center-Right < 2 sources after primary quad-query
4. Added unknown source logging for database expansion

**Outcome:** SUCCESS (IMPLEMENTED) - Gap-fill mechanism ready as fallback. Testing showed primary system (E5+E6+E8+E9) now robust enough that fallback rarely triggers. All test searches returned adequate right-side coverage (2-5 sources).

**Commits:** a3e141c

**Time:** ~2 hours

---
