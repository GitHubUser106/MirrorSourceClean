# ✍️ MirrorSource Feature Sprint: Author Intelligence (MVP)

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, TypeScript 5, Tailwind 3.4, Brave Search API, Gemini AI
* **Feature Branch:** `feature/author-intelligence`
* **Prerequisites:** Provenance (✅), Narrative Decoder (✅)
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.
* **Coding Style:** "Vibecoding" — prioritize speed and functioning prototypes.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Add Author Intelligence with lazy-load "Churnalism Detection"

### Context
> **The Problem:** Users see outlet names but not the humans behind the stories. A "New York Times" article could be from a Pulitzer-winning beat reporter or a content mill rewriter. Nick Davies (Flat Earth News) shows that reporter output volume directly correlates with quality — real reporting takes time.
> **The Solution:** Extract and display bylines (Tier 1), then offer on-demand author analysis when clicked (Tier 2).
> **The Outcome:** Users can distinguish "Deep Dive Reporters" from "Hamster Wheel Churnalists" without slowing down the initial search.

### The Architect's Compromise
We avoid the "Tier 3 Trap" (building a journalist database) by using **lazy-load**:

| Tier | What | When | Cost |
|------|------|------|------|
| **Tier 1** | Show byline | Always (initial search) | Free — already in article |
| **Tier 2** | Output count + verdict | On click | 1 Brave search |
| ~~Tier 3~~ | Full author profile, rolodex | ~~Never (for now)~~ | ~~Database required~~ |

### Why This Works
- **Fast initial load** — No extra API calls on first search
- **Value on demand** — Users who care can click to investigate
- **No infrastructure** — Just Brave search, no database
- **Exposes churnalism** — High output = likely rewrites

---

## 3. Execution Checklist

### Step 0: Prerequisites (Conductor Action)
- [ ] Pull latest main: `git pull origin main`
- [ ] Create feature branch: `git checkout -b feature/author-intelligence`
- [ ] Verify `npm run dev` works

---

### Step 1: Define Types

- [ ] **1a. Add Author types to `src/types/index.ts`:**

```typescript
export interface AuthorInfo {
  name: string;
  isStaff: boolean;  // true if "Staff", "AP", "Reuters", etc.
}

export interface AuthorAnalysis {
  name: string;
  outlet: string;
  articleCount: number;      // Articles in last 30 days
  timeframeDays: number;     // 30
  verdict: 'deep_reporter' | 'moderate' | 'high_volume' | 'unknown';
  searchQuery: string;       // The Brave query used
}
```

- [ ] **1b. Update Source type to include author:**

```typescript
export interface Alternative {
  // ... existing fields
  author?: AuthorInfo;  // NEW
}
```

---

### Step 2: Extract Bylines (Tier 1)

- [ ] **2a. Update Gemini prompt in `route.ts`**
    * Add byline extraction to the per-source analysis:

```typescript
For each source, also extract:
- author: The byline/author name if present (e.g., "Maggie Haberman", "John Smith and Jane Doe")
- If the byline is "Staff", "AP", "Reuters", "AFP", or similar, note isStaff: true
- If no byline is found, set author to null

Add to each source in JSON:
"author": {
  "name": "Author Name" | null,
  "isStaff": boolean
}
```

- [ ] **2b. Parse author from Gemini response**

```typescript
// In source parsing
const author: AuthorInfo | null = source.author ? {
  name: source.author.name || 'Unknown',
  isStaff: source.author.isStaff || false,
} : null;
```

- [ ] **2c. Include author in source data passed to frontend**

---

### Step 3: Display Bylines on Source Cards

- [ ] **3a. Update `SourceFlipCard.tsx` (or equivalent)**
    * Add byline display below outlet name:

```tsx
{/* Author Byline */}
{source.author && (
  <div className="text-xs text-gray-500 mt-1">
    {source.author.isStaff ? (
      <span className="flex items-center gap-1">
        <span>✍️ {source.author.name}</span>
        <span className="text-orange-500" title="Wire/Staff - No individual accountability">
          ⚠️
        </span>
      </span>
    ) : (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAuthorClick?.(source.author.name, source.outlet);
        }}
        className="flex items-center gap-1 hover:text-blue-600 hover:underline cursor-pointer"
      >
        <span>✍️ {source.author.name}</span>
        <span className="text-blue-400">🔍</span>
      </button>
    )}
  </div>
)}
```

- [ ] **3b. Add visual distinction:**

| Byline Type | Display | Meaning |
|-------------|---------|---------|
| Named author | `✍️ Maggie Haberman 🔍` (clickable) | Accountable, can investigate |
| Staff/Wire | `✍️ Staff ⚠️` (not clickable) | Anonymous, low accountability |
| No byline | (don't show) | Unknown |

---

### Step 4: Create Author Analysis API Route (Tier 2)

- [ ] **4a. Create `src/app/api/author/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const authorName = searchParams.get('name');
  const outlet = searchParams.get('outlet');
  
  if (!authorName || !outlet) {
    return NextResponse.json({ error: 'Missing name or outlet' }, { status: 400 });
  }

  // Extract domain from outlet name (rough mapping)
  const domainMap: Record<string, string> = {
    'New York Times': 'nytimes.com',
    'Washington Post': 'washingtonpost.com',
    'CNN': 'cnn.com',
    'Fox News': 'foxnews.com',
    'BBC': 'bbc.com',
    'Reuters': 'reuters.com',
    'AP': 'apnews.com',
    // Add more as needed
  };
  
  const domain = domainMap[outlet] || outlet.toLowerCase().replace(/\s+/g, '') + '.com';
  
  // Build search query for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
  
  const searchQuery = `site:${domain} "${authorName}" after:${dateStr}`;
  
  try {
    // Call Brave Search API
    const braveResponse = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=20`,
      {
        headers: {
          'X-Subscription-Token': process.env.BRAVE_API_KEY || '',
        },
      }
    );
    
    const data = await braveResponse.json();
    const articleCount = data.web?.results?.length || 0;
    
    // Determine verdict based on output volume
    let verdict: 'deep_reporter' | 'moderate' | 'high_volume' | 'unknown';
    if (articleCount === 0) {
      verdict = 'unknown';
    } else if (articleCount <= 4) {
      verdict = 'deep_reporter';  // ~1/week = thorough
    } else if (articleCount <= 12) {
      verdict = 'moderate';       // ~3/week = normal
    } else {
      verdict = 'high_volume';    // 12+ in 30 days = churnalist
    }
    
    const analysis: AuthorAnalysis = {
      name: authorName,
      outlet,
      articleCount,
      timeframeDays: 30,
      verdict,
      searchQuery,
    };
    
    return NextResponse.json(analysis);
    
  } catch (error) {
    console.error('Author analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze author' }, { status: 500 });
  }
}
```

---

### Step 5: Create Author Modal Component

- [ ] **5a. Create `src/components/AuthorModal.tsx`:**

```tsx
'use client';

import { useState, useEffect } from 'react';

interface AuthorAnalysis {
  name: string;
  outlet: string;
  articleCount: number;
  timeframeDays: number;
  verdict: 'deep_reporter' | 'moderate' | 'high_volume' | 'unknown';
  searchQuery: string;
}

interface AuthorModalProps {
  authorName: string;
  outlet: string;
  onClose: () => void;
}

export function AuthorModal({ authorName, outlet, onClose }: AuthorModalProps) {
  const [analysis, setAnalysis] = useState<AuthorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const res = await fetch(
          `/api/author?name=${encodeURIComponent(authorName)}&outlet=${encodeURIComponent(outlet)}`
        );
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setAnalysis(data);
      } catch (err) {
        setError('Could not analyze author');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalysis();
  }, [authorName, outlet]);

  const verdictConfig = {
    deep_reporter: {
      icon: '🎯',
      label: 'Deep Dive Reporter',
      color: 'text-green-700 bg-green-100',
      description: 'Low output suggests thorough, original reporting',
    },
    moderate: {
      icon: '📝',
      label: 'Regular Reporter',
      color: 'text-blue-700 bg-blue-100',
      description: 'Normal output for a working journalist',
    },
    high_volume: {
      icon: '🐹',
      label: 'High Volume',
      color: 'text-orange-700 bg-orange-100',
      description: 'High output may indicate rewrites or aggregation',
    },
    unknown: {
      icon: '❓',
      label: 'Unknown',
      color: 'text-gray-700 bg-gray-100',
      description: 'Could not determine output pattern',
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">👤 {authorName}</h2>
            <p className="text-sm text-gray-500">{outlet}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Analyzing author output...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">{error}</div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Output Stats */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-900">
                {analysis.articleCount}
              </div>
              <div className="text-sm text-gray-500">
                articles in the last {analysis.timeframeDays} days
              </div>
            </div>

            {/* Verdict Badge */}
            <div className={`rounded-lg p-4 ${verdictConfig[analysis.verdict].color}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{verdictConfig[analysis.verdict].icon}</span>
                <span className="font-semibold">{verdictConfig[analysis.verdict].label}</span>
              </div>
              <p className="text-sm mt-1 opacity-80">
                {verdictConfig[analysis.verdict].description}
              </p>
            </div>

            {/* Context from Flat Earth News */}
            <p className="text-xs text-gray-500 italic">
              💡 Per Nick Davies (Flat Earth News): Real reporting takes time. 
              High-volume output often indicates wire rewrites rather than original journalism.
            </p>

            {/* Search Query (for transparency) */}
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-gray-600">
                How we calculated this
              </summary>
              <code className="block mt-2 p-2 bg-gray-100 rounded text-xs break-all">
                {analysis.searchQuery}
              </code>
            </details>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 6: Integrate Modal into Page

- [ ] **6a. Add state to `page.tsx`:**

```tsx
const [authorModal, setAuthorModal] = useState<{
  name: string;
  outlet: string;
} | null>(null);
```

- [ ] **6b. Pass handler to Source Cards:**

```tsx
<SourceCard
  source={source}
  onAuthorClick={(name, outlet) => setAuthorModal({ name, outlet })}
/>
```

- [ ] **6c. Render modal:**

```tsx
{authorModal && (
  <AuthorModal
    authorName={authorModal.name}
    outlet={authorModal.outlet}
    onClose={() => setAuthorModal(null)}
  />
)}
```

---

### Step 7: Test & Deploy

- [ ] **7a. Start dev server:** `npm run dev`
- [ ] **7b. Test scenarios:**
    * Article with named author → Byline shows, clickable
    * Article with "Staff" or "AP" → Byline shows with ⚠️, not clickable
    * Click author → Modal loads → Shows output count + verdict
    * High-volume author → "🐹 High Volume" warning
    * Low-volume author → "🎯 Deep Dive Reporter" badge

- [ ] **7c. Commit and deploy:**

```bash
git add .
git commit -m "feat: Add Author Intelligence - bylines + lazy-load churnalism detection"
git push origin feature/author-intelligence
```

---

## 4. Success Criteria

- [ ] Bylines display on Source Cards (when available)
- [ ] "Staff/Wire" bylines show warning icon, not clickable
- [ ] Named authors are clickable
- [ ] Clicking author opens modal with loading state
- [ ] Modal shows article count + verdict
- [ ] Verdict correctly categorizes output volume
- [ ] Modal explains methodology (transparency)
- [ ] No slowdown to initial search (lazy load works)

---

## 5. Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `src/types/index.ts` | Update | Add `AuthorInfo`, `AuthorAnalysis` |
| `src/app/api/find/route.ts` | Update | Add author extraction to Gemini prompt |
| `src/app/api/author/route.ts` | **NEW** | Author analysis endpoint |
| `src/components/SourceFlipCard.tsx` | Update | Display byline, add click handler |
| `src/components/AuthorModal.tsx` | **NEW** | Author analysis modal |
| `src/app/page.tsx` | Update | Add modal state and rendering |

---

## 6. UI Flow

### Initial State (Tier 1):
```
┌─────────────────────────────┐
│ 📰 New York Times           │
│ [Center-Left] [Public Co.]  │
│                             │
│ ✍️ Maggie Haberman 🔍       │  ← Clickable
│                             │
│ "Trump claims..."           │
└─────────────────────────────┘

┌─────────────────────────────┐
│ 📰 Reuters                  │
│ [Center] [Wire Service]     │
│                             │
│ ✍️ Staff ⚠️                 │  ← Not clickable, warning
│                             │
│ "President meets..."        │
└─────────────────────────────┘
```

### On Click (Tier 2 - Modal):
```
┌─────────────────────────────────────┐
│ 👤 Maggie Haberman              ✕  │
│ New York Times                      │
├─────────────────────────────────────┤
│                                     │
│        ┌─────────────────┐          │
│        │       4         │          │
│        │ articles in 30d │          │
│        └─────────────────┘          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🎯 Deep Dive Reporter       │    │
│  │ Low output suggests         │    │
│  │ thorough, original reporting│    │
│  └─────────────────────────────┘    │
│                                     │
│  💡 Per Nick Davies: Real reporting │
│     takes time...                   │
│                                     │
│  ▶ How we calculated this           │
│                                     │
│        [ Close ]                    │
└─────────────────────────────────────┘
```

---

## 7. Verdict Thresholds

| Articles in 30 Days | Verdict | Icon | Reasoning |
|---------------------|---------|------|-----------|
| 0 | Unknown | ❓ | Can't determine |
| 1-4 | Deep Dive Reporter | 🎯 | ~1/week = thorough research |
| 5-12 | Regular Reporter | 📝 | ~2-3/week = normal workload |
| 13+ | High Volume | 🐹 | ~3+/week = likely aggregation |

---

## 8. Future Enhancements (Tier 3 - NOT this sprint)

Parking these for when/if we build a database:

- [ ] Beat detection ("80% Foreign Policy")
- [ ] Source Cloud ("Relies on unnamed officials")
- [ ] Historical tracking across months
- [ ] Author comparison across outlets
- [ ] Originality scoring vs. wire copy

---

**Date:** December 31, 2025
**Status:** Ready for Builder
**Estimated Time:** 2-3 hours
**Priority:** Medium-High — Unique feature, exposes churnalism
**Depends On:** Provenance (✅), Narrative Decoder (✅)