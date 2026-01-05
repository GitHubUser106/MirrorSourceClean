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

### Sprint 9: Data Quality Audit & Fixes (Jan 4, 2026)

#### Context
After adding the "Independent" label, several data quality issues were discovered on the /sources page. This sprint audits and fixes all issues before proceeding with UI changes.

---

#### Problem 1: Duplicate Sources

**Known Duplicates to Find & Remove:**
- [ ] **Wikipedia** - Appears multiple times
- [ ] **Globe and Mail** - Appears multiple times
- [ ] Any other duplicates

**Task:**
```bash
# Run in sourceData.ts to find duplicates
# Look for identical domains or names
```

- [ ] Search `sourceData.ts` for duplicate `domain` values
- [ ] Search `sourceData.ts` for duplicate `name` values
- [ ] Remove duplicates, keeping the most complete entry
- [ ] Verify no duplicates remain

---

#### Problem 2: Naming Collisions (Ambiguous Names)

**Generic names that need geographic disambiguation:**

| Current Name | Ambiguity Risk | Fix To |
|--------------|----------------|--------|
| The National | UAE vs CBC vs US | "The National (UAE)" |
| The Star | Toronto vs UK vs others | "Toronto Star" |
| The Times | UK vs NYT vs others | "The Times (UK)" |
| The Independent | UK paper vs "Indie" badge | "The Independent (UK)" |
| Guardian | UK vs PEI Guardian | "The Guardian (UK)" |
| Global News | Could confuse with Globe | Keep but ensure distinct logo |

**Task:**
- [ ] Audit `sourceData.ts` for generic names
- [ ] Append geographic identifiers where needed
- [ ] Ensure "The Independent (UK)" won't conflict with new "Independent" badge

---

#### Problem 3: Platform vs Publisher Logic

**Issue:** YouTube is labeled "Center" bias and "Corporate" ownership. But YouTube is a **platform**, not a publisher - it hosts all viewpoints.

**Affected Platforms:**
- YouTube
- X (Twitter)
- Substack
- Rumble
- TikTok

**Fix Options:**

| Field | Current | Proposed |
|-------|---------|----------|
| Bias | "Center" | "Platform" or "Varies" |
| Ownership | "Corporate" | "Big Tech" or "Platform" |

**Task:**
- [ ] Add new bias category: `"Platform"` for non-editorial aggregators
- [ ] Update YouTube, X, Substack, Rumble entries
- [ ] Update UI to show gray "Platform" badge instead of political lean
- [ ] Consider: Should platforms even appear in Source Analysis results?

---

#### Problem 4: Inconsistent Ownership Taxonomy

**Current Terms (Confusing):**
- "Private" (e.g., Globe - Woodbridge Company)
- "Public Co." (e.g., Postmedia - TSX listed)
- "Corporate" (e.g., YouTube - but Google is also Public)

**User Confusion:** "Corporate" and "Public Co." sound like the same thing.

**Proposed Standardized Taxonomy:**

| New Term | Definition | Examples |
|----------|------------|----------|
| `Publicly Traded` | Listed on stock exchange | NYT, Postmedia, Google |
| `Private` | Privately held company | Globe & Mail (Woodbridge) |
| `Independent` | Creator/founder owned | Substack writers, indie outlets |
| `Nonprofit` | 501(c)(3) or equivalent | ProPublica, NPR |
| `State-Funded` | Government funded | CBC, BBC, Al Jazeera |
| `Big Tech` | Platform companies | YouTube, X, TikTok |

**Task:**
- [ ] Define canonical ownership types in code
- [ ] Audit all sources and reclassify
- [ ] Update `sourceData.ts` with consistent taxonomy
- [ ] Update UI badges to match new terms

---

#### Problem 5: Wikipedia Shouldn't Be a News Source

**Issue:** Wikipedia appears in the sources list, but it's an encyclopedia, not a news source.

**Task:**
- [ ] Remove Wikipedia from `sourceData.ts` entirely
- [ ] Or move to a separate "Reference" category if needed

---

### Audit Checklist

Run these checks on `sourceData.ts`:

```typescript
// 1. Find duplicate domains
const domains = SOURCES.map(s => s.domain);
const duplicateDomains = domains.filter((d, i) => domains.indexOf(d) !== i);
console.log("Duplicate domains:", duplicateDomains);

// 2. Find duplicate names
const names = SOURCES.map(s => s.name);
const duplicateNames = names.filter((n, i) => names.indexOf(n) !== i);
console.log("Duplicate names:", duplicateNames);

// 3. Find generic names needing disambiguation
const genericNames = ["The National", "The Star", "The Times", "The Independent", "Guardian", "Tribune", "Post", "Herald"];
const needsDisambiguation = SOURCES.filter(s => 
  genericNames.some(g => s.name.includes(g))
);
console.log("Needs disambiguation:", needsDisambiguation.map(s => s.name));

// 4. Find platform entries
const platforms = SOURCES.filter(s => 
  ["youtube.com", "twitter.com", "x.com", "substack.com", "rumble.com", "tiktok.com"].some(p => s.domain.includes(p))
);
console.log("Platforms:", platforms.map(s => s.name));

// 5. Check ownership taxonomy
const ownershipTypes = [...new Set(SOURCES.map(s => s.ownershipType))];
console.log("Current ownership types:", ownershipTypes);
```

---

### Acceptance Criteria

- [ ] Zero duplicate sources in `sourceData.ts`
- [ ] All generic names disambiguated with geography
- [ ] Platforms (YouTube, X, etc.) have "Platform" bias, not "Center"
- [ ] Ownership taxonomy standardized (6 canonical types)
- [ ] Wikipedia removed or recategorized
- [ ] /sources page displays correctly with no duplicates
- [ ] All changes deployed to production

---

### Files to Modify
- `src/lib/sourceData.ts` - Primary data file
- `src/lib/independentSourceData.ts` - Verify no conflicts
- `src/components/SourceFlipCard.tsx` - Badge display logic for new types
- `src/app/sources/page.tsx` - Sources listing page

---

## Section 5: Pending Sprints (Do After Sprint 9)

### Sprint 7: Source Card Layout Improvements
- 3 cards per row
- Move country flag to badge row
- Relax text truncation

### Sprint 8: YouTube Attribution + Independent Sources
- Extract YouTube channel names
- Match to sourceData for real bias
- Fix indie sources not appearing in results

---

## Section 6: Future Work

- [ ] Add Brave response caching
- [ ] Author intelligence improvements
- [ ] Source Transparency Cards (ownership, funding info)

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