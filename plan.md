# MirrorSource - Consolidated Codebase

## Section 1: Global Context

**App Name:** MirrorSource
**Stack:** Next.js 14, TypeScript 5, Tailwind 3.4, Brave Search API, Gemini AI
**Repo:** https://github.com/GitHubUser106/MirrorSourceClean
**Production:** https://mirrorsource.app
**Chrome Extension:** https://chromewebstore.google.com/detail/mirrorsource/pbkhmfaocbdakhlpbdebghpdmkpbfohk
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

### Sprint 6: Extension CTA (Jan 4, 2026)

#### Tasks Completed
- [x] **Added "Extension" to header nav** - Links to Chrome Web Store
- [x] **Added extension CTA on homepage** - "Get the Chrome Extension" card below URL input
- [x] **Subtitle copy** - "Analyze any article with one click"

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

## Section 4: Current Sprint

### Sprint 9: Brave Response Caching (Jan 4, 2026) ✅ COMPLETE

#### Problem
Repeated searches and rate limits (429) were causing slow responses and failed searches.

#### Solution Implemented
- [x] **Main result cache** - Uses `globalThis` for persistence across Next.js hot reloads
- [x] **Brave response cache** - 15-minute TTL, 200 max entries for raw Brave API responses
- [x] **Cache debugging** - Added size/key logging for troubleshooting

#### Performance Results
- First search: ~5700ms (full API calls)
- Cached search: ~104ms (55x faster!)

#### Files Changed
- `src/app/api/find/route.ts` - Added globalThis caching for both main results and Brave responses

---

### Sprint 8: YouTube Attribution + Independent Sources (Jan 4, 2026) ✅ COMPLETE

#### Problem 1: YouTube Channel Attribution ✅
YouTube results showed generic "YOUTUBE" with "Center" bias, even when the video was from a known news channel.

**Solution Implemented:**
- [x] Added `YOUTUBE_CHANNEL_MAP` with 50+ known news channels mapped to their parent domains
- [x] Added `extractYouTubeChannel()` function to parse channel names from video titles
- [x] Added `resolveYouTubeChannel()` to match channel names to source domains
- [x] Modified `processSearchResults()` to detect youtube.com domains and resolve to actual source
- [x] Unknown channels use channel name as display name (e.g., "NEWSNATION LIVE")
- [x] Strips " - YouTube" suffix from extracted channel names

**Files Changed:**
- `src/app/api/find/route.ts` - Added YouTube channel attribution logic

---

#### Problem 2: Independent Sources Not Appearing ✅
BALANCED_DOMAINS only had 14 domains, missing most indie sources.

**Solution Implemented:**
- [x] Expanded `BALANCED_DOMAINS` from 14 to 32 domains
- [x] Added indie sources by political lean:
  - **Left:** jacobin.com, theintercept.com, commondreams.org, democracynow.org
  - **Center-Left:** propublica.org, washingtonpost.com, msnbc.com
  - **Center:** apnews.com, thehill.com, npr.org
  - **Center-Right:** reason.com, wsj.com
  - **Right:** breitbart.com, thefederalist.com, nationalreview.com

**Files Changed:**
- `src/lib/sourceData.ts` - Expanded BALANCED_DOMAINS array

#### Acceptance Criteria
- [x] YouTube videos from known news channels show the channel's bias (not generic "YouTube")
- [x] Independent sources appear in results when they cover the story
- [x] Expanded source diversity in search results (32 domains vs 14)
- [x] YouTube channel resolution logging added for debugging

---

## Section 5: Future Work

### Potential Improvements
- [ ] Author intelligence improvements (byline extraction)
- [ ] Source Transparency Cards (ownership, funding info)

### Known Issues
- Some URLs with numeric IDs (e.g., BBC) can't extract keywords
- Rate limits on Brave API during high traffic (mitigated with backoff + caching)

---

## Section 6: Commands

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
https://www.youtube.com/watch?v=uMVxYx80v1k  # NBC News YouTube - test attribution
```

---

## Section 7: Handoff Protocol

When handing off to a new chat session:
1. Provide this complete plan.md
2. New session should continue using this format
3. Move completed sprints to Section 2
4. Keep current sprint in Section 4
5. Always include Global Context (Section 1)