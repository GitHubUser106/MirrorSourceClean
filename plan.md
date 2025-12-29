# 🎵 Project MirrorSource: Orchestration Plan

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, Tailwind 3.4, Brave Search API.
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** UI Polish - Fix Empty Cards, Confusing Badges, and Flip Layout

### Context
> **The Problem:** > 1. Cards without AI analysis (Fox, CNN) appear empty/broken.
> 2. "Public" badge is ambiguous (confused with government).
> 3. Flip card back is cramped, hiding the "Verify" link.
> **The Fix:** Implement smart content fallbacks, a clear label mapping system, and CSS spacing fixes.

### Execution Checklist
- [ ] **Step 1 (The "Empty Card" Fix):** Open `src/components/SourceFlipCard.tsx`.
    * **Logic Update:** If `analysis.tone` or `analysis.headline` is missing, do NOT leave the card body empty.
    * **Fallback Priority:**
        1. Show `source.snippet` (from Brave Search), truncated to 3 lines (line-clamp-3).
        2. If no snippet, show generic text: "Click to read full coverage from [Source Name]."
    * **Visual:** Ensure this fallback text has a subtle gray color (`text-gray-500`) to distinguish it from AI-generated insights.
- [ ] **Step 2 (Badge Clarity):** Open `src/lib/sourceData.ts`.
    * Export a new mapping constant to standardize labels:
      ```typescript
      export const OWNERSHIP_LABELS: Record<OwnershipType, string> = {
        'nonprofit': 'Nonprofit',
        'public': 'Public Co.',      // Clarity fix: Publicly Traded
        'family': 'Family-Owned',
        'billionaire': 'Billionaire-Owned',
        'corporate': 'Corporate',
        'government': 'Public Broadcaster', // Neutral fix for BBC/PBS
        'cooperative': 'Co-op',
      };
      ```
    * Update `src/components/SourceFlipCard.tsx` (and any other badge usage) to render `OWNERSHIP_LABELS[type]` instead of the raw string.
- [ ] **Step 3 (Flip Layout Fix):** Open `src/components/SourceFlipCard.tsx` (Back Side).
    * **Container:** Ensure the back face uses `flex flex-col h-full`.
    * **Content Area:** Wrap the Owner/Funding text in a div with `flex-grow overflow-y-auto pr-1` (scrollable if text is long).
    * **Footer Area:** Place the "Verify on Wikipedia" link and "Back" button in a fixed bottom section with top padding (`pt-2 mt-auto`).
- [ ] **Step 4 (Commit):** `git add . && git commit -m "UI Polish: Fix empty cards, badge labels, and flip layout" && git push`

### Success Criteria
- [ ] **Fox/CNN/Breitbart:** Now display a snippet text instead of white space.
- [ ] **NYT/Reuters:** Badge says "Public Co."
- [ ] **BBC:** Badge says "Public Broadcaster."
- [ ] **Flip Card:** "Verify" link is always visible and clickable, never pushed off-screen.