# Technical Appendix - MirrorSource Handover Document

**Date:** January 9, 2026
**Project:** MirrorSource Web Application
**Repo:** https://github.com/GitHubUser106/MirrorSourceClean

---

## 1. Global Claude Code Installation (`~/.claude/`)

### 1.1 Directory Structure

```
~/.claude/
├── CLAUDE.md                    # Global instructions (UI/UX, commit standards, Playwright protocol)
├── settings.json                # Claude Code settings
├── hooks.json                   # Git hook configurations
├── skills/                      # Custom slash commands
│   ├── ralph/SKILL.md          # /ralph - Automated SR&ED retry loop
│   ├── sred-init/SKILL.md      # /sred-init - Initialize SR&ED tracking
│   └── sred-status/SKILL.md    # /sred-status - View SR&ED time report
├── scripts/
│   ├── sred_logger.py          # Time calculation engine (7.3KB)
│   ├── sred-post-commit.sh     # Auto-logging git hook
│   └── ralph-wiggum/
│       ├── detectors.py        # Safety detection (stuck, oscillation, integrity)
│       └── orchestrator.py     # Ralph loop orchestration
└── templates/
    └── TIME_LOG.md             # SR&ED time tracking template
```

### 1.2 Global CLAUDE.md Features

- **Code Quality Standards:** TypeScript strict mode, meaningful names, focused functions
- **UI/UX Standards:** Mobile-first (390px), 44px tap targets, loading/error states
- **Accessibility:** WCAG AA, 4.5:1 contrast, semantic HTML
- **Playwright MCP Protocol:** Auto-screenshot at desktop (1440px) and mobile (390px)
- **Commit Standards:** `feat:`, `fix:`, `ui:`, `refactor:`, `docs:`, `test:`, `chore:`
- **SR&ED Protocol:** Triggers experiment mode after 3+ failures on same problem

---

## 2. MirrorSource Project Setup (`.sred/`)

### 2.1 Directory Structure

```
MirrorSource-WebApp/.sred/
├── config.json                  # Project SR&ED configuration
├── ralph-config.json            # Ralph Wiggum mode settings
├── audit_trail.py               # Evidence capture script (16.5KB)
├── sred_logger.py               # Time calculation (20KB)
├── install.sh                   # One-time setup script
├── CLAUDE_INTEGRATION.md        # Integration documentation
├── README.md                    # SR&ED system overview
├── active_experiments/          # Current experiments
│   └── EXP-001-SAMPLE.md       # Sample experiment template
├── completed_experiments/       # Archived experiments
├── evidence/                    # Screenshots, logs, chat exports
├── templates/                   # Experiment templates
├── hooks/                       # Git hooks
└── ralph-runs/                  # Ralph iteration logs
```

### 2.2 SR&ED Configuration (`config.json`)

| Field | Value |
|-------|-------|
| Project Name | MirrorSource |
| Company | MirrorSource Inc. |
| Fiscal Year End | 2025-12-31 |
| Field of Science | 2.2 - Computer and Information Sciences |
| Evidence Retention | 7 years |

**Technological Domains:**
1. **TD-001:** Cross-Domain Content Extraction (170+ news site DOMs)
2. **TD-002:** Dual-LLM Orchestration (context window management)
3. **TD-003:** AI Content Detection (metadata patterns)

**AI Workflow:**
- Orchestrator: Claude Chat
- Challenger: Gemini
- Builder: Claude Code
- Refiner: ChatGPT

### 2.3 Ralph Configuration (`ralph-config.json`)

```json
{
  "experiment_id": "EXP-XXX",
  "hypothesis": "Update before running /ralph",
  "test_command": "npm run test:run",
  "target_files": ["src/lib/sourceData.ts"],
  "limits": {
    "max_iterations": 10,
    "timeout_minutes": 30,
    "stuck_threshold": 3,
    "checkpoint_at": 5
  }
}
```

---

## 3. Vitest Testing Framework

### 3.1 Configuration (`vitest.config.ts`)

```typescript
{
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts,tsx}']
  }
}
```

### 3.2 Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `tests/sourceData.test.ts` | 17 | Source data utilities |
| `tests/rate-limiter.test.ts` | 11 | Rate limiting logic |
| **Total** | **28** | All passing |

### 3.3 Commands

```bash
npm run test        # Watch mode
npm run test:run    # Single run (CI)
npm run test:coverage  # With coverage report
```

---

## 4. Key Commands Reference

### 4.1 Claude Code Skills (Slash Commands)

| Command | Description |
|---------|-------------|
| `/ralph` | Start automated SR&ED retry loop |
| `/sred-init` | Initialize SR&ED tracking in project |
| `/sred-status` | View SR&ED time report from git history |

### 4.2 SR&ED Scripts

```bash
# Generate time report from git commits
python .sred/sred_logger.py --since 2025-01-01 --format markdown

# Capture audit evidence
python .sred/audit_trail.py capture --experiment EXP-001

# Auto-log on commit (via git hook)
.sred/hooks/post-commit.sh
```

### 4.3 Development Commands

```bash
npm run dev         # Start dev server (port 3000)
npm run build       # Production build
npm run lint        # ESLint
npm run test:run    # Run all tests
```

### 4.4 Git Commit Tags (SR&ED)

| Tag | Purpose | Example |
|-----|---------|---------|
| `exp:` | Start experiment | `exp: [EXP-001] Testing DOM parser approach` |
| `fail:` | Record failure | `fail: [EXP-001] Approach X failed due to Y` |
| `pivot:` | Change strategy | `pivot: [EXP-001] Switching from X to Y` |
| `succeed:` | Resolution | `succeed: [EXP-001] Resolved via Z` |

---

## 5. Current State of Experiments

### 5.1 Active Experiments

| ID | Status | Description |
|----|--------|-------------|
| EXP-001-SAMPLE | Template | Sample experiment (not started) |

**No active experiments in progress.** Ralph Wiggum mode is configured and ready.

### 5.2 Ralph Wiggum Safety Features

- **Stuck Detection:** Triggers after 3 identical errors
- **Oscillation Detection:** Detects code cycling back to previous states
- **Integrity Check:** Ensures test count doesn't decrease
- **Checkpoint Prompts:** User confirmation at iteration 5

### 5.3 Test Suite Status

```
✓ tests/rate-limiter.test.ts (11 tests) 4ms
✓ tests/sourceData.test.ts (17 tests) 6ms

Test Files  2 passed (2)
Tests       28 passed (28)
Duration    713ms
```

---

## 6. Environment Dependencies

### 6.1 Node Packages (MirrorSource)

**Production:**
- next@14.2.5
- react@18
- @google/genai (Gemini AI)
- lucide-react (icons)
- @vercel/analytics

**Development:**
- vitest@4.0.16
- @vitejs/plugin-react
- @testing-library/react@16.3.1
- @testing-library/jest-dom
- jsdom@27.4.0
- typescript@5

### 6.2 External Services

| Service | Purpose |
|---------|---------|
| Google Gemini | AI analysis |
| Brave Search API | Article search |
| Vercel | Deployment |
| GitHub | Source control |

---

## 7. Quick Start for New Session

```bash
# 1. Navigate to project
cd ~/Desktop/MirrorSource-WebApp

# 2. Start dev server
npm run dev

# 3. Run tests to verify
npm run test:run

# 4. Check SR&ED status (if applicable)
python .sred/sred_logger.py --format markdown

# 5. Start Ralph mode for experiment
# (update .sred/ralph-config.json first)
# Then say: /ralph
```

---

## 8. Files Modified This Session

| File | Change |
|------|--------|
| `src/app/demo/page.tsx` | Created - Chrome Web Store demo page |
| `chrome-store-hero.png` | Created - Marketing screenshot |
| `chrome-store-intel-brief.png` | Created - Marketing screenshot |
| `chrome-store-sources.png` | Created - Marketing screenshot |
| `vitest.config.ts` | Created - Vitest configuration |
| `tests/setup.ts` | Created - Test setup |
| `tests/sourceData.test.ts` | Created - 17 tests |
| `tests/rate-limiter.test.ts` | Created - 11 tests |
| `.sred/ralph-config.json` | Created - Ralph configuration |

---

*Generated: January 9, 2026*
