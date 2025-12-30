# 🎯 MirrorSource Mini Sprint: A+ Design Polish

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, TypeScript 5, Tailwind 3.4
* **Current Grade:** A (from Design Review)
* **Target Grade:** A+
* **Estimated Time:** 30-45 minutes

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Fix 5 minor issues identified in Design Review to achieve A+ grade

### Context
> **The Situation:** Design Review returned Grade A with no functional issues. Five minor polish items identified that would elevate to A+.
> **The Approach:** Quick surgical fixes, no major refactoring.
> **The Outcome:** Cleaner console, better mobile UX, improved perceived performance.

### Fixes Overview
| # | Fix | File | Effort | Priority |
|---|-----|------|--------|----------|
| 1 | PWA manifest warnings | `layout.tsx`, `manifest.json` | 5 min | Low |
| 2 | "Your article" missing on mobile | `page.tsx` | 10 min | **High** |
| 3 | ~~Sticky search animation~~ | — | — | SKIP |
| 4 | Instant skeleton feedback | `page.tsx` | 10 min | Medium |
| 5 | "Click" vs "Tap" responsive text | `SourceFlipCard.tsx` | 5 min | Low |

---

## Execution Checklist

### Step 1: Fix PWA Warnings (5 min)

- [ ] **1a. Open `src/app/layout.tsx`**
    * Find the `<meta name="apple-mobile-web-app-capable" ...>` tag
    * Replace with modern equivalent:
```tsx
// BEFORE (deprecated)
<meta name="apple-mobile-web-app-capable" content="yes" />

// AFTER (modern)
<meta name="mobile-web-app-capable" content="yes" />
```

- [ ] **1b. Open `public/manifest.json`** (or `src/app/manifest.json`)
    * Add enctype field if missing:
```json
{
  "name": "MirrorSource",
  "short_name": "MirrorSource",
  "enctype": "application/x-www-form-urlencoded",
  ...
}
```

- [ ] **1c. Verify:** Refresh page, check console for warnings → Should be gone

---

### Step 2: Fix "Your Article" Missing on Mobile (10 min) ⭐ HIGH PRIORITY

- [ ] **2a. Open `src/app/page.tsx`**
    * Find the Coverage Distribution section
    * Locate the "Your article: [Source] [Badge]" line
    * It likely has a class like `hidden md:block` or `hidden sm:flex`

- [ ] **2b. Remove the responsive hiding:**
```tsx
// BEFORE (hidden on mobile)
<div className="hidden md:flex items-center gap-2 mb-4">
  <span className="text-red-500">📍</span>
  <span>Your article:</span>
  <span className="font-medium">{inputSourceName}</span>
  <Badge>{inputSourceLean}</Badge>
</div>

// AFTER (always visible)
<div className="flex items-center gap-2 mb-4 text-sm">
  <span className="text-red-500">📍</span>
  <span>Your article:</span>
  <span className="font-medium">{inputSourceName}</span>
  <Badge>{inputSourceLean}</Badge>
</div>
```

- [ ] **2c. Optional - Compact on mobile:**
    * If space is tight, consider smaller text on mobile:
```tsx
<div className="flex items-center gap-2 mb-4 text-xs sm:text-sm">
```

- [ ] **2d. Verify:** Test on 390px viewport → "Your article" should be visible

---

### Step 3: SKIP - Sticky Search Animation
> Skipping for now. The current instant transition is acceptable. Can revisit later if desired.

---

### Step 4: Instant Skeleton Feedback (10 min)

- [ ] **4a. Open `src/app/page.tsx`**
    * Find the `handleAnalyze` or `handleSubmit` function

- [ ] **4b. Ensure loading state is set BEFORE any async work:**
```tsx
const handleAnalyze = async () => {
  // IMMEDIATELY set loading state (before any await)
  setIsLoading(true);
  setResults(null);  // Clear previous results
  setError(null);    // Clear any errors
  
  try {
    const response = await fetch('/api/find', { ... });
    const data = await response.json();
    setResults(data);
  } catch (err) {
    setError('Something went wrong');
  } finally {
    setIsLoading(false);
  }
};
```

- [ ] **4c. Verify skeleton appears immediately:**
    * Check that a loading skeleton/shimmer shows the instant the button is clicked
    * There should be NO delay between click and visual feedback
    * If skeleton doesn't exist, ensure `isLoading && <Skeleton />` is in the JSX

- [ ] **4d. Button should also show spinner:**
```tsx
<button disabled={isLoading} className="...">
  {isLoading ? (
    <span className="flex items-center justify-center">
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Analyzing...
    </span>
  ) : (
    <>Analyze <span aria-hidden="true">→</span></>
  )}
</button>
```

---

### Step 5: "Click" vs "Tap" Responsive Text (5 min)

- [ ] **5a. Open `src/components/SourceFlipCard.tsx`**
    * Find the "Tap for info" text (likely near bottom of card)

- [ ] **5b. Make it responsive:**
```tsx
// BEFORE (always says "Tap")
<span className="text-xs text-gray-400">
  ⓘ Tap for info
</span>

// AFTER (device-appropriate)
<span className="text-xs text-gray-400">
  <span className="md:hidden">ⓘ Tap for info</span>
  <span className="hidden md:inline">ⓘ Click for info</span>
</span>
```

- [ ] **5c. Alternative - simpler approach:**
```tsx
// Use generic language that works for both
<span className="text-xs text-gray-400">
  ⓘ Flip for details
</span>
```

- [ ] **5d. Verify:** Check desktop shows "Click", mobile shows "Tap" (or use generic)

---

## Step 6: Final Verification

- [ ] **6a. Run Design Reviewer again:**
```
Use Playwright to audit localhost:3000
```

- [ ] **6b. Check console:** Should have 0 errors, 0 warnings (or only non-blocking)

- [ ] **6c. Test mobile (390px):**
    * "Your article" visible in Coverage Distribution ✓
    * "Tap for info" on cards ✓
    * Skeleton appears instantly on Analyze click ✓

- [ ] **6d. Test desktop (1440px):**
    * "Click for info" on cards ✓
    * All previous functionality intact ✓

---

## Step 7: Commit

```bash
git add . && git commit -m "Polish: A+ design fixes - PWA warnings, mobile Your Article indicator, instant loading feedback, responsive card text" && git push
```

---

## Success Criteria
- [ ] Console shows 0 PWA warnings
- [ ] "Your article: [Source]" visible on mobile Coverage Distribution
- [ ] Skeleton/loading state appears instantly when Analyze is clicked
- [ ] Source cards show "Click for info" on desktop, "Tap for info" on mobile
- [ ] Design Review grade: A+

---

## Files to Modify
| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Update deprecated meta tag |
| `public/manifest.json` | Add enctype field |
| `src/app/page.tsx` | Fix "Your article" visibility, ensure instant loading state |
| `src/components/SourceFlipCard.tsx` | Responsive "Click/Tap" text |

---

**Date:** December 30, 2025
**Status:** Ready for Builder
**Estimated Time:** 30-45 minutes