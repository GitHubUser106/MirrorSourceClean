# MirrorSource - Consolidated Codebase

## Section 1: Global Context

**App Name:** MirrorSource
**Stack:** Next.js 14, TypeScript 5, Tailwind 3.4, Brave Search API, Gemini AI
**Repo:** https://github.com/GitHubUser106/MirrorSourceClean
**Production:** https://mirrorsource.app
**Working Directory:** ~/Desktop/MirrorSource

**Environment Variables (Vercel):**
- BRAVE_API_KEY
- GEMINI_API_KEY

---

## Section 2: Completed Work

### Sprint: Consolidation & Search Fixes (Jan 1, 2026)

#### Consolidation
- [x] Merged MirrorSource-Provenance into main MirrorSource
- [x] Added articleFetcher.ts (node-html-parser based)
- [x] Added independentSourceData.ts (16 indie sources)
- [x] Added authenticitySignals.ts (suspicion scoring)
- [x] Restored Chrome extension folder
- [x] Pushed to MirrorSourceClean repo
- [x] Deployed to mirrorsource.app
- [x] Cleaned up old folders (IndieSource, MirrorSource-Provenance)

#### Search Quality Fixes
- [x] **Quality filter loosened** - Title match requirement now only applies to 2-3 word queries; longer queries (from article titles) skip the strict title check
- [x] **Brave 429 backoff** - Added exponential backoff for rate limits (3 retries: 1s → 2s → 4s delays)

#### Test Results
- Before fixes: 1-2 sources returned
- After fixes: 4+ sources returned (Reuters, NYT, Fox, CNN)
- Coverage distribution working across political spectrum

### Sprint 5: Source Card UX Fixes (Jan 1, 2026)

#### Issues Fixed
- [x] **Source name clickable** - Source name now links to homepage (opens in new tab, doesn't flip card)
- [x] **Premium Link Detected centered** - Changed `inline-flex` → `flex justify-center` for detected badges
- [x] **HTML entity decoding** - Added numeric entity decoding (`&#x27;` → apostrophe, `&#39;`, etc.) to cleanSnippet
- [x] **Cards less congested** - Increased card height (320px → 380px) and padding (p-5 → p-6)

#### Files Changed
- `src/components/SourceFlipCard.tsx` - Clickable source name, entity decoding, larger cards
- `src/app/page.tsx` - Centered Premium/Shared Link Detected badges

#### Verification
- Desktop: Source links open in new tab without flipping card
- Mobile: Single column layout, "Tap for info" text displays
- Console: No errors
- Production: https://mirrorsource.app

---

## Section 3: Current Architecture

### Key Files
- `src/app/api/find/route.ts` - Main search API with Brave + Gemini
- `src/lib/sourceData.ts` - 193+ news sources with political lean data
- `src/lib/independentSourceData.ts` - 16 indie media sources
- `src/lib/articleFetcher.ts` - Opportunistic article content extraction
- `src/lib/authenticitySignals.ts` - Suspicion scoring for sources
- `src/components/SourceFlipCard.tsx` - Source cards with transparency info

### Search Flow
1. User submits URL → Extract title or keywords
2. Brave Search with site: filters for balanced results
3. Quality filter removes spam/irrelevant results
4. Gemini synthesizes summary + common ground + differences
5. Results displayed with political lean and ownership transparency

---

## Section 4: Future Work

### Current Sprint: Source Card Layout Improvements (Jan 4, 2026)

#### Problem
Source names are truncated ("GLOBE A...", "NATIONAL...", "THENATI...") making sources hard to identify. Cards feel cramped with 4-column layout.

#### Tasks
- [x] **3 cards per row** - Change grid from 4 columns to 3 on desktop (lg breakpoint)
  - Desktop (lg): 3 cards
  - Tablet (md): 2 cards
  - Mobile: 1 card

- [x] **Move country flag to badge row** - Flag competes with source name for header space
  - Current: `[Logo] [Name...] [🇨🇦]` + `[Bias] [Ownership]`
  - New: `[Logo] [Full Name]` + `[🇨🇦] [Bias] [Ownership]`

- [x] **Relax text truncation** - Let content breathe in wider cards
  - Source name: No truncation (full name visible)
  - Headline: Allow 2-3 lines before truncating
  - Summary: Allow 3-4 lines before truncating

#### Files to Modify
- `src/components/SourceFlipCard.tsx` - Card layout, flag position, truncation
- `src/app/page.tsx` - Grid columns

#### Acceptance Criteria
- [x] Source names fully visible (Globe and Mail, National Post, etc.)
- [x] Country flag in badge row with bias/ownership badges
- [x] Headlines wrap naturally (2-3 lines)
- [x] Summaries wrap naturally (3-4 lines)
- [x] Cards don't look empty - content fills space
- [x] Responsive: 3 → 2 → 1 columns as viewport shrinks

---

### Potential Improvements
- [ ] Add Brave response caching (separate from final result cache)
- [ ] Improve indie source matching in BALANCED_DOMAINS
- [ ] Add more indie sources to sourceData.ts
- [ ] Chrome extension testing and updates
- [ ] Author intelligence improvements (byline extraction)

### Known Issues
- Some URLs with numeric IDs (e.g., BBC) can't extract keywords
- Rate limits on Brave API during high traffic (mitigated with backoff)

---

## Section 5: Commands

```bash
# Development
cd ~/Desktop/MirrorSource
npm run dev

# Build & Deploy
npm run build
git add -A && git commit -m "message"
git push origin main
vercel --prod

# Test URLs
https://www.foxnews.com/politics/trump-executive-orders-immigration
https://www.rebelnews.com/trudeau_silent_as_iran_strikes_israel
```
