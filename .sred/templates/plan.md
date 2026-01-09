# Plan: {{TITLE}}

> **Experiment:** {{EXP_ID}}
> **Date:** {{DATE}}
> **Status:** 🔄 In Progress

---

## SR&ED Context

**Technological Uncertainty:**
{{UNCERTAINTY - paste from experiment manifest}}

**Current Hypothesis:**
{{HYPOTHESIS - what we believe will work and why}}

**Failure Mode We're Testing:**
{{What would prove the hypothesis wrong?}}

---

## Objective

{{Clear, specific statement of what we're trying to build/prove}}

---

## Acceptance Criteria

- [ ] {{Criterion 1 - measurable/testable}}
- [ ] {{Criterion 2}}
- [ ] {{Criterion 3}}

---

## Technical Approach

### Phase 1: {{Phase Name}}
{{Description of approach}}

### Phase 2: {{Phase Name}}
{{Description of approach}}

---

## Constraints

- {{Constraint 1 - e.g., "Must process in <5 seconds"}}
- {{Constraint 2}}

## Non-Goals

- {{What we're explicitly NOT trying to do}}

---

## Commit Convention

**All commits for this work must be prefixed with the experiment ID.**

| Situation | Prefix | Example |
|-----------|--------|---------|
| Starting investigation | `exp:{{EXP_ID}}` | `exp:{{EXP_ID}} Initial implementation of X` |
| Something failed | `fail:{{EXP_ID}}` | `fail:{{EXP_ID}} Approach X returned Y error because Z` |
| Changing approach | `pivot:{{EXP_ID}}` | `pivot:{{EXP_ID}} Switching from X to Y based on Z` |
| Approach worked | `succeed:{{EXP_ID}}` | `succeed:{{EXP_ID}} Achieved 85% accuracy with approach X` |

---

## Files to Modify

- `{{path/to/file1}}`
- `{{path/to/file2}}`

## New Files to Create

- `{{path/to/new/file}}`

---

## Testing Strategy

{{How will we know if this works?}}

---

## Notes for Claude Code

{{Any additional context, quirks of the codebase, or things to watch out for}}

---

## Post-Implementation

When complete:
1. Run `python .sred/sred_logger.py scan` to capture commits
2. Update experiment manifest with results
3. If experiment is done, run `python .sred/sred_logger.py close {{EXP_ID}}`

---

*This plan is part of SR&ED Experiment {{EXP_ID}}. All work is being documented for R&D tax credit purposes.*
