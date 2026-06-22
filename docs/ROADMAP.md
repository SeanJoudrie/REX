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
- [ ] **`rankDeck` v2 + `Affinity` store** (Lead Recsys spec) — replace the flat
      genre `TasteVec` with `A(tag)` keyed by `type:tmdb_id`. Score the ≤100-title
      discover batch (O(batch), client-side, free) — never the DB.
      - **Value matrix** (base u = LIKE_DELTA = 1.0): ★5 +3.0 · ★4 +1.5 ·
        informed-right +1.25 · right +1.0 · ★3 0 · informed-left −0.8 ·
        poster-left −0.4 · ★2 −1.0 · ★1 −2.5 · any left on unavailable service ×0.3.
      - **Type multipliers γ**: director 1.4 · keyword 1.3 · lead actor 1.2
        (×billing decay) · studio 1.1 · genre 1.0 · decade 0.6 · lang 0.5.
      - **Score**: `S = Σ_type γ·clamp(Σ A(tag)·billing·shrink, ±Cap_type)` (match,
        saturating within type so multi-tag stacks win, spam doesn't)
        `+ q·z(vote_avg)·[vote_count≥Vmin]` (quality tie-break)
        `+ ν·novelty·[wildcard slot]` (ε≈15% serendipity, interleaved at fixed
        slots 4/11/18 so they can't be sorted away) `− λ·fatigue` (per-session tag
        over-exposure). Shrinkage `c=n/(n+3)`; EWMA decay (~21d half-life, applied
        lazily on load) so the echo chamber can't calcify.
      - **Watched-loved channel**: ★4–5 accumulate on a separate ~1.8× heavier
        sub-vector (bedrock taste).
      - **Hard filter vs soft penalty**: seen/saved/watched + unavailable-service
        = hard exclude; low vote_count = zero the quality term (not exclude);
        over-served tag = soft fatigue penalty.
      - **OPEN DECISION (blocker for full multi-entity learning):** deck cards
        only carry `genres` — entity tags (cast/studio/keyword) exist only on the
        detail hydrate. To learn entities from *poster-only* swipes we'd have to
        enrich every deck card (~100 extra TMDB detail calls/batch). Options:
        (1) **v1 (recommended): learn entities only from informed actions** —
        Detail-opened + watched/rated titles (which are already enriched and are
        the heaviest-weighted signals anyway); poster-only swipes feed genre
        affinity. No extra cost. (2) Enrich the batch behind a hard metadata
        cache (cost/latency). (3) Edge-function scoring later.
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
      The same `rankDeck` v2 formula relocates into an Edge Function unchanged
      (score the ≤100 candidate batch, never a table scan).

## UX
- [ ] **Graceful exit / "you're done" moment** (Principal UX Researcher thread —
      _spec was cut off mid-message; capturing the thesis so it isn't lost_):
      REX's promise is "pick something in ~3 minutes, then go watch it" — NOT
      farm endless swiping. So the *exit* is the product: detect when the user
      has a good-enough pick (e.g. first save, or N saves) and offer a calm
      "you've got something to watch tonight → [open it]" off-ramp instead of an
      infinite deck. _Await the rest of this spec._
