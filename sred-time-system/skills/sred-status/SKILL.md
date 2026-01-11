---
name: sred-status
description: Show current SR&ED experiment status, time logged, and active hypotheses. Use to check progress on investigations, review billable hours, or prepare for session end.
---

# SR&ED Status Check

## Trigger

Use `/sred-status` when:
- Checking progress on active experiments
- Reviewing logged time before ending session
- Preparing summary for documentation

## Workflow

### Step 1: Scan Active Experiments

Check `.sred/active_experiments/` for `EXP-*.md` files.

For each:
- Extract Status (Active/Pending)
- Extract Hypothesis ID
- Extract Start timestamp
- Count commits with that hypothesis ID

### Step 2: Calculate Time

Run the time logger:

```bash
python ~/.claude/scripts/sred_logger.py --json
```

Parse output for:
- Total eligible hours
- Per-session breakdown
- In-progress sessions

### Step 3: Display Summary

```
📊 SR&ED Status Report
━━━━━━━━━━━━━━━━━━━━━

Active Experiments: N
Total Hours Logged: X.XX

┌─────────┬────────────────────────┬───────┬────────┐
│ ID      │ Hypothesis             │ Hours │ Status │
├─────────┼────────────────────────┼───────┼────────┤
│ EXP-001 │ DOM extraction via...  │ 2.50  │ 🔬     │
│ EXP-002 │ Dual-agent consensus   │ 1.25  │ ✅     │
└─────────┴────────────────────────┴───────┴────────┘

Recent Activity:
- 10:30 exp:EXP-001 Started DOM testing
- 11:45 obs:EXP-001 Partial success on NYT
- 12:20 fail:EXP-001 Bloomberg paywall blocks

Next Action: [Pivot/Continue/Close experiment]
```

### Step 4: Suggest Actions

If experiment is stale (>24h since last commit):
> "EXP-001 has no activity in 24+ hours. Close with `pivot:` or `succeed:` to properly log time."

If many active experiments:
> "You have 3 active experiments. Consider closing completed ones before starting new investigations."

## No Active Experiments

If `.sred/active_experiments/` is empty:

```
📊 SR&ED Status: No active experiments

To start an experiment, use /sred-init

Past experiments: [count] in .sred/completed_experiments/
Total logged hours: X.XX (run sred_logger.py for details)
```
