# Claude Integration Commands

Use these phrases to trigger SR&ED workflow in Claude Chat:

---

## Starting a Session

**Say:** "Start SR&ED Mode for [topic]"

**Claude will:**
1. Ask clarifying questions about the technological uncertainty
2. Run `sred_logger.py new` with your uncertainty
3. Remind you of the commit convention
4. Set context for the investigation

**Example:**
> "Start SR&ED Mode for implementing AI content detection"

---

## During Development

**Say:** "Log SR&ED: [what you tried] → [what happened]"

**Claude will:**
1. Help you phrase it for T661 compliance
2. Suggest the appropriate commit tag
3. Run `sred_logger.py log` if needed

**Example:**
> "Log SR&ED: Tried using GPTZero API → Returns inconsistent results for short articles"

---

## Recording a Failure

**Say:** "SR&ED Fail: [description]"

**Claude will:**
1. Help you document WHY it failed (this is the valuable part)
2. Suggest a git commit message
3. Ask about next steps (pivot or persist)

**Example:**
> "SR&ED Fail: The metadata-only approach can't distinguish AI content without text analysis"

---

## Pivoting

**Say:** "SR&ED Pivot: [old approach] → [new approach]"

**Claude will:**
1. Document the learning that triggered the pivot
2. Update the experiment log
3. Help formulate the new hypothesis

**Example:**
> "SR&ED Pivot: From metadata patterns → to stylometric analysis"

---

## Ending a Session

**Say:** "Wrap up SR&ED"

**Claude will:**
1. Run `sred_logger.py scan` to capture today's commits
2. Ask if the experiment should be closed
3. Generate a summary of evidence captured
4. Remind you of any incomplete documentation

---

## Generating Reports

**Say:** "Generate SR&ED report for [month]"

**Claude will:**
1. Run `sred_logger.py report YYYY-MM`
2. Review the output for completeness
3. Suggest improvements to documentation

---

## Checking Status

**Say:** "SR&ED status"

**Claude will:**
1. Run `sred_logger.py status`
2. Summarize active experiments
3. Flag any that need attention

---

## Best Practices for Claude Code Integration

When working with Claude Code (the builder), include this context:

```
SR&ED MODE ACTIVE - Experiment: EXP-XXX

When committing, use these prefixes:
- exp: Starting new investigation
- fail: Something didn't work (document WHY)
- pivot: Changing approach
- succeed: Approach worked

Current hypothesis: [your hypothesis]
Current failure mode: [what we're trying to avoid]
```

This helps Claude Code generate appropriate commit messages automatically.

---

## Sample Session Flow

```
You: Start SR&ED Mode for cross-domain content extraction
Claude: [Creates EXP-002, asks clarifying questions]

You: [Work on code]
You: SR&ED Fail: BeautifulSoup can't handle React-rendered content
Claude: [Logs failure, suggests commit message]

You: SR&ED Pivot: Static parsing → Playwright for JS sites
Claude: [Documents pivot, updates experiment]

You: [More coding]
You: succeed:EXP-002 Hybrid approach achieves 84% accuracy

You: Wrap up SR&ED
Claude: [Scans commits, generates summary, asks about closing]
```
