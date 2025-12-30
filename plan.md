# 🎯 MirrorSource UI Sprint: State-Based Layout

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, TypeScript 5, Tailwind 3.4, Brave Search API, Gemini AI.
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.
* **Coding Style:** "Vibecoding" — prioritize speed and functioning prototypes.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Maximize screen real estate by implementing State-Based Layout + Clean up redundant landing page content

### Context
> **The Problem:** The landing page has redundant messaging ("See the whole story" + "Understanding the full picture" say the same thing). After search, ~400px of viewport is wasted on content that's no longer relevant. On mobile, this pushes the actual answer off-screen.
> **The Solution:** 
> 1. **Permanently delete** the "Understanding the full picture" feature cards (redundant)
> 2. **Conditionally hide** the hero text when results are shown
> 3. Transition from "Landing Page Mode" to "App Mode" when user searches
> **The Outcome:** Cleaner landing page + Results appear immediately at viewport top.

### Design Decision: Kill the Feature Cards
The hero ("See the whole story") and feature section ("Understanding the full picture") are redundant:
- Both explain "we show you multiple perspectives"
- First-time users get it from the hero alone
- The 4 cards add cognitive load without adding value
- **Decision:** Delete feature cards permanently, keep hero (hide on search)

### State Definitions
| State | Hero | Feature Cards | Search Bar | Top Padding |
|-------|------|---------------|------------|-------------|
| **Idle** | Visible | DELETED | Full width, centered | `py-16` |
| **Loading** | Hidden | DELETED | Sticky top | `py-4` |
| **Results** | Hidden | DELETED | Sticky top | `py-4` |

### Execution Checklist

- [ ] **Step 0 (Prerequisites):** **(Conductor Action)**
    * Ensure `npm run dev` works locally on port 3000
    * Have `src/app/page.tsx` open and ready

- [ ] **Step 1 (Delete Feature Cards Section - PERMANENT):**
    * Find the "Understanding the full picture" section containing:
      - `<h2>Understanding the full picture</h2>`
      - `<p>Get comprehensive insights...</p>`
      - 4 feature cards (Summary, Intel Brief, Coverage Distribution, Source Compare)
    * **Delete the entire section** - not conditional, permanently remove
    * This cleans up the landing page and removes ~300px of redundant content

- [ ] **Step 2 (Delete Loading Icons - PERMANENT):**
    * Locate any section that renders loading indicator icons/grid during search
    * Delete it entirely
    * **Replacement:** Modify the "Analyze" button to show spinner when `isLoading`:
```tsx
<button disabled={isLoading} className="...">
  {isLoading ? (
    <span className="flex items-center">
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Analyzing...
    </span>
  ) : (
    <>Analyze <span aria-hidden="true">→</span></>
  )}
</button>
```

- [ ] **Step 3 (Conditional Hero Rendering):**
    * Locate the Hero Section:
      - `<h1>See the whole story.</h1>`
      - `<p>Compare how different sources cover the same news...</p>`
    * Wrap in conditional:
```tsx
{!results && !isLoading && (
  <div className="text-center mb-8">
    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
      See the whole story.
    </h1>
    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
      Compare how different sources cover the same news. Get AI-powered
      summaries and see the full political spectrum.
    </p>
  </div>
)}
```

- [ ] **Step 4 (Conditional "Try an example" Link):**
    * Locate "Try an example: Healthcare Policy Article" link
    * Wrap in same conditional:
```tsx
{!results && !isLoading && (
  <p className="text-center text-sm text-gray-500 mt-4">
    Try an example: <a href="..." className="text-blue-600 hover:underline">Healthcare Policy Article</a>
  </p>
)}
```

- [ ] **Step 5 (Dynamic Container Spacing):**
    * Find the main container padding (likely `py-16`, `py-20`, or `py-24`)
    * Make it state-dependent:
```tsx
<main className={`${results || isLoading ? 'pt-4 pb-8' : 'py-16'} px-4 max-w-4xl mx-auto`}>
```

- [ ] **Step 6 (Sticky Search Bar):**
    * Add sticky positioning when in results/loading state:
```tsx
<div className={`
  ${results || isLoading 
    ? 'sticky top-0 z-20 bg-white/95 backdrop-blur-sm shadow-sm -mx-4 px-4 py-3' 
    : 'mb-6'}
`}>
  {/* Search input + Analyze button */}
</div>
```

- [ ] **Step 7 (Visual Verification):** Use Playwright MCP:
    * Open localhost:3000, screenshot → Verify clean landing (no feature cards)
    * Click Analyze → Verify hero disappears immediately
    * Wait for results → Verify Summary is first visible element
    * Scroll down → Verify search bar stays sticky
    * Set viewport 390px → Verify mobile layout

- [ ] **Step 8 (Commit):**
```bash
git add . && git commit -m "Clean up landing page: remove redundant feature cards, implement state-based layout" && git push
```

### Success Criteria
- [ ] Feature cards section is permanently removed from codebase
- [ ] Landing page shows only: Hero + Search bar + "Try an example"
- [ ] Hero disappears immediately when "Analyze" is clicked
- [ ] "Try an example" link disappears on search
- [ ] Analyze button shows spinner during loading (no separate loading icons)
- [ ] Search bar becomes sticky at top in results view
- [ ] Summary card is first visible element after search bar
- [ ] Mobile: Summary visible above fold without scrolling
- [ ] No layout shift or flash during state transitions

### Summary of Changes
| Element | Current State | New State |
|---------|---------------|-----------|
| Feature cards ("Understanding...") | Visible on landing | **DELETED** |
| Loading icons grid | Visible during search | **DELETED** (spinner in button) |
| Hero ("See the whole story") | Always visible | Hidden on search |
| "Try an example" link | Always visible | Hidden on search |
| Container padding | Fixed `py-20` | Dynamic `py-4` / `py-16` |
| Search bar | Static | Sticky when results shown |

### Files to Modify
| File | Changes |
|------|---------|
| `src/app/page.tsx` | All changes in this sprint |

### Estimated Time
~20 minutes

---

**Date:** December 30, 2025
**Status:** Ready for Builder