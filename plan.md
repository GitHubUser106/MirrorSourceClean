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

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Redesign the loading state to use square "Media Tiles" with a sequential "Scanning Wave" animation.

### Context (Paste from Gemini/ChatGPT here)
> *We are shifting the visual language from "Social Profile" (circular avatars) to "News Desk" (square/rounded media tiles) to align with the rest of the new UI.

For the animation, we will replace the basic flashing with a "Spectrum Wave."

The Concept: The icons will pulse in a specific order (Left → Right) rather than randomly blinking.

The Feel: This simulates a "System Scan" or "Radar Sweep," making the user feel like the AI is actively hunting across the political spectrum (from Left to Right) to gather their results.

Visuals: We will use rounded-lg (standard rounded corners) instead of rounded-full, adding a subtle border to make them look like app icons or favicons.*

### Execution Checklist (Claude's Instructions)
[ ] Step 1: Locate the loading state UI in src/app/page.tsx (specifically the section rendering the flashing icons).

[ ] Step 2: Update the icon container styles:

Change rounded-full to rounded-lg (or rounded-md depending on size).

Add border border-gray-200 (light border) and p-1 (padding) to frame the logos nicely.

Ensure they are square (aspect-square or fixed w-12 h-12).[ ] Step 3: Implement the "Scanning Wave" animation:

Remove the generic animate-pulse from the parent container if present.

Apply a custom animation to each individual icon.

Use an inline style for Animation Delay based on the index: style={{ animationDelay: '${index * 150}ms' }}.

Result: Icon 1 pulses, then Icon 2, then Icon 3... creating a wave effect.

[ ] Step 4: (Optional Polish) If the icons are currently just gray placeholders, ensure we are rendering a diverse set of actual logos (e.g., NYT, Fox, BBC, CNN) during the loading phase to make the "Scan" feel real.

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
