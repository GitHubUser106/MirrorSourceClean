# 🎵 Project MirrorSource: Orchestration Plan

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:**
  - **Framework:** Next.js 14.2.5 (App Router)
  - **Hosting:** Vercel
  - **Language:** TypeScript 5
  - **Styling:** Tailwind CSS 3.4.1
  - **UI Icons:** Lucide React
  - **AI:** Google Gemini (@google/genai)
  - **Search:** Brave Search API
  - **Analytics:** @vercel/analytics
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.
* **Coding Style:** "Vibecoding" — prioritize speed and functioning prototypes over over-engineering.

### Key Files & Structure
```
src/
├── app/
│   ├── page.tsx              # Main homepage with search, results, coverage distribution
│   ├── api/
│   │   ├── find/route.ts     # Main API - search, AI summary, source classification
│   │   ├── compare/route.ts  # Source comparison API
│   │   └── usage/route.ts    # Rate limiting API
│   ├── compare/page.tsx      # Side-by-side source comparison page
│   ├── sources/page.tsx      # Source database display
│   └── about/, contact/, legal/
├── components/
│   ├── UrlInputForm.tsx      # Search input (mobile-responsive)
│   ├── ResultsDisplay.tsx    # Source cards display
│   └── ...
├── lib/
│   ├── sourceData.ts         # Political lean database (AllSides ratings)
│   └── rate-limiter.ts       # Cookie-based rate limiting
└── types/index.ts            # TypeScript interfaces
```

### Environment Variables Required
- `GEMINI_API_KEY` - Google Gemini AI
- `BRAVE_API_KEY` - Brave Search API

Goal: Revert the loading animation to the original "flashing" behavior but maintain the new square icon styling.

Context
The "Scanning Wave" (sequential animation) did not resonate; the user prefers the original simultaneous or random "flashing" effect. We need to roll back the behavioral changes to the animation (removing the sequential delays) while strictly preserving the visual changes (keeping the icons square/rounded-lg instead of circular).

Execution Checklist
[ ] Step 1: Open src/app/page.tsx (or the component handling the loading state).

[ ] Step 2: Remove the sequential logic added in the previous turn:

Delete the inline style={{ animationDelay: ... }} prop from the icons.

[ ] Step 3: Restore the original animation method:

Re-apply the standard animate-pulse class (or the previous animation class) to the icons or their container so they flash simultaneously/randomly as before.

[ ] Step 4: Enforce Square Styling:

Verify: Ensure the icons still have rounded-lg (or rounded-md) and border.

Verify: Ensure rounded-full is NOT present.

## 3. Known Issues & Constraints
* **Tailwind Dynamic Classes:** Do NOT use dynamic Tailwind class names (e.g., `bg-${color}-500`). Tailwind purges them. Use inline styles with hex colors instead.
* **Political Lean Data:** Two sources exist - `sourceData.ts` (shared) and API's internal `sources` object. The API's `getSourceInfo()` should always call `withLean()` to ensure lean is populated.
* **Rate Limiting:** Cookie-based, resets on browser clear. No database persistence.
* **Browser Extension:** Separate `mirrorsource-extension/` folder - Chrome extension for quick access.
* **Mobile PWA:** Supports Android share intents via URL params (`?url=` and `?text=`).
* **API Timeout:** 30 seconds max (`maxDuration = 30`).
* **Cache:** In-memory search cache (1 hour TTL, max 500 entries, resets on cold start).

## 4. Future Roadmap (The "Backlog")
* [ ] Add more international source ratings (Canadian, UK, etc.)
* [ ] Persist rate limiting to database
* [ ] Add user accounts for saved searches
* [ ] Improve mobile PWA experience
* [ ] Add "share comparison" social features
