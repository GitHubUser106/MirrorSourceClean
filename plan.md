# 🎵 Project MirrorSource: Orchestration Plan

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, Tailwind 3.4.
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Mobile Responsiveness & Interaction Check

### Context
> **The Problem:** Desktop UI is polished, but mobile "Flip Cards" are risky. Hover states don't work, and tapping links might accidentally flip the card.
> **The Fix:** Move to 1-column mobile grid, implement explicit click-to-flip state, and protect links with `stopPropagation`.

### Execution Checklist
- [ ] **Step 0 (Verification):** **(Conductor Action)** Open the app on a real phone (or DevTools). Check if tapping links accidentally flips the card.
- [ ] **Step 1 (Grid Logic):** Open `src/app/page.tsx`.
    * Ensure grid container uses responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- [ ] **Step 2 (Touch Interaction State):** Open `src/components/SourceFlipCard.tsx`.
    * **State:** Use `const [isFlipped, setIsFlipped] = useState(false)`.
    * **Toggle:** The main container `div` must have `onClick={() => setIsFlipped(!isFlipped)}`.
    * **Cursor:** Add `cursor-pointer` to the container to indicate interactivity.
- [ ] **Step 3 (Event Safety):** Add `e.stopPropagation()` to ALL interactive elements inside the card to prevent unwanted flips:
    * **Front Side:** The "Read article" link.
    * **Back Side:** The "Verify on Wikipedia" link.
    * **Implementation:** `onClick={(e) => e.stopPropagation()}` on the `<a>` tags.
- [ ] **Step 4 (Thumb Zones):** Enforce Apple's Human Interface Guidelines (44px min height).
    * Add classes to both links: `py-3 px-4 min-h-[44px] inline-flex items-center`.
- [ ] **Step 5 (Commit):** `git add . && git commit -m "Fix: Mobile responsive grid, stopPropagation on links, and 44px tap targets" && git push`

### Success Criteria
- [ ] Grid collapses to 1 column on mobile.
- [ ] Tapping the "Read Article" link opens the URL *without* flipping the card.
- [ ] Tapping the "Verify" link opens Wikipedia *without* flipping the card.
- [ ] Tapping anywhere else on the card flips it.