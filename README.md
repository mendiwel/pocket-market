# Pocket Market (שוק הכיס) — Family Financial Literacy Game

A lightweight, web-first financial literacy game for kids aged 5–12. Kids learn compound interest, passive investing, diversification, emergency funds, passive income and negotiation through a 15-minute daily turn in a shared family economy. Hebrew, full RTL.

See [`SPEC.md`](SPEC.md) for the full specification.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # economy engine unit tests (vitest)
npm run build      # type-check + production build into dist/
```

Routes:

| Route | What |
| --- | --- |
| `#/` | Public parent landing page (curriculum, tier previews) |
| `#/demo` | Zero-login sandbox: in-memory, 1-click tier switcher, "skip to next month" |
| `#/family` | Your family. Local-only (`localStorage`) unless Firebase env vars are set |

The local seed family has 7 children (Yoel, Eliyahu, Yosef, Malki, Dvora, Chani, Tzafrir). **Parent PIN: `1234`.** Change it in the parent area under ⚙️ הגדרות.

## Architecture

```
src/
  types.ts                 data models (SPEC §12, extended)
  engine/                  pure, deterministic game logic — no React
    market.ts              lazy daily tick, drift + volatility, mean reversion,
                           price floors, macro-event guardrails, weather & calendar
    portfolio.ts           monthly settlement, trades, savings tree, inbox,
                           emergency-fund charge order (cash → tree → forced sale)
    rewards.ts             XP, streaks, achievements (SPEC §9.2), guided missions
    negotiation.ts         NegotiationProvider interface + scripted decision tree
    weather.ts             Open-Meteo client + deterministic seasonal fallback
    catalog.ts             assets, events, bills, cosmetics, constants
  data/                    DataRepository: InMemoryDemo / LocalStorage / Firestore
  hooks/                   game store, Hebrew TTS, soft timer
  components/ screens/     UI
```

Key design points:

- **Deterministic market.** All randomness is seeded from `(familyId, month)`, so every device in a family sees the same market.
- **Lazy daily tick.** The first visit on a new calendar date advances the market one game month per missed day, capped at 6. No cron jobs or Cloud Functions.
- **Balanced economy.** Allowance is 150 ₪ and fixed bills are ~50 ₪, which leaves a net flow of about 100 ₪ a month. Prices mean-revert toward a drift trend and stay between 45% and 220% of it. Rewards are mostly XP and cosmetics; cash bonuses are small and capped. Tests check the long-run balance.
- **Age tiers.**
  - Tier 1: auto-TTS and a simplified 3-action screen.
  - Tier 2: percentages, watchlist and businesses.
  - Tier 3: benchmark chart against the index, allocation and passive-income-vs-expenses views.
- **Modern web platform.** Native `<dialog>` with `@starting-style`, Popover API with CSS Anchor Positioning for the glossary, container queries on stock cards and the tree, logical properties throughout, and `prefers-reduced-motion`.

## Firebase (multi-family, Phase 2)

1. Create a Firebase project on the Spark plan. Enable **Google** sign-in and **Firestore**.
2. Copy `.env.example` to `.env` and fill in the web app config.
3. Build and deploy:

```bash
npm run build
```

```bash
npx firebase-tools deploy --only hosting,firestore:rules
```

Families are stored at `families/{uid}`. `firestore.rules` restricts each document to its owner. Feedback goes to the write-only top-level `feedback` collection. CSP and security headers are in `firebase.json`. The Firebase SDK is lazy-loaded, so local and demo modes never download it.

## Pre-deploy audit (SPEC §11.2)

```bash
npx modern-web-guidance@latest install
```

```bash
npx modern-web-guidance@latest legacy-scan
```

Then run Chrome Lighthouse against `npm run preview`.
