# 🎵 Project MirrorSource: Orchestration Plan

## 1. Global Context & Rules
* **App Name:** MirrorSource
* **Core Stack:** Next.js 14, Tailwind 3.4, Brave Search API.
* **Primary Rule:** DO NOT hallucinate file paths. Always check `ls` before editing.

## 2. Current Sprint (The "Active" Sheet Music)
**Goal:** Micro-Polish - Strip HTML Tags from Search Snippets

### Context
> **The Problem:** The fallback text (Brave Search snippets) contains raw HTML tags like `<strong>` and `</b>`, which are visible to the user and look broken.
> **The Fix:** Sanitize the text by stripping all HTML tags before rendering.

### Execution Checklist
- [ ] **Step 1 (The Sanitizer):** Open `src/components/SourceFlipCard.tsx`.
- [ ] **Step 2 (Helper Logic):** Inside the component (or as a utility function), add a simple regex cleaner:
    ```typescript
    const cleanSnippet = (text: string) => {
      if (!text) return '';
      // Remove HTML tags
      return text.replace(/<[^>]*>?/gm, '')
        // Optional: Decode HTML entities if needed (e.g. &amp;)
        .replace(/&nbsp;/g, ' ');
    };
    ```
- [ ] **Step 3 (Apply):** Locate where `source.snippet` is rendered in the fallback logic. Wrap it in the cleaner: `cleanSnippet(source.snippet)`.
- [ ] **Step 4 (Commit):** `git add . && git commit -m "Fix: Strip HTML tags from source snippets" && git push`

### Success Criteria
- [ ] Cards for BBC/Fox/CNN show clean text (e.g., "Two pilots...") without `<strong>` tags.