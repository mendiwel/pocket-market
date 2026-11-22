# Pocket Market (Family Financial Literacy Game)

A lightweight, web-first ("Webby") financial literacy game designed for kids aged 5–12 to learn core economic concepts—compound interest, passive income, diversification, emergency funds, and negotiation—through a 15-minute daily turn-based experience.

## Core Goals
- **Age-Adaptive UX:** Three tailored tracks (Early Readers 5–6 with full Hebrew TTS, Intermediate 8–10, Advanced 11–12) sharing one unified family market.
- **Balanced Economy:** Controlled cashflow, realistic money sinks, and mean-reverting assets to prevent virtual inflation/deflation.
- **Real-World Connection:** Incorporates real local weather, seasons, and kid-friendly real-world events into market dynamics.
- **Healthy Screen Time:** Hard 15-minute daily turn timer; actively rewards thoughtful passive investing ("doing nothing" is a valid strategy).
- **Multi-Family Ready:** Built on React, TypeScript, Vite, and Firebase (Spark tier) following Google's Modern Web Guidance.

## Tech Stack
- **Frontend:** React + TypeScript + Vite (SVG/CSS animations, native `<dialog>`, Popover API, Container Queries, RTL-first).
- **Backend & Hosting:** Firebase Hosting + Firestore (local-first via Emulator / LocalStorage, cloud-ready).
- **Best Practices:** Guided by [Chrome Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance).

## Project Documentation
- See `SPEC.md` for the full technical architecture, economic formulas, and development milestones.
