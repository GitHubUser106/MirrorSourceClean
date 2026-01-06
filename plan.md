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

### Sprint 5: Source Card UX Fixes (Jan 1, 2026)

- [x] **Source name clickable** - Source name now links to homepage
- [x] **Premium Link Detected centered**
- [x] **HTML entity decoding**
- [x] **Cards less congested** - Increased card height and padding

### Sprint 6: Extension CTA (Jan 4, 2026)

- [x] **Added "Extension" to header nav**
- [x] **Added extension CTA on homepage**

### Sprint 9: Data Quality Audit & Fixes (Jan 4, 2026)

#### Duplicates Removed
- [x] `globeandmail.com` (kept `theglobeandmail.com`)
- [x] `thestar.com` (kept `torontostar.com`)
- [x] `theepochtimes.com` (kept `epochtimes.com`)
- [x] `news.sky.com` (kept `sky.com`)
- [x] `wikipedia.org` and `en.wikipedia.org` (removed - not a news source)

#### Names Disambiguated
- [x] "The Independent" → "The Independent (UK)"
- [x] "The Times" → "The Times (UK)"

#### Platform Handling
- [x] Rumble and Substack already have `sourceType: 'platform'`
- [x] YouTube, X, TikTok not in database (correctly excluded as platforms)

#### Ownership Taxonomy
- [x] Already standardized: nonprofit, public, family, billionaire, corporate, government, cooperative

**Result:** Source count reduced from 193+ to **187+ sources**

### Sprint 7: Source Card Layout Improvements (Jan 4, 2026)

- [x] **3 cards per row** - `lg:grid-cols-3` on source analysis grid
- [x] **Country flag in badge row** - Flag emoji appears alongside lean/ownership badges
- [x] **Text truncation relaxed** - Cards use `line-clamp-3` and `line-clamp-4` for readable content

### Sprint 8: YouTube Attribution + Independent Sources (Jan 4, 2026)

- [x] **YouTube channel attribution** - 50+ news channels mapped to parent domains
- [x] **Channel name extraction** - Strips " - YouTube" suffix from titles
- [x] **Expanded BALANCED_DOMAINS** - From 14 to 32 domains for better coverage
- [x] **Brave response caching** - 15min TTL with globalThis persistence (55x faster cached searches)

### Sprint 10: SR&ED Compliance Review (Jan 4, 2026)

#### T661 Narrative Review
- [x] Reviewed form_data.json for problematic language
- [x] Fixed "paywall-blocked content" claim → "cases where direct title extraction fails"
- [x] Verified route.ts does NOT circumvent paywalls (only detects them)

#### Evidence Search
- [x] Searched git history for experimentation evidence
- [x] Reviewed .history folder for iteration documentation
- [x] Identified `/api/debug-extract` as key SR&ED evidence (diagnostic endpoint)
- [x] Documented threshold values in authenticitySignals.ts

#### Consultant Email (Jan 5, 2026)
- [x] Drafted email to SR&ED consultant (Kent)
- [x] Verified all technical claims against codebase
- [x] Revised "each transformation stage" → "intermediate states" (more defensible)
- [x] Removed unverifiable "HTTP 200 with empty results" claim
- [x] Removed "undergoing isolated testing" (no test files exist)
- [x] Replaced "instruction decay" with actual CLAUDE.md description
- [x] Final email sent to Kent, Jared (Account Exec), and Mat (Technical)

**Technical Claims Sent (All Verified Against Code):**
1. URL-to-Keyword Extraction - Fully integrated, debug endpoint exists
2. AI Content Detection - Module stage, pending integration (authenticitySignals.ts)
3. LLM Orchestration - Conductor/Builder protocol via CLAUDE.md/plan.md

**Business Context Disclosed:**
- 2025 sole prop expenditure ~$1,100 (below Boast minimums)
- Open to Boast handling 2025 as foundation for 2026 engagement
- Incorporating for 2026, projected R&D salary $30K-50K
- Full-time employment income >$100K (affects salary strategy)

**Awaiting:** Technical scoping call with Mat

#### Dev Environment (Jan 5, 2026)
- [x] Added notification hook to `~/.claude/settings.json`
- [x] `afplay /System/Library/Sounds/Glass.aiff` on Claude Code notifications

**Key SR&ED Artifacts:**
- `/api/debug-extract/route.ts` - Diagnostic endpoint for URL extraction pipeline
- `authenticitySignals.ts` - Suspicion scoring with threshold values (30/60/50)
- `.history/` folder - Sprint planning iterations

---

## Section 3: Current Architecture

### Key Files
- `src/app/api/find/route.ts` - Main search API with Brave + Gemini
- `src/lib/sourceData.ts` - 187+ news sources with political lean data
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

*No active sprint. Ready for next task.*

---

## Section 5: Pending Sprints

*No pending sprints. Ready for next task.*

---

## Section 6: Future Work

- [ ] Author intelligence improvements
- [ ] Source Transparency Cards (ownership, funding info)
- [ ] Add "Platform" political lean type for Rumble/Substack (deferred - requires UI changes)
- [ ] SR&ED claim filing (awaiting technical scoping call with Mat)

---

## Section 7: Commands

```bash
# Development
cd ~/Desktop/MirrorSource
npm run dev

# Build & Deploy
npm run build
git add -A && git commit -m "message"
git push origin main
vercel --prod

# Audit script (run in Node)
node -e "const {SOURCES} = require('./src/lib/sourceData.ts'); /* audit code */"
```

---

## Section 8: Handoff Protocol

When handing off to a new chat session:
1. Provide this complete plan.md
2. New session should continue using this format
3. Move completed sprints to Section 2
4. Keep current sprint in Section 4
5. Always include Global Context (Section 1)
6. **Always generate plan.md in this format** - future chats must maintain this structure
