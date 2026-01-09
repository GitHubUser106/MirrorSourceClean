# SR&ED Evidence Pipeline

> "The claim is not written at tax time — it's generated while you code."

This is a portable SR&ED (Scientific Research & Experimental Development) evidence capture system for Canadian R&D tax credits. Drop the `.sred/` folder into any project to automate T661 evidence generation.

## Quick Start

```bash
# 1. Copy .sred/ folder to your project root
cp -r .sred/ ~/your-project/

# 2. Edit config.json with your project details
nano .sred/config.json

# 3. Start an experiment (the "Uncertainty Gate")
python .sred/sred_logger.py new "Can we extract keywords from 170+ news sites with inconsistent DOM structures?"

# 4. Code with tagged commits
git commit -m "exp:EXP-001 Starting DOM parsing investigation"
git commit -m "fail:EXP-001 BeautifulSoup choked on dynamic content"
git commit -m "pivot:EXP-001 Trying Playwright for JS rendering"
git commit -m "succeed:EXP-001 Hybrid approach works for 90% of sites"

# 5. Scan git and update experiments
python .sred/sred_logger.py scan

# 6. Close experiment when done
python .sred/sred_logger.py close EXP-001

# 7. Generate monthly evidence report
python .sred/sred_logger.py report
```

## The Three Pillars of SR&ED

### 1. Technological Uncertainty
- What you don't know how to do
- Why Google/StackOverflow doesn't have the answer
- Document this BEFORE you write code

### 2. Systematic Investigation  
- The experiments you ran
- The failures (these are BILLABLE!)
- The pivots based on what you learned

### 3. Technological Advancement
- What you figured out
- Even "this approach doesn't work" is an advancement
- New knowledge that didn't exist before your work

## Commands

| Command | Description |
|---------|-------------|
| `new "uncertainty"` | Create new experiment (Uncertainty Gate) |
| `log EXP-001 "tried" "result"` | Add manual log entry |
| `scan [days]` | Scan git for tagged commits (default: 30 days) |
| `close EXP-001` | Close experiment, move to completed |
| `report [YYYY-MM]` | Generate monthly evidence report |
| `status` | Show active experiments and recent activity |

## Commit Tags

Use these prefixes in your git commits to auto-capture evidence:

| Tag | Meaning | Example |
|-----|---------|---------|
| `exp:` | Starting investigation | `exp:EXP-001 Beginning URL extraction tests` |
| `fail:` | Something didn't work (BILLABLE!) | `fail:EXP-001 Regex approach fails on paywalls` |
| `pivot:` | Changing approach based on learning | `pivot:EXP-001 Switching from regex to AST parsing` |
| `succeed:` | Approach worked | `succeed:EXP-001 Hybrid solution handles 95% of cases` |
| `hyp:` | Documenting hypothesis | `hyp:EXP-001 Metadata patterns may reveal AI content` |
| `conclude:` | Documenting conclusion | `conclude:EXP-001 DOM inconsistency requires per-site config` |

## Folder Structure

```
.sred/
├── config.json              # Project metadata & settings
├── sred_logger.py           # The CLI tool
├── templates/
│   └── experiment_manifest.md
├── active_experiments/      # Current investigations
│   └── EXP-001.md
├── completed_experiments/   # Closed investigations
│   └── EXP-002.md
└── evidence/
    └── monthly/
        └── 2025-01_evidence.md
```

## Integration with Claude Workflow

### Starting a Session
Tell Claude: **"Start SR&ED Mode for [topic]"**

Claude will:
1. Run `sred_logger.py new "uncertainty description"`
2. Open the manifest for you to complete the Uncertainty Gate
3. Remind you of the commit tag convention

### During Development
Code normally, but commit with tags:
```bash
git commit -m "fail:EXP-001 Approach X failed because Y"
```

### Ending a Session
Tell Claude: **"Wrap up SR&ED"**

Claude will:
1. Run `sred_logger.py scan` to capture git activity
2. Run `sred_logger.py close EXP-XXX` if experiment is done
3. Generate a summary of evidence captured

## Portability

To use in a new project:

1. Copy the `.sred/` folder to the new project root
2. Edit `config.json`:
   - Update project name, company, fiscal year
   - Adjust technological domains for the new project
3. The logger auto-detects the `.sred/` directory by walking up from cwd

## T661 Mapping

| SR&ED Requirement | Pipeline Component |
|-------------------|-------------------|
| Line 242: Technological Uncertainties | `experiment_manifest.md` Section 1 |
| Line 244: Systematic Investigation | Investigation Log + Git Tags |
| Line 246: Technological Advancement | `experiment_manifest.md` Section 3 |
| Supporting Evidence | Monthly reports + commit history |

## Pro Tips

1. **Failures are gold** — Every `fail:` commit is billable investigation time
2. **Be specific** — "Didn't work" isn't evidence. "Returned 500 error on sites with Cloudflare" is.
3. **Link external refs** — StackOverflow links showing "no known solution" strengthen your claim
4. **Separate routine from R&D** — Only tag commits that are genuine investigation, not standard coding

---

*Built for Vibecoding • Compatible with Boast.ai SR&ED claims*
