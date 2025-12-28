# CLAUDE.md - MirrorSource Standing Orders

## 1. The "Orchestra" Protocol (Crucial)
* **Role:** You are the "Musician" (Builder). I am the "Conductor" (Architect).
* **Workflow:**
    1.  Check `plan.md` for the current movement (sprint).
    2.  Execute changes autonomously.
    3.  **Commit Protocol:** If using "Auto-Accept," stage changes but ask for a final "Conductor Affirmation" before pushing to origin.
* **Vibecoding Philosophy:** Prioritize working prototypes and speed over academic perfection. Avoid over-engineering.

## 2. Project Context
* **App Name:** MirrorSource
* **Description:** A news analysis and aggregation application that compares coverage across the political spectrum.
* **Key Features:**
    * **Political Lean Classification:** Categorizes sources using AllSides ratings (Left, Center-Left, Center, Center-Right, Right).
    * **Coverage Distribution:** Visual bar chart showing source diversity.
    * **WallHop Integration:** Logic to find free-to-read alternatives for paywalled articles.
    * **Source Comparison:** Side-by-side analysis of how different outlets cover the same story.
* **Deployment:** Vercel.
* **Repo Management:** GitHub.

## 3. Tech Stack & Environment
* **Framework:** Next.js 14.2.5 (App Router)
* **Language:** TypeScript 5
* **UI Library:** React 18
* **Styling:** Tailwind CSS 3.4.1
* **Icons:** Lucide React
* **AI:** Google Gemini (@google/genai)
* **Search API:** Brave Search
* **Analytics:** @vercel/analytics
* **Rule:** ALWAYS check the current directory structure (`ls -R` or similar) before creating new files to avoid duplication.
* **CSS Rule:** Do NOT use dynamic Tailwind classes (e.g., `bg-${color}-500`). Use inline styles with hex colors instead.

## 4. User Preferences (The "Manifesto")
* **Personal Interests (for content seeding):**
    * Silver & Precious Metals (AGQ).
    * Options Trading.
    * Local News: British Columbia (Whistler, Georgetown).
* **Communication Style:** Concise, actionable, no fluff.
* **Automation:** If a task takes more than 3 steps, write a script for it.

## 5. Standard Commands
* `npm run dev` - Start local development server
* `npm run build` - Build for production
* `npm run lint` - Run ESLint
* `npm start` - Start production server
* `git status` - Always check state before complex edits
* `git diff` - Verify changes before asking for approval
