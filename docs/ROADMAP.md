# REX roadmap / tracked debt

Running list of things identified but not yet (fully) built, so nothing is lost.
Checked items are done; unchecked are open with notes.

## Architecture audit
- [x] ErrorBoundary (#8)
- [x] Backup/export — file + cloud code (#9)
- [x] Proxy gating — CORS lock + per-IP rate limit (#8) — _partial: rate limit is
      best-effort in-memory per instance, not distributed. Upgrade: Postgres/Redis
      token bucket keyed by IP._
- [x] Service worker / offline app-shell + poster cache (#11)
- [x] Deep-link + native share (#10)
- [ ] **Client `/discover` response cache + in-flight dedup** — identical
      (filter,sort,genre,page,pivot) queries should be memoized; back-and-forth
      filtering currently re-hits the proxy.
- [ ] **Server-cursor pagination** — "Fresh batch" uses a random page, not page
      N+1; heavy users get shrinking/overlapping pools. Track a per-query cursor.
- [ ] **Telemetry seam** — instrument deck→save→watched funnel, dwell-before-
      decision, proxy error rate. No analytics today.

## Micro-features
- [x] Undo last swipe (#8)
- [x] Velocity-aware flick commit (first swipe-engine pass)
- [x] Shareable deep-link + native share (#10)
- [ ] **Context-aware haptic grammar** — have basic per-action buzzes; want
      double-pulse watched, undo tick, milestone buzz every 10th save.
- [ ] **Expanded hit-slop** on thumb controls — wrap buttons in transparent
      padding/negative margin so the tap target exceeds the visual circle.
- [ ] **Real one-tap watch handoff** — persist per-provider deep links onto saved
      titles (from JustWatch data on the TMDB detail response) and surface a play
      link in the watchlist; today it's a JustWatch search.

## Taste-graph (multi-entity) — Principal Data Architect spec
Canonical key everywhere: `type:tmdb_id` (e.g. `person:5292`, `company:41077`).
- [x] **Proxy tag enrichment** — single-title detail returns `tags[]`
      (genres + top cast + director/creator + whitelisted studios + keywords).
- [x] **`deckFromTag`** — tap any tag (Detail chip) → entity deck via discover
      pivot (`with_cast`/`with_people`/`with_companies`/`with_keywords`/`with_genres`).
- [ ] **Generalize `TasteVec` → `Affinity`** keyed by `type:id` and learn over
      ALL tags on every swipe (needs per-card enrichment, which is expensive on
      the deck endpoint — current enrichment is detail-only). Options: enrich a
      shortlist, or accept the extra TMDB calls behind a hard metadata cache.
- [ ] **The "Mirror"** — 4th screen: fingerprint header (Top Actor/Vibe/Studio as
      poster collages), per-namespace dimension rails, every chip tappable
      (pivot) + long-press to tune (more/less/mute → writes affinities), evidence
      on demand, low-confidence "swipe N more to unlock" state.
- [ ] **Taste-recipe builder** — boolean tag stacking (A24 + Horror − Found-Footage)
      → transient deck via with_/without_ params.
- [ ] **Smart shelves + "why this?" provenance** — pin a tag/recipe as a reusable
      shelf; render per-card provenance from card tags ∩ top affinities.
- [ ] **Unified `/search/multi`** — typeahead returns titles + people + companies
      + keywords grouped by type; selecting an entity pivots its deck.
- [ ] **Supabase affinity tables** (when accounts land): `tags`, `title_tags`,
      `affinities` (RLS to auth.uid()); atomic upsert weight/samples per swipe.
      Don't mirror TMDB — `title_tags` is only for "why this," decks stay live.
