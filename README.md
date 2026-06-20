# REX — Swipe to Watch 🍿

A swipe-based movie & TV discovery app. Swipe right = "want to watch" (→ watchlist),
swipe left = "not interested." Tinder for what to watch tonight.

This repo is **Phase 1, guest-mode first**: it runs end-to-end with **zero setup** on a
built-in sample deck so the swipe feel is real today. TMDB (live data) and Supabase
(accounts + sync) drop in next — the code is structured for them.

## Run it
```bash
npm install
npm run dev
```
Open the local URL, swipe the deck, build a watchlist. Everything saves on-device
(localStorage) — no account needed.

## What's built (Phase 1 core)
- **Swipe deck** — drag right to save / left to pass, with WATCH/PASS stamps, haptics,
  peeking depth cards, and bottom thumb-zone buttons (swipe is primary).
- **Tap a card → detail sheet** — synopsis, where-to-watch, one-tap handoff (JustWatch
  search for now; real deep links come with TMDB).
- **Watchlist** — denormalized & rendered with zero API calls; filter by provider.
- **Film / TV / All** toggle, deck-exhaustion handling, guest persistence.

## Next steps (need your accounts — I can't create these)
1. **TMDB** — make a free API key, then build a **Supabase Edge Function proxy** that
   holds the key and serves `/discover` (never ship the key client-side). Point
   `VITE_TMDB_PROXY` at it (see `src/tmdb.ts`) and the deck goes live automatically.
2. **Supabase** — auth (anonymous + OAuth, so signup stays deferred past the aha moment),
   plus `profiles` / `preferences` / `swipes` tables with RLS.
3. **Phase 2** — friends + one-recommendation-per-week (server-enforced).

## Architecture notes
- Don't mirror TMDB into the DB — call it on demand through the cached proxy; store
  only *user* data.
- Watchlist denormalizes display fields at swipe time (no N+1, works offline).
- Keep the repo private once real keys exist.

Built with React + Vite + TypeScript + Tailwind.
