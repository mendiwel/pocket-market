# Project Specification: Pocket Market — Family Financial Literacy Game (v2.0)

## 1. Executive Summary
A web-based, desktop-first financial literacy simulation game designed for children aged 5 to 12. The application teaches real-world economic concepts—compound interest, passive investing, diversification, emergency funds, passive income, and negotiation—through a shared family virtual economy.

- **Primary Language & Direction:** Hebrew (`he-IL`), full Right-to-Left (`dir="rtl"`).
- **Platform:** Web application ("Webby", browser-based, no mobile phones required for kids).
- **Scalability:** Architected from day one as a **Multi-Family (Multi-Tenant)** platform, starting with a local single-family MVP and scaling seamlessly to **Firebase Hosting + Cloud Firestore (Spark Free Tier)**.
- **Public Onboarding:** Includes a **Zero-Login Parent Landing Page & Interactive Demo** so any parent can understand the educational value and test-drive the game before creating an account.

---

## 2. Public Parent Landing Page & Zero-Login Interactive Demo
Before any login screen, external visitors and parents land on a clear, engaging public overview page:

### 2.1 Visual & Textual Parent Guide ("What is Pocket Market?")
- **Hero Section:** Clear value proposition explaining the 15-minute daily habit, zero phone requirement, and age-adaptive tracks (ages 5–12).
- **Curriculum Matrix (Visual + Textual):** Clean cards illustrating *what* kids learn and *how* the game teaches it:
  - *Compound Interest* → Visual Savings Tree growing over time.
  - *Passive Investing & Patience* → "Stay Passive Today" button + Market Index.
  - *Emergency Fund* → Unexpected life expenses in the Inbox.
  - *Passive Income* → Owning cash-flowing mini-businesses.
  - *Negotiation & Budgeting* → Virtual Service Rep chat.
- **Interactive Preview Gallery:** Annotated visual walkthroughs (SVG/UI previews) of the 3 age tiers so parents immediately see the difference between a 5-year-old's screen and a 12-year-old's screen.

### 2.2 Zero-Login Interactive Sandbox (Demo Mode)
- A prominent **"נסו עכשיו בלי הרשמה" (Try Demo Without Signing Up)** button.
- Runs 100% client-side in an isolated, ephemeral in-memory state (never touches Firestore).
- **1-Click Tier Switcher:** Allows parents to toggle instantly between a **Tier 1 (Age 5–6 with TTS)**, **Tier 2 (Age 8–10)**, and **Tier 3 (Age 11–12)** demo child to experience a full simulated day: reading news, negotiating with the rep, buying a stock or staying passive, and advancing a simulated month to see compound interest in action.

---

## 3. Target Audience & Age-Adaptive Tiers
All children in a family participate in the **same shared market** and experience the same macro news, encouraging family discussions. The UI complexity and scaffolding adapt dynamically based on the active child's profile tier.

*Default Local Seed Family (7 Children):*

| Tier | Default Seed Profiles | UI & Scaffolding Requirements |
| :--- | :--- | :--- |
| **Tier 1: Early Learners (Ages 5–6)** | Yoel (5), Eliyahu (6) | **Auto-TTS** (Hebrew Web Speech API) reads screens, news, and buttons aloud automatically. Icon-driven UI (growing money tree, piggy bank, weather/mood emojis). Simplified 3–4 core actions per turn. No complex charts. Illustrated 2–3 button choices for negotiations. |
| **Tier 2: Intermediate (Ages 8–10)** | Yosef (8), Malki (9), Dvora (10) | Hybrid visual metaphors + clear numbers and percentage changes. Access to all stock sectors, Watchlist, and passive income assets. Structured 3–4 option negotiation scripts. On-demand TTS speaker button next to text blocks. |
| **Tier 3: Advanced (Ages 11–12)** | Chani (11), Tzafrir (12) | Full portfolio analytics: historical performance charts, **Benchmark Comparison** against the General Market Index, Watchlist, passive income vs. fixed expenses breakdown, and diversification indicators. Advanced negotiation scripts (architected for future LLM/Gemini API chat). |

---

## 4. Core Gameplay Loop & Time Management
To prevent excessive screen time while encouraging thoughtful, deliberate decision-making:

1. **Family Profile Selector:** Displays all children's avatars. Kids who completed today's turn show a `✅` badge and are locked until the next real-world day.
2. **Time Compression:** **1 real-world day = 1 game month**.
3. **Soft 15-Minute Timer:**
   - Starts upon entering a child's turn.
   - Displayed as a calm, non-stressful progress bar (avoid frantic ticking seconds).
   - Gentle visual/audio prompt at 3 minutes remaining.
4. **Daily Turn Flow:**
   - **Step 1 — Morning Briefing:** Review portfolio changes since yesterday, see today's real-world weather & Market News, and collect monthly allowance + passive income (minus fixed expenses).
   - **Step 2 — Inbox / Virtual Rep:** Handle pending life events, unexpected bills, or service-provider price hikes.
   - **Step 3 — Action Phase:** Buy/sell assets, manage Watchlist, deposit into the Savings Tree, purchase passive income assets, **OR** click the prominent **"Stay Passive Today (Do Nothing)"** button.
   - **Step 4 — End Turn & Handoff:** Clicking "Finish Turn" saves state, awards daily XP/streak, locks the profile until tomorrow, and returns to the Family Profile Selector.
5. **Lazy Daily Market Tick (Serverless-Friendly):**
   - No cron jobs or paid Cloud Functions required.
   - When the *first* child in a family logs in on a new calendar date, the app checks `lastMarketTickDate`. If it is a new day, the market engine deterministically advances by 1 game month for the entire family before rendering the turn.

---

## 5. Balanced Economic Engine (Anti-Inflation / Anti-Deflation)
The economy must maintain realistic purchasing power over months of play without runaway inflation or frustrating deflation.

### 5.1 Currency & Cash Flow
- **Currency:** Virtual Shekels (`₪`).
- **Starting Capital:** `1,000 ₪` per child.
- **Monthly Base Income (Allowance):** `150 ₪` per game month (turn).
- **Fixed Living Expenses (Money Sinks):** `40–60 ₪` per game month (virtual subscriptions/upkeep), reducible via negotiation.
- **Net Disposable Cash Flow:** `~90–110 ₪` per turn available for saving/investing.

### 5.2 Asset Pricing & Mean Reversion
- **Stock / Index Unit Prices:** Initialized between `50 ₪` and `120 ₪` (supports fractional shares or whole units).
- **Passive Income Assets:** Priced between `400 ₪` and `800 ₪`, yielding `4%–6%` monthly (`20–40 ₪`/month).
- **Mean Reversion:** Individual stocks that spike or crash due to events gradually gravitate back toward their fundamental trend line over subsequent months to prevent permanent price distortion.

### 5.3 Asset Classes & Real-World Sensitivity

| Asset (Hebrew Example) | Category | Risk / Volatility | Real-World Drivers |
| :--- | :--- | :--- | :--- |
| **Cash / Emergency Fund** (`קופת מזומן`) | Liquid Cash | 0% yield, instant liquidity | Covers unexpected life expenses without selling stocks at a loss. |
| **Savings Tree** (`עץ החיסכון`) | Compound Deposit | Low (~0.6% / game month) | Visual tree grows leaves/coins the longer funds remain untouched. |
| **General Market Index** (`סל השוק הכללי`) | Diversified ETF | Low-Medium, positive drift | Broad market health; core vehicle for passive investing & benchmarking. |
| **Super-Shchuna** (`סופר-שכונה`) | Consumer Staples | Low (Defensive) | Stable during crises; people always buy bread and milk. |
| **Power & Fuel** (`חשמל ואנרגיה`) | Utilities / Energy | Medium | Rises during extreme weather (heatwaves/winter) or geopolitical tension. |
| **Shield / Med-Care** (`כיפת-מגן / רפואת-חירום`) | Crisis / Defense | Counter-cyclical | **Rises during war, security tension, or crises**; dips slightly in calm periods. |
| **Ice Cream / Tourism / Gaming** (`גלידות ותיירות / גיימינג`) | Leisure & Tech | High (Growth) | **Surges in peaceful times & summer**; drops sharply in storms or crises. |
| **Lemonade Stand / Slushie Machine** (`דוכן לימונדה / מכונת ברד`) | Passive Income Asset | Fixed monthly cash flow | Generates recurring income; directly boosted/dampened by real weather. |

---

## 6. Real-World Lifecycle, Weather & Controlled Randomness
To make the simulation feel alive and grounded in reality without turning it into a stressful news feed:

1. **Live Weather & Seasonal Integration (Open-Meteo API):**
   - Uses the free, keyless **Open-Meteo API** (defaulting to Israel coordinates, configurable per family) with a graceful seasonal fallback if offline.
   - Real-world heatwaves boost *Ice Cream/Tourism*, *Power & Fuel*, and *Lemonade Stand* yields; winter storms dampen leisure and boost utilities.
2. **Real-World Calendar & Kid-Friendly Events:**
   - Integrates seasonal milestones (summer vacation, back-to-school, holidays) and softened, kid-friendly translations of real-world economic themes (e.g., *"Global microchip shortage"* or *"Energy prices rising"*) rather than anxiety-inducing headlines.
3. **Controlled Randomness ("Chaos with Guardrails"):**
   - **Natural Volatility:** Each asset follows `baseDrift + volatility`.
   - **Macro Events:** Triggered randomly every **3 to 6 turns** for the whole family.
   - **Personal Life Events:** Triggered randomly per child via the In-App Inbox (e.g., broken bike chain `-40 ₪`, neighborhood chore `+60 ₪`, subscription price hike).
   - **Safety Guardrails:** Never trigger two high-severity crashes consecutively; enforce price floors so young kids are never wiped out.

---

## 7. Investopedia-Inspired Educational Features
Adapted from Investopedia's simulator specifically for ages 5–12 (explicitly excluding short-selling, options, margin, and day-trading):

1. **Inline Interactive Glossary (Popover API):** Every financial term (*ריבית דריבית, מדד, דיבידנד, קרן חירום, פיזור*) is interactive. Clicking it opens a native Popover bubble with a kid-friendly explanation and a TTS speaker button.
2. **Watchlist (`רשימת מעקב`):** Kids can "star" stocks to track their price movement for a few turns before committing money—teaching research and patience.
3. **Benchmarking (Tier 3):** Portfolio performance charts overlay a dashed line representing the **General Market Index** so older kids see how their active picks compare to passive indexing.
4. **Guided Missions (`משימות למידה`):** Structured short-term educational goals (e.g., *"Hold 3 different asset categories for 5 turns"*, *"Watch a stock for 2 turns before buying"*).

---

## 8. Virtual Representative & Negotiation System
Replaces external messaging apps (like WhatsApp) with a safe, built-in **In-App Inbox**:
- **Phase 1 (MVP):** Scripted decision-tree scenarios (0 API cost). Players choose from strategic responses (*Polite Negotiation*, *Threaten to Cancel*, *Compare Competitor*, *Accept Price*).
- **Phase 2 (Extensible):** Abstract behind a `NegotiationProvider` interface so a live LLM (e.g., Gemini API) can be plugged in later for free-text chat for Tier 3 kids without refactoring the UI.

---

## 9. Non-Inflationary Rewards & Achievements System
To encourage daily engagement and habit formation **without** inflating the virtual economy:

### 9.1 Dual-Track Rewards (XP vs. Capped Micro-Cash)
- **Primary Track — XP, Streaks & Cosmetics (Zero Inflation):** Daily logins, reading Market News, and choosing "Stay Passive" award **Stars (XP)** and maintain a **Daily Streak**, unlocking avatar accessories, Savings Tree themes, and badges.
- **Secondary Track — Capped Micro-Cash Bonuses:** Completing a 5-day streak or a Guided Mission awards a small, strictly capped bonus (`15–20 ₪`), pre-balanced against the economy's Money Sinks.

### 9.2 Core Achievements

| Achievement | Criteria | Lesson Reinforced |
| :--- | :--- | :--- |
| **Calm in the Storm** (`רגוע בסערה`) | Do not sell stocks during a Market Correction event. | Avoiding panic selling. |
| **Patience Pays** (`כוח הסבלנות`) | Choose "Stay Passive Today" 3 times. | Avoiding over-trading. |
| **Safety Net** (`רשת ביטחון`) | Maintain at least 150 ₪ in Cash for 3 consecutive turns. | Emergency fund discipline. |
| **Tree Grower** (`מגדל עצים`) | Earn compound interest in the Savings Tree for 5 consecutive turns without withdrawing. | Compound interest. |
| **Smart Negotiator** (`אלוף המיקוח`) | Successfully lower a recurring bill via the Virtual Rep. | Active expense management. |
| **Passive Builder** (`הכנסה בזמן שינה`) | Purchase your first Passive Income Asset. | Building cash-flowing assets. |
| **Diversifier** (`פיזור חכם`) | Hold at least 3 different asset categories simultaneously. | Diversification. |

---

## 10. Multi-Family Architecture, Parent Portal & Feedback System
Designed so additional families can onboard independently in Phase 2:

- **Multi-Tenant Data Isolation:** All family data is scoped under `families/{familyId}` in Firestore, authenticated via Parent Google Sign-In, with simple PIN/avatar switching for children.
- **Parent Portal (PIN-Protected):**
  - **Child Management:** Add/edit/remove children, set age tiers, reset daily turn locks.
  - **Budget & Real-Life Integration:** Configure monthly allowance/expenses, award virtual bonuses for real-world chores, or inject custom family news events.
  - **Progress Analytics:** Side-by-side overview of each child's net worth, diversification, streak, and earned achievements.
  - **Built-in Feedback & Bug Reporter:** Dedicated tab allowing parents to submit bug reports, feature requests, or difficulty feedback. Saves to a top-level `feedback` collection in Firestore along with non-PII diagnostic metadata (current route, browser user-agent, app version) for streamlined triage.

---

## 11. Technical Architecture & Modern Web Guidance
The codebase **must** adhere to Google Chrome's **Modern Web Guidance** (`https://developer.chrome.com/docs/modern-web-guidance`).

### 11.1 Tech Stack
- **Frontend:** React 19+ with TypeScript, bundled with Vite.
- **Styling:** Modern CSS (CSS Modules or Tailwind CSS v4) using **CSS Logical Properties** (`margin-inline`, `padding-block`, `inset-inline-start`) for native RTL support.
- **Graphics:** Lightweight, crisp **SVG illustrations** + CSS animations. Avoid heavy 3D/Canvas engines.
- **Audio / TTS:** Native browser **Web Speech API** (`window.speechSynthesis`, `he-IL`) with graceful fallback.

### 11.2 Modern Web Guidance Checklist
- **Native `<dialog>`:** Use HTML `<dialog>` with CSS `@starting-style` transitions for modals (Market News, Buy/Sell, Negotiation Inbox, Feedback form).
- **Popover API & CSS Anchor Positioning:** Use native `popover` attributes for the Inline Glossary tooltips, with `@supports` fallbacks where needed.
- **CSS Container Queries:** Use `@container` for stock cards, portfolio widgets, and the Savings Tree.
- **Core Web Vitals (INP & CLS):** Animate strictly compositor-friendly properties (`transform`, `opacity`). Reserve explicit dimensions for SVGs and cards.
- **Accessibility (a11y):** Semantic HTML, high-contrast palette, large click targets for 5-year-olds, keyboard navigation, and `prefers-reduced-motion` support.
- **Verification Tooling:** Run `npx modern-web-guidance@latest install` in the repo root and validate with `npx modern-web-guidance@latest legacy-scan` + Chrome Lighthouse before deployment.

### 11.3 Cloud-Ready Data Layer (Repository Pattern)
Abstract all persistence behind a `DataRepository` TypeScript interface:
- **Demo Mode:** `InMemoryDemoRepository` (ephemeral, zero-login sandbox).
- **Phase 1 (Local):** `LocalStorageRepository` (instant local testing).
- **Phase 2 (Firebase Spark Free Tier):** `FirestoreRepository` + Firebase Auth + Firebase Hosting with strict Firestore Security Rules and CSP headers in `firebase.json`.

---

## 12. Core Data Models (TypeScript Blueprint)

```ts
export type AgeTier = 'early' | 'intermediate' | 'advanced';

export interface WeatherContext {
  date: string; // YYYY-MM-DD
  temperatureC: number;
  condition: 'sunny' | 'heatwave' | 'mild' | 'rainy' | 'storm';
  season: 'summer' | 'autumn' | 'winter' | 'spring';
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  tier: AgeTier;
  avatarId: string;
  cash: number;
  savingsTreeBalance: number;
  savingsStreakMonths: number;
  holdings: Record<string, number>; // assetId -> units
  watchlist: string[]; // Investopedia-style tracked asset IDs
  passiveAssets: string[];
  fixedMonthlyExpenses: number;
  xp: number;
  dailyStreak: number;
  unlockedCosmetics: string[];
  achievements: string[];
  lastTurnDate: string | null; // YYYY-MM-DD
  netWorthHistory: { month: number; totalValue: number; indexBenchmark: number }[];
}

export interface MarketAsset {
  id: string;
  nameHe: string;
  category: 'index' | 'staples' | 'energy' | 'crisis' | 'leisure_tech';
  currentPrice: number;
  basePrice: number;
  baseDrift: number;
  volatility: number;
  priceHistory: number[];
}

export interface MacroEvent {
  id: string;
  titleHe: string;
  descriptionHe: string;
  ttsTextHe: string;
  categoryImpacts: Partial<Record<MarketAsset['category'], number>>;
  severity: 'low' | 'medium' | 'high';
}

export interface FamilyGameState {
  familyId: string;
  parentPinHash: string;
  currentMonth: number;
  lastMarketTickDate: string; // YYYY-MM-DD
  weather: WeatherContext;
  assets: MarketAsset[];
  activeMacroEvent: MacroEvent | null;
  lastHighSeverityMonth: number;
  children: ChildProfile[];
}

export interface FeedbackReport {
  id: string;
  familyId: string;
  type: 'bug' | 'improvement' | 'difficulty' | 'other';
  message: string;
  createdAt: string;
  metadata: {
    appVersion: string;
    route: string;
    userAgent: string;
  };
}
```

---

## 13. Phased Implementation Plan
1. **Milestone 1 (Core Skeleton, Landing & Demo Mode):** Vite + React + TS setup, RTL layout, Public Parent Landing Page, Zero-Login Interactive Demo (`InMemoryDemoRepository`), `LocalStorageRepository` with the 7-child seed, 15-minute soft timer, and the Economic Engine.
2. **Milestone 2 (Gameplay, Weather & Investopedia Features):** SVG Savings Tree, Market Board, Open-Meteo weather integration, Buy/Sell `<dialog>`, "Stay Passive" flow, Inline Glossary Popovers, Watchlist, Benchmarking charts, and Hebrew Web Speech API.
3. **Milestone 3 (Inbox, Rewards, Achievements & Parent Portal):** Scripted Virtual Rep negotiation inbox, XP/Streak rewards & Achievements engine, PIN-protected Parent Portal (kids, budget, chores, and Feedback/Bug Reporter).
4. **Milestone 4 (Audit & Multi-Family Firebase Deployment):** Modern Web Guidance audit (`legacy-scan` + Lighthouse), `FirestoreRepository` + Google Auth (`families/{familyId}`), Firestore Security Rules, CSP headers, and deployment to Firebase Hosting.