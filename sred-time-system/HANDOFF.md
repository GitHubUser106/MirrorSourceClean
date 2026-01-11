# SR&ED Time Tracking System - Handoff to Claude Code

## What This Is

A complete system for tracking SR&ED-eligible developer time through git commits. Measures **human wall-clock time** (your investigation work), not AI processing time.

## Components to Install

### 1. Time Logger Script

**Source:** `scripts/sred_logger.py`
**Install to:** `~/.claude/scripts/sred_logger.py`

```bash
cp scripts/sred_logger.py ~/.claude/scripts/
chmod +x ~/.claude/scripts/sred_logger.py
```

**What it does:**
- Scans git history for SR&ED-tagged commits
- Groups commits into sessions (exp: → succeed:/fail:/pivot:)
- Calculates time deltas with gap protection (>4h capped to 1h)
- Generates auditor-friendly TIME_LOG.md

**Usage:**
```bash
# Generate time report for current repo
python ~/.claude/scripts/sred_logger.py

# Output to file
python ~/.claude/scripts/sred_logger.py --output docs/sred/TIME_LOG.md

# Filter by date range
python ~/.claude/scripts/sred_logger.py --since 2025-01-01 --until 2025-03-31

# JSON output for automation
python ~/.claude/scripts/sred_logger.py --json
```

### 2. Post-Commit Hook

**Source:** `scripts/post-commit.sh`
**Install to:** `~/.claude/scripts/sred-post-commit.sh`

```bash
cp scripts/post-commit.sh ~/.claude/scripts/sred-post-commit.sh
chmod +x ~/.claude/scripts/sred-post-commit.sh
```

**What it does:**
- Triggers on every commit
- Detects SR&ED tags (exp:, fail:, pivot:, succeed:, obs:, test:, stop:)
- Calculates time since previous SR&ED commit
- Appends entry to docs/sred/TIME_LOG.md

### 3. Claude Code Hook Configuration

**Source:** `claude-hooks.json`
**Install to:** `~/.claude/hooks.json`

```bash
# Merge with existing hooks or create new
cp claude-hooks.json ~/.claude/hooks.json
```

### 4. Custom Skills

**Source:** `skills/sred-init/SKILL.md` and `skills/sred-status/SKILL.md`
**Install to:** `~/.claude/skills/`

```bash
mkdir -p ~/.claude/skills
cp -r skills/sred-init ~/.claude/skills/
cp -r skills/sred-status ~/.claude/skills/
```

**Commands added:**
- `/sred-init` - Start new experiment with uncertainty gate
- `/sred-status` - Check active experiments and logged time

### 5. TIME_LOG.md Template

**Source:** `templates/TIME_LOG.md`
**Use:** Copy to each project's `docs/sred/` directory

---

## Directory Structure After Installation

```
~/.claude/
├── scripts/
│   ├── sred_logger.py      # Time calculation engine
│   └── sred-post-commit.sh # Auto-logging hook
├── skills/
│   ├── sred-init/
│   │   └── SKILL.md        # /sred-init command
│   └── sred-status/
│       └── SKILL.md        # /sred-status command
└── hooks.json              # Hook configuration
```

Each project:
```
project-root/
├── .sred/
│   ├── active_experiments/
│   │   └── EXP-001.md
│   ├── completed_experiments/
│   └── config.json
├── docs/
│   └── sred/
│       └── TIME_LOG.md
└── ...
```

---

## Commit Tag Reference

| Tag | Meaning | Billable? |
|-----|---------|-----------|
| `exp:EXP-XXX` | Starting experiment/hypothesis test | Yes |
| `obs:EXP-XXX` | Recording observation during testing | Yes |
| `test:EXP-XXX` | Running specific test | Yes |
| `fail:EXP-XXX` | Hypothesis refuted | **Yes** (valuable learning) |
| `pivot:EXP-XXX` | Changing approach based on learnings | Yes |
| `succeed:EXP-XXX` | Hypothesis confirmed | Yes |
| `stop:` | Explicit session end (optional) | Closes session |

**Format:** `tag:HYPOTHESIS-ID Description`

**Example commits:**
```
exp:EXP-001 Testing content-based DOM extraction for news articles
obs:EXP-001 NYT article structure differs from expected - nested divs
fail:EXP-001 Generic selector approach fails on 40% of sites
pivot:EXP-001 Switching to site-specific extraction strategies
succeed:EXP-001 Hybrid approach achieves 85% extraction rate
```

---

## Gap Protection Rule

**Problem:** Without protection, starting Friday at 5pm and finishing Monday at 9am would log 64 hours.

**Solution:** Any gap between commits exceeding 4 hours is capped at 1.0 hour.

```python
if gap_hours > 4:
    credited = 1.0
else:
    credited = gap_hours
```

**Rationale:** Assumes developer was not actively investigating during long gaps (sleep, breaks, weekends). The 1-hour credit accounts for "getting back up to speed" time.

---

## Quick Start for New Project

```bash
# 1. Initialize project SR&ED structure
mkdir -p .sred/active_experiments .sred/completed_experiments docs/sred
cp ~/.claude/templates/TIME_LOG.md docs/sred/

# 2. Create .sred/config.json
cat > .sred/config.json << EOF
{
  "projectName": "Your Project Name",
  "fiscalYear": 2025,
  "technologicalDomain": "Your Domain",
  "startDate": "$(date -I)"
}
EOF

# 3. Start first experiment
# Use /sred-init or manually create EXP-001.md

# 4. Make commits with SR&ED tags
git commit -m "exp:EXP-001 Initial hypothesis testing"

# 5. Generate time report
python ~/.claude/scripts/sred_logger.py --output docs/sred/TIME_LOG.md
```

---

## Verification Commands

After installation, verify:

```bash
# Check scripts exist
ls -la ~/.claude/scripts/sred_*.py ~/.claude/scripts/sred_*.sh

# Check skills exist
ls -la ~/.claude/skills/sred-*/SKILL.md

# Test time logger on any repo with commits
cd ~/Desktop/MirrorSource-WebApp
python ~/.claude/scripts/sred_logger.py

# Check hook config
cat ~/.claude/hooks.json
```

---

## What John Does vs What Claude Code Does

**John (Orchestrator Chat):**
- Identifies technological uncertainties
- Formulates hypotheses
- Decides when to pivot or conclude
- Reviews generated documentation for T661 accuracy

**Claude Code:**
- Executes /sred-init to create experiment manifests
- Makes commits with proper SR&ED tags
- Runs sred_logger.py to generate time reports
- Updates experiment logs during investigation

**The Hook (Automatic):**
- Detects SR&ED commits
- Calculates time deltas
- Appends to TIME_LOG.md
- No manual intervention required

---

## First Task After Installation

1. Install all components per instructions above
2. Run `/sred-status` in any project to verify skills work
3. Make a test commit: `git commit --allow-empty -m "exp:TEST-001 Verifying SR&ED tracking"`
4. Check that TIME_LOG.md was updated
5. Report back: "SR&ED time tracking system verified"
