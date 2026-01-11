---
name: sred-init
description: Initialize a new SR&ED experiment with proper uncertainty gate documentation. Use when starting any new experimental work, testing a hypothesis, or investigating technological uncertainty. Creates EXP-XXX.md manifest with hypothesis, failure conditions, and tracking structure.
---

# SR&ED Experiment Initialization

## Trigger

Use `/sred-init` when:
- Starting investigation into a technological uncertainty
- Testing a new approach or hypothesis
- Beginning work that might fail and require pivoting

## Workflow

### Step 1: Gather Uncertainty

Ask the developer:

1. **What don't we know?** (The technological uncertainty)
2. **Why can't existing solutions solve this?** (Google/StackOverflow gap)
3. **What's your hypothesis?** Format: "We believe that [approach] will [outcome] because [reasoning]"
4. **What would prove us wrong?** (Failure condition)

### Step 2: Generate Experiment Manifest

Create `.sred/active_experiments/EXP-XXX.md`:

```markdown
# EXP-XXX: [Brief Title]

**Status:** 🔬 Active
**Started:** [ISO timestamp]
**Hypothesis ID:** EXP-XXX

## Uncertainty Gate

### Technological Uncertainty
[What we don't know - must be non-trivial]

### Why Existing Solutions Fail
[Why Google/StackOverflow/existing tools don't solve this]

### Hypothesis
We believe that [specific approach] will [expected outcome] because [technical reasoning].

### Failure Condition
This hypothesis is **refuted** if:
- [Specific measurable failure criterion]
- [Maximum attempts before pivot: N]

### Success Condition
This hypothesis is **confirmed** if:
- [Specific measurable success criterion]

## Investigation Log

| Time | Action | Result | Commit |
|------|--------|--------|--------|
| | exp: Starting investigation | | |

## Observations

[Record unexpected behaviors, partial successes, insights]

## Conclusion

**Outcome:** [PENDING | CONFIRMED | REFUTED | PIVOTED]
**Hours Logged:** [Auto-calculated by sred_logger.py]
**Advancement:** [What was learned, even from failure]
```

### Step 3: Start Commit

Make the opening commit:

```bash
git add .sred/active_experiments/EXP-XXX.md
git commit -m "exp:EXP-XXX [Brief description of hypothesis being tested]"
```

### Step 4: Provide Developer Instructions

Tell the developer:

> **Experiment EXP-XXX initialized.**
> 
> During investigation, use these commit tags:
> - `obs:EXP-XXX` - Observations during testing
> - `test:EXP-XXX` - Running specific tests
> - `fail:EXP-XXX` - Hypothesis refuted (BILLABLE - explain why)
> - `pivot:EXP-XXX` - Changing approach based on learnings
> - `succeed:EXP-XXX` - Hypothesis confirmed
> 
> Failure is valuable! Document what didn't work and why.

## Experiment ID Assignment

Check `.sred/active_experiments/` for existing experiments. Assign next sequential ID:
- If EXP-001 exists → create EXP-002
- Format: EXP-XXX (3 digits, zero-padded)

## Directory Structure

Ensure project has:

```
.sred/
├── active_experiments/
│   └── EXP-XXX.md
├── completed_experiments/
└── config.json
```

## Failure Conditions for This Skill

If developer cannot articulate:
- A genuine uncertainty (not just "I don't know how to code X")
- Why existing solutions don't work

Then **do not create experiment**. The work may be standard implementation, not SR&ED-eligible investigation.

Push back with: "This sounds like implementation of known techniques. What's the technological uncertainty—the thing that might not work even with best practices?"
