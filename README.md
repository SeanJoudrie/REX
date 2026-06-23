# REX — Swipe to Watch 🍿🦖

**REX is a swipe-based movie & TV discovery app.** Swipe right to save something to your
watchlist, left to pass, up to mark it watched. Every swipe quietly teaches REX your
taste, so the deck gets sharper the more you use it. The whole point is to **pick
something to watch in a couple of minutes and then go watch it** — not to doomscroll a
catalog.

It’s a client-only Progressive Web App (installable, works offline) backed by live TMDB
data through a secure proxy. No account required — everything works in guest mode on your
device, with optional cloud backup and remote multiplayer “match” sessions.

**Live:** https://seanjoudrie.github.io/REX/

---

## Table of contents
- [Product thesis](#product-thesis)
- [The experience, feature by feature](#the-experience-feature-by-feature)
- [The recommendation engine](#the-recommendation-engine)
- [Architecture](#architecture)
- [Backend (Supabase Edge Functions)](#backend-supabase-edge-functions)
- [Data & privacy](#data--privacy)
- [Tech stack & conventions](#tech-stack--conventions)
- [Project structure](#project-structure)
- [Running & configuring](#running--configuring)
- [Deployment](#deployment)
- [Known limitations & roadmap](#known-limitations--roadmap)

---

## Product thesis

Discovery apps usually fail at **retention** — people open them when bored, find nothing,
and leave. REX is built around three deliberate bets that try to fix that:

1. **Decide fast, then leave.** The product’s success is the *exit*: once you’ve got a
   good-enough pick, REX nudges you out (“you’ve got something for tonight → Watch it”)
   instead of farming endless swipes.
2. **Show people themselves.** The **Mirror** turns your swipes into a shareable portrait
   of your taste — the kind of thing you screenshot and send a friend. That’s the
   word-of-mouth loop a discovery app normally lacks.
3. **Decide together.** “What do *we* watch tonight?” is the highest-value unsolved
   version of the problem, so REX has real multiplayer **Match** modes — including live,
   two-phone, Tinder-style matching.

---

## The experience, feature by feature

### The swipe deck (Discover)
- **Gestures:** drag right = save to watchlist, left = pass, up = mark watched; tap a card
  to open its detail sheet. A fast *flick* commits even below the distance threshold
  (velocity-aware).
- **Feedback:** animated WATCH / PASS / WATCHED stamps fade in as you drag; distinct
  **haptic** patterns per action; peeking “depth” cards behind the top card; a transparent
  hit-slop around the thumb buttons so fast taps don’t miss.
- **Keyboard:** ←/→ pass/save, ↑ watched, `i` for details (desktop-friendly).
- **Undo:** a one-tap undo after every swipe reverses the list change, the “seen” mark,
  *and* the taste adjustment.
- **Bottomless deck:** the candidate pool **auto-paginates** — as you swipe down, the next
  page is fetched and appended (deduped), so the deck is hundreds deep, not one page. A
  “Fresh batch” button and an honest end-state (“you’ve seen it all”) handle the edges.

### Filters, sorts & search
A single scrollable control row on the deck:
- **Type:** All / Film / TV.
- **Sort modes:** Popular, Top Rated, Box Office, Newest, New on Streaming, Hidden Gems.
- **Genre** and **Year** dropdowns (dark-styled native selects).
- **Streaming service** filter (Netflix, Disney+, Hulu, Max, Prime Video, Apple TV+,
  Paramount+, Peacock) — provider names are normalized/consolidated (“Netflix Standard
  with Ads” → “Netflix”, etc.).
- **Actor search** — type a name; the proxy resolves it to a person and filters by cast.

### “A tag is just a query” — entity pivots
Every taste entity (actor, director, studio, keyword, genre) is tappable. Tap a chip in a
title’s detail sheet (or in your Mirror) and REX builds a **single-entity deck** — a
“Denzel Washington deck,” an “A24 deck,” a “time-loop deck.” A banner shows the active
pivot with a one-tap clear.

### Detail sheet
Opens as a drag-to-dismiss bottom sheet (focus-trapped, Escape/back/backdrop close):
- Poster header with a **gradient fallback** so a missing/broken image never shows a black
  void.
- Synopsis, year, type, rating, genres.
- **“Because you like …”** provenance line when the title overlaps your learned taste.
- **More like this** — tappable tag chips (cast/director/studio/keyword) that pivot the deck.
- **Where to watch** — provider chips; a one-tap handoff (currently a JustWatch title
  search).
- **Share** — native share sheet with a deep link (`#/t/:type/:id`) that cold-opens the
  title for anyone who taps it; clipboard fallback.
- Add/remove from watchlist.

### Watchlist & Watched (your library)
- **Watchlist:** compact **list** or **grid** view, sortable (added / rating / A–Z),
  filterable by provider. Thumbnails fall back to a color gradient if the poster fails.
- **Watched:** a list with inline **1–5 star ratings**. Stars are private recommendation
  signals (★5 = “more like this,” ★1 = “less”), not public reviews.
- **Taste panel** (on Watched): tap genres into a “more of this / less of this” list to
  steer the algorithm directly — “you have a say in the algorithm here.”

### The Mirror (your taste, as a portrait)
A dedicated tab that reflects what REX has learned, computed entirely on-device:
- **Fingerprint header:** a generated **“taste type”** line (e.g. *“Sci-Fi-leaning thriller
  fan with a soft spot for A24”*) plus Top Person / Top Vibe / Top Studio hero chips with
  poster collages.
- **Dimension rails:** scrollable People / Studios / Themes / Genres, each chip with a
  confidence bar and a tap-through to its pivot deck.
- **“Films that define you”:** your ★4–5 shelf.
- **Share image:** renders the fingerprint to a PNG (via `<canvas>`) and shares it.
- **Taste code:** copy a compact code of your taste to hand to a friend for remote
  blending (below).
- A graceful low-confidence state (“swipe N more to develop your Mirror”) until there’s
  enough signal.

### Match modes (“what do WE watch?”)
Launched from the Mirror, three ways to decide with other people:
- **Mode A — Same phone (pass-and-swipe):** 2–4 players take turns swiping the *same*
  snapshotted deck behind blind handoff screens; a title everyone liked is a match.
  Fully ephemeral.
- **Mode B — Blend:** paste a friend’s **taste code** and the main deck re-ranks for *both*
  of you (consensus blend: rewards what you both like, drops what either dislikes), with a
  “Blending with…” banner. Zero infrastructure.
- **Mode C — Two phones (remote, real-time):** connect by a **4-character code**, both
  swipe one shared deck, and a live **“It’s a Match!”** Tinder-style pop-up fires the
  instant you both like a title. Round length is selectable (Quick 15 / Standard 30 /
  Marathon 75). The exit summary shows your matches **plus** “recommended for you both”
  (blended recs) when overlap is thin.

### The “you’re done” moment
After a save (the first of a session, then occasionally) REX surfaces a calm card — *“You’ve
got something for tonight → Watch it”* — the anti-doomscroll off-ramp. Suppressed during
blend mode.

### Rexasaurus Rex (the mascot)
A vanilla-SVG **pixel-art T-rex** named Rexasaurus Rex appears on the loading screen
(sniffing out picks), the empty deck (shrugging), and the “you’re done” card (cheering).
Tap the **REX logo five times** and he roars. Two render styles exist (bold black outline /
soft flat). Comes with subtle cross-fades when switching tabs.

### Insights (private telemetry)
A local-only **“Your activity”** panel in Settings tracks the deck → open → save →
watched → rate → match funnel (swipes, save rate, watched, opened, rated, matches). It
never leaves your device; it exists so you (and the team) can tell whether the
recommendations are actually landing.

### Onboarding & persistence
A one-time soft launch explains the three swipes. Everything (watchlist, watched, ratings,
learned taste, onboarding state) persists in `localStorage` — no account required.

### Backup & restore
In Settings:
- **File backup:** download / restore a JSON snapshot.
- **Cloud backup:** save your data under a random **6-character code** and restore it on
  any device.

### PWA / offline
Installable to the home screen (manifest + icon + apple meta). A service worker does
network-first navigation, stale-while-revalidate for assets, and cache-first for posters,
so the app shell and recently seen art work offline. Registered in production only.

---

## The recommendation engine

All learning is **on-device** and free — it scores each fetched batch client-side; it never
runs a database scan.

- **Genre taste vector (`TasteVec`):** a weight + sample count per genre, nudged by every
  signal. Right swipe amplifies, left suppresses (gently), stars push hardest
  (★5 → +0.30 … ★1 → −0.30). Confidence shrinkage means a genre needs repeats to swing.
- **Entity affinity (`EntityAff`):** weights keyed `type:tmdb_id` for cast, directors,
  studios, and keywords. Fed by **informed** actions (titles you opened or rated, where
  the full tag set is known). Type salience: directors/creators 1.4×, keywords 1.3×, lead
  actors 1.2× (decayed by billing order), studios 1.1×.
- **Value matrix:** distinct deltas for like vs. informed-like vs. pass vs. informed-pass
  vs. each star rating — an impulse right-swipe counts less than a deliberate one.
- **Ranking (`rankDeck`):** `0.55 · taste + 0.35 · quality + 0.10 · serendipity`, then a
  greedy **genre-diversity** pass so the same genre isn’t served back-to-back.
- **Decay:** lazy EWMA decay applied on load (taste drifts over time so the echo chamber
  can’t calcify).
- **“Why this?”** and the **Mirror** read directly from these structures.
- **Blending (`mergeTaste`):** for couples/group decks, a consensus merge —
  `min(A,B) + a little average` — rewards mutual likes and respects either person’s
  dislikes.

> Design note: deck cards only carry genres; entity tags come from the per-title detail
> hydrate. So entities are learned from **informed** actions today (no extra API cost),
> while poster-only swipes feed genre taste. Enriching every card is a documented future
> option.

---

## Architecture

- **Client-only SPA** (React + Vite), deployed as static files to GitHub Pages under the
  `/REX/` base path. No app server.
- **TMDB never touches the client key.** All TMDB calls go through a **Supabase Edge
  Function proxy** that holds the read token. The client points `VITE_TMDB_PROXY` at it
  and calls `/discover`.
- **Response cache + in-flight dedup** in the client so flipping filters back and forth
  doesn’t re-hit the proxy.
- **Transport abstraction for Match:** `lib/matchRoom.ts` talks to the Supabase `match`
  function in production, or falls back to **localStorage** when no proxy is configured —
  which makes it a same-browser demo *and* testable offline.
- **Routing:** hash-based deep links (`#/t/:type/:id`) plus `history.pushState` so the
  system Back button closes sheets/overlays instead of leaving the app.
- **Resilience:** an error boundary wraps the app; fetches have timeouts/abort; untrusted
  proxy payloads are coerced/backfilled so a malformed item can never crash a card.

---

## Backend (Supabase Edge Functions)

Three functions, all gated by a **CORS allowlist** + an **in-memory per-IP rate limit**,
`verify_jwt` off, using the auto-injected `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`:

- **`discover`** — the TMDB proxy. Maps friendly params (genre names, providers, a curated
  studio whitelist, keyword junk-filtering) to TMDB `/discover`; supports the deck,
  single-title detail (`append_to_response=credits,keywords` → `tags[]`), and entity
  pivots. Holds the `TMDB_TOKEN` secret.
- **`backup`** — cloud save/restore of a localStorage snapshot by 6-char code, against a
  `backups` table (RLS on, no policies → reachable only via the function).
- **`match`** — remote match rooms (`create` / `join` / `sync`) against a `match_rooms`
  table (RLS on, no policies). Rooms hold a deck snapshot and each player’s
  `{name, taste, swipes}`; clients poll `sync` (~1.5 s) to surface live matches.

The TMDB token lives **only** in the Supabase secret — never in the repo, the client
bundle, or git history.

---

## Data & privacy

- **On-device (`localStorage`):**
  - `rex_state_v2` — watchlist, watched + ratings, “seen” keys, likes/dislikes, the learned
    taste vector + entity affinity, decay timestamp, onboarding flag.
  - `rex_metrics_v1` — private usage counters (never sent anywhere).
  - `rex_room_<code>` — transient local match rooms (demo/offline transport only).
- **Leaves the device only when you ask:** a cloud **backup** (by code) or a **match**
  session (your name, taste, and swipes for that room) — both low-sensitivity and
  ephemeral/opt-in.
- TMDB requests carry only your filter/query, proxied server-side.

---

## Tech stack & conventions

- **React 19 + Vite + TypeScript + Tailwind v4.**
- **Hard dependency rule:** runtime deps are limited to `react` + `react-dom`. **No
  animation libraries** (no Framer Motion) — every transition and the swipe/drag physics is
  vanilla CSS transforms/transitions + raw pointer math. The mascot is hand-authored SVG
  pixel art.
- Icons are a single inline SVG `Icon` component (no emoji in the UI).
- Accessibility: dialogs use `role="dialog"`/focus traps, controls are labeled, reduced-
  motion is respected.

---

## Project structure

```
src/
  App.tsx              # top-level state, deck loading, learning handlers, layout, nav
  tmdb.ts              # proxy client: DeckQuery, fetchDeck, fetchTitleById, normalization, cache
  types.ts             # Title, Tag, WatchedItem, MediaType
  lib/
    taste.ts           # TasteVec + EntityAff, applySignal/applyEntities, rankDeck, decay, mergeTaste
    storage.ts         # localStorage load/save + export/import (backup)
    metrics.ts         # local-first usage funnel + insights
    tasteShare.ts      # encode/decode the shareable "taste code"
    matchRoom.ts       # remote-match transport (Supabase cloud OR localStorage)
    backup.ts          # cloud backup client
  components/
    SwipeDeck.tsx  MovieCard.tsx  Poster.tsx  Detail.tsx  RatingSheet.tsx  StarRating.tsx
    Watchlist.tsx  Watched.tsx  Mirror.tsx  MatchMode.tsx  RemoteMatch.tsx
    Onboarding.tsx  Settings.tsx  Icon.tsx  Rex.tsx  ErrorBoundary.tsx
supabase/functions/    # discover/ backup/ match/  (Deno edge functions)
public/                # sw.js, manifest.webmanifest, icon.png
docs/                  # ROADMAP.md, MIRROR_AND_MODES.md
.github/workflows/     # deploy.yml (GitHub Pages)
```

---

## Running & configuring

```bash
npm install
npm run dev      # local dev (sample deck if no proxy configured)
npm run build    # tsc + vite build
npm run preview  # serve the production build
```

- With **no** `VITE_TMDB_PROXY`, the app runs on a built-in **sample deck** (20 titles) and
  Match uses the localStorage transport — fully playable with zero setup.
- Set `VITE_TMDB_PROXY` to the deployed `…/functions/v1` base to go live (TMDB data + cloud
  match + cloud backup).

---

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`: every push to **`main`** builds with the
production `VITE_TMDB_PROXY` and publishes to Pages. The live site is
https://seanjoudrie.github.io/REX/.

---

## Known limitations & roadmap

Tracked in [`docs/ROADMAP.md`](./docs/ROADMAP.md). Highlights still open:

- **Remote match:** true *endless* paging (Marathon is currently a large fixed deck), room
  TTL cleanup, and disconnect/presence handling.
- **Engine:** optionally enrich every deck card so poster-only swipes also learn entities
  (cost/latency tradeoff); a fuller multi-entity `rankDeck` v2.
- **Mirror:** long-press a chip to tune (more/less/mute); a shareable read-only Mirror link.
- **Motion:** a dedicated pass (e.g. a 3D card-flip detail view) and a single source of
  truth for transition timing.
- **Accounts:** optional Supabase auth + cloud sync of taste/affinity (the on-device model
  is already structured to relocate into an Edge Function unchanged).
- **Real watch hand-off:** per-provider deep links instead of a JustWatch search.

---

Built with React + Vite + TypeScript + Tailwind. Data by TMDB (via a server-side proxy).
This product uses the TMDB API but is not endorsed or certified by TMDB.
