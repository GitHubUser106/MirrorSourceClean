# 🎵 Project MirrorSource: Orchestration Plan

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, TypeScript 5, Tailwind 3.4, Brave Search API, Gemini AI.
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.
* **Coding Style:** "Vibecoding" — prioritize speed and functioning prototypes.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** UI Consolidation - Merge "Compare Coverage" + "More Sources" into Flip Cards

### Context
> **The Problem:** With typically <18 results, having separate "Compare Coverage" and "More Sources" sections creates redundancy and extra scrolling.
> **The Solution:** Consolidate into a single section of interactive flip cards.
> **The Strategy:**
> 1.  **Merge:** Combine all logic into one unified grid.
> 2.  **Flip Cards:** Front shows analysis; back shows ownership transparency.
> 3.  **Hybrid Data:** Use Gemini for ownership summaries + Wikipedia links for verification.

### Execution Checklist
- [ ] **Step 0 (Baseline):** **(Conductor Action)** Screenshot current "Compare" and "More Sources" sections for comparison.
- [ ] **Step 1 (Gemini Prompt Update):** In `src/app/api/find/route.ts` (or where the prompt lives), update the JSON schema request. Ask for these 3 new fields for *every* source:
    * `ownership_owner`: (String) Parent company or individual (e.g., "Warner Bros. Discovery").
    * `ownership_funding`: (String) Funding model (e.g., "Advertising + Cable Fees").
    * `ownership_tag`: (String/Enum) **Must match existing types:** "corporate", "nonprofit", "government", "public", "family", "billionaire", "cooperative".
- [ ] **Step 2 (Data Type Update):** Update the TypeScript interface (likely `ComparisonResult` or `Source`) to include these 3 new optional string fields.
- [ ] **Step 3 (Helper Function):** Add to `src/lib/sourceData.ts`:
    ```typescript
    export const getWikiLink = (sourceName: string): string =>
      `https://en.wikipedia.org/wiki/${sourceName.replace(/ /g, '_')}`;
    ```
- [ ] **Step 4 (Flip Card Component):** Create `src/components/SourceFlipCard.tsx`:
    * **Front:** Source Name, Favicon, Lean Badge, **Ownership Tag Badge** (using the new `ownership_tag`), Headline, Tone/Focus. Add a small "↻" or "ℹ️" icon.
    * **Back:** "Source Transparency" Header. Display Owner, Funding, and a **"Verify on Wikipedia →"** link (using `getWikiLink`).
    * **Interaction:** CSS 3D Flip (preserve 3D). Click/Tap to flip.
- [ ] **Step 5 (Layout Consolidation):** In `src/app/page.tsx`:
    * **Delete** the "More Sources" section.
    * **Rename** "Compare Coverage" to "Source Analysis".
    * **Grid:** Use the new `SourceFlipCard` for ALL results.
    * **Logic:** Pass all search results to this grid (removing any "Show Top 3" limits).
- [ ] **Step 6 (Cleanup):** Remove old checkbox selection logic (since we now compare everything).
- [ ] **Step 7 (Commit):** `git add . && git commit -m "UI: Merge sources into flip cards with ownership transparency" && git push`
- [ ] **Step 8 (Verify):**
    * Test flip animation on desktop (click) and mobile (tap).
    * Confirm ownership data appears from Gemini response.
    * Verify Wikipedia links open correctly.
    * Check that all results display (no artificial limits).
    * Confirm "More Sources" section is fully removed.

### Card Layout Specification
**Front:**
`[Logo] CNN [Left Badge] [Corporate Badge]`
`"Headline text..."`
`Tone: Analytical`
`[↻ Flip for Info]`

**Back:**
`📋 SOURCE TRANSPARENCY`
`Owner: Warner Bros Discovery`
`Funding: Ads + Cable`
`[🔗 Verify on Wikipedia]`