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
