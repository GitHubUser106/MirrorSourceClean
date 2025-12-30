# 🎵 Project MirrorSource: Orchestration Plan

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, TypeScript 5, Tailwind 3.4, Brave Search API, Gemini AI.
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.
* **Coding Style:** "Vibecoding" — prioritize speed and functioning prototypes.
* **New Capability:** Playwright MCP for visual verification and self-correction.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Integrate Playwright MCP - Give Claude Code "Eyes"

### Context
> **The Problem:** UI changes require manual verification via Vercel deployment, screenshots, and back-and-forth descriptions. This slows iteration and misses bugs.
> **The Solution:** Integrate Playwright MCP so Claude Code can control a browser, take screenshots, and visually verify its own work before committing.
> **The Outcome:** An "Iterative Agentic Loop" where Claude writes code → screenshots → self-corrects → commits only when visually verified.

### Execution Checklist

- [ ] **Step 0 (Prerequisites):** **(Conductor Action)**
    * Ensure Claude Code is installed and working
    * Ensure `npm run dev` works locally on port 3000

- [ ] **Step 1 (Install Playwright MCP):**
    * Install Playwright MCP server following Anthropic's MCP documentation
    * Add to Claude Code's MCP configuration (typically in `~/.claude/mcp.json` or similar):
```json
    {
      "mcpServers": {
        "playwright": {
          "command": "npx",
          "args": ["@anthropic-ai/mcp-playwright"]
        }
      }
    }
```
    * Restart Claude Code to load the new MCP
    * Verify connection: Ask Claude to "Open a browser and navigate to google.com"

- [ ] **Step 2 (Create Design Memory):** Add to project `claude.md` or `CLAUDE.md`:
```markdown
    ## MirrorSource Design System

    ### Color Palette (Political Lean)
    - Left: Blue (#2563eb / bg-blue-600)
    - Center-Left: Cyan (#06b6d4 / bg-cyan-500)
    - Center: Purple (#a855f7 / bg-purple-500)
    - Center-Right: Orange (#f97316 / bg-orange-500)
    - Right: Red (#dc2626 / bg-red-600)

    ### Component Standards
    - Border radius: rounded-lg (8px)
    - Card shadows: shadow-sm on hover
    - Flip cards: CSS 3D transform, 0.4s ease
    - Badges: rounded-full, px-2 py-0.5, text-xs font-medium

    ### Responsive Breakpoints
    - Mobile: 1 column (< 640px)
    - Tablet: 2 columns (640px - 1024px)
    - Desktop: 3-4 columns (> 1024px)

    ### Accessibility Requirements
    - Minimum tap target: 44px × 44px
    - Links must have e.stopPropagation() to prevent parent click handlers
    - No empty cards - always show snippet fallback
    - Sufficient color contrast (WCAG AA)

    ### Visual Verification Checklist
    Before committing any UI change, verify:
    1. Coverage Distribution chart renders all 5 bars
    2. Source Analysis cards flip on click
    3. "Verify on Wikipedia" links are clickable without flipping card
    4. No HTML tags visible in text content
    5. Mobile layout is single column
    6. No console errors
```

- [ ] **Step 3 (Create Visual Test Workflow):** Add to `claude.md`:
```markdown
    ## Visual Testing Protocol (Use Playwright MCP)

    ### After ANY UI Change:
    1. Start dev server: `npm run dev`
    2. Wait for server ready on localhost:3000

    ### Desktop Verification (1440px viewport):
    3. Navigate to http://localhost:3000
    4. Take screenshot: "homepage-desktop.png"
    5. Paste a test URL and click Analyze
    6. Wait for results to load
    7. Take screenshot: "results-desktop.png"
    8. Verify Coverage Distribution shows 5 colored bars
    9. Click a Source Analysis card to flip it
    10. Take screenshot: "card-flipped-desktop.png"
    11. Verify SOURCE TRANSPARENCY content is visible
    12. Click "Verify on Wikipedia" - confirm it opens link (not flips card)

    ### Mobile Verification (390px viewport - iPhone 15):
    13. Set viewport to 390x844
    14. Navigate to http://localhost:3000
    15. Take screenshot: "homepage-mobile.png"
    16. Run same test search
    17. Take screenshot: "results-mobile.png"
    18. Verify grid is single column
    19. Tap a card to flip
    20. Take screenshot: "card-flipped-mobile.png"
    21. Verify tap targets are accessible

    ### Console Check:
    22. Check browser console for errors
    23. Report any errors before committing

    ### Only commit if all checks pass.
```

- [ ] **Step 4 (Create Design Reviewer Sub-Agent):** Create `agents/design-reviewer.md`:
```markdown
    # Design Reviewer Agent

    ## Persona
    You are a Senior UI/UX Designer with 10 years of experience in news media applications.
    You have a keen eye for visual polish, accessibility, and mobile-first design.

    ## Tools Available
    - Playwright MCP (browser control, screenshots, console logs)
    - File system (read code)

    ## Task
    When asked to review, perform a comprehensive UI audit:

    ### Step 1: Visual Inspection
    - Open the app at localhost:3000 (or provided URL)
    - Take screenshots at 1440px, 1024px, 768px, and 390px widths
    - Note any layout breaks, overflow issues, or visual bugs

    ### Step 2: Interaction Testing
    - Test all clickable elements
    - Verify flip cards work correctly
    - Check that links open without side effects
    - Test form submissions

    ### Step 3: Accessibility Check
    - Verify tap targets are minimum 44px
    - Check color contrast
    - Ensure text is readable at all sizes

    ### Step 4: Console Audit
    - Check for JavaScript errors
    - Check for failed network requests
    - Note any warnings

    ## Output Format
```
    # Design Review Report

    **Overall Grade:** [A/B/C/D/F]

    ## Critical Issues (Must Fix)
    - [Issue 1]
    - [Issue 2]

    ## Recommended Improvements
    - [Suggestion 1]
    - [Suggestion 2]

    ## What's Working Well
    - [Positive 1]
    - [Positive 2]

    ## Screenshots
    [Attach relevant screenshots]
```
```

- [ ] **Step 5 (Test the Integration):**
    * Ask Claude Code: "Use Playwright to open localhost:3000 and take a screenshot"
    * Ask Claude Code: "Run the Visual Testing Protocol from claude.md"
    * Ask Claude Code: "Act as the Design Reviewer agent and audit the current UI"

- [ ] **Step 6 (Document in README):** Add section to README.md:
```markdown
    ## Development with Visual Verification

    This project uses Playwright MCP to give Claude Code visual testing capabilities.

    ### Running Visual Tests
    Ask Claude Code:
    - "Take a screenshot of the current UI"
    - "Run the visual testing protocol"
    - "Review the design as the Design Reviewer agent"

    ### Design System
    See `claude.md` for color palette, component standards, and visual requirements.
```

- [ ] **Step 7 (Commit):**
```bash
    git add . && git commit -m "Add Playwright MCP integration for visual testing" && git push
```

### Success Criteria
- [ ] Claude Code can open browser and navigate to localhost:3000
- [ ] Claude Code can take screenshots at different viewport sizes
- [ ] Claude Code can read console errors
- [ ] Claude Code self-verifies UI changes before suggesting commits
- [ ] Design Reviewer agent produces useful audit reports
- [ ] Visual Testing Protocol catches bugs before deployment

### Future Enhancements
- [ ] Automated visual regression testing (compare before/after screenshots)
- [ ] Integration with Vercel preview deployments
- [ ] Parallel testing with Git Worktrees (run 3 design variations simultaneously)
- [ ] Team-shared Design Reviewer MCP for PR reviews