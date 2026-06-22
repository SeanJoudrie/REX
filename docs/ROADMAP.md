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
- [x] **Client `/discover` response cache + in-flight dedup** — identical
      queries memoized 5min + in-flight dedup (`tmdb.ts`).
- [x] **Auto-pagination / deep candidate pool** — the pool now grows page-by-page
      as the deck drains (page N+1 appended, deduped, `atEnd` latch), so the
      candidate set is hundreds deep instead of one page. "Fresh batch" pulls the
      next page; no more random-page overlap. _Next: a true per-query server
      cursor (TMDB page numbers can still drift on popularity re-sorts)._
- [x] **Telemetry seam (local-first)** — `lib/metrics.ts` tracks the
      deck→open→save→watched→rate funnel + match rounds, all on-device (never
      sent). Surfaced as an "Your activity" panel in Settings (swipes, save rate,
      watched, opened, rated, matches). _Next: dwell-before-decision + proxy
      error rate; optional opt-in cloud aggregate when accounts land._

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
- [x] **The "Mirror" v1** — 4th tab: fingerprint header (generated "taste type"
      line + Top Person/Vibe/Studio hero chips w/ poster collages), per-namespace
      dimension rails (People/Studios/Themes/Genres) with confidence bars, every
      chip tappable → pivot deck, bedrock "films that define you" shelf, and a
      low-confidence "swipe N more" gate. All on-device, no fetch. (`Mirror.tsx`)
      - [ ] **v2:** long-press a chip → tune (more/less/mute) writing affinities.
      - [x] **v3 (share image):** fingerprint rendered to a `<canvas>` and shared
        as a PNG (`navigator.share` files, else download). Plus a copyable
        **taste code** (`lib/tasteShare.ts`) that powers remote blending.
        _Still open: shareable read-only Mirror deep link._
      - [ ] **v2 (tune):** long-press a chip → more/less/mute writing affinities.
- [x] **Match Mode A — pass-the-phone** — 2–4 players swipe one snapshotted deck
      in turn (history-trapped overlay, blind handoff screens), intersection of
      right-swipes = matches, results sheet → open any match. Ephemeral, zero
      infra. (`MatchMode.tsx`, launched from the Mirror)
      - [x] **Mode B — blended deck:** paste a friend's taste code in Match
        setup → `mergeTaste` consensus (`min(A,B)` + a little avg) re-ranks the
        main deck for both of you, with a "Blending with…" banner. Zero infra.
      - [x] **Mode C — remote realtime:** two phones connect by a 4-char code,
        pull one shared deck snapshot, and ~1.5s poll surfaces a live Tinder-style
        "It's a Match!" pop-up the moment both like a title. Round length is
        selectable (Quick 15 / Standard 30 / Marathon 75). Summary shows matches
        plus "recommended for you both" (blended `mergeTaste` recs) when overlap
        is thin. Backend: Supabase `match_rooms` table (RLS-on, no policies) +
        `match` edge function (create/join/sync, CORS+rate-limit, verify_jwt off),
        mirroring `backup`. Client transport (`lib/matchRoom.ts`) is cloud when a
        proxy is set, else localStorage (same-browser demo + offline-testable).
        _Open: true endless paging (Marathon is a large fixed deck); room TTL
        cleanup; presence/disconnect handling._
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

## Motion & desktop (Principal Motion Designer audit)
- [x] **Dropdown white-out** — native `<select>` popups were white-on-white;
      fixed with `color-scheme: dark` + explicit dark `<option>` surfaces.
- [x] **Detail header image fallback** — gradient is now the base layer, so a
      broken/missing poster (e.g. Arcane) shows the title's color signature
      instead of a black void. (Watchlist/Watched thumbs already fell back.)
- [x] **Provider-tier consolidation** — "Netflix Standard with Ads" → "Netflix",
      "Amazon Prime Video" → "Prime Video", "Disney Plus" → "Disney+", etc.,
      then dedup (`canonProvider`/`normalizeProviders` in `tmdb.ts`).
- [ ] **3D card-flip Detail mechanic** — _deferred to a dedicated motion pass._
      Tap a card → fast vanilla-CSS `rotateY` flip to a back face (synopsis +
      metadata + small pinned poster), instead of the current slide-up sheet.
      Constraint: pure CSS transform/transition + raw pointer math, NO Framer
      Motion (deps stay react/react-dom only).
- [ ] **Full transition refactor** — _explicit user note: "refactor this
      transition entirely down the line."_ The open/close currently relies on a
      DURATION constant kept in sync by hand between JS timers and CSS; rebuild on
      a single source of truth (transitionend events / Web Animations).
- [ ] **Bridge UI "teleports"** — add subtle transitions where the app jumps
      instantly between states (tab switches, filter-row changes, empty↔deck).
- [ ] **Full Watchlist/Watched tab parity** — both tabs have provider chips +
      basic sorts, but not Discover's full genre/year/service control set. Bring
      the same filter surface to the library tabs.
- [ ] **Desktop "too wide" sort bars** — app is capped at 640px; on wide desktop
      the filter row still reads wide relative to the 400px deck card. Needs a
      design call on target column width (note kept; not yet changed).

## Brand / motion
- [x] **Rexasaurus Rex (pixel mascot)** — vanilla-SVG pixel-art dino (`Rex.tsx`),
      moods (idle bob / shrug / happy / roar) via CSS keyframes. Lives in the
      loading + empty-deck states, the "you're done" nudge, and a logo-tap (×5)
      easter egg. Calm cross-fade added on tab switches.
- [ ] Full motion refactor (3D card-flip detail + single-source transition
      timing) — still deferred to a dedicated pass.

## UX
- [x] **Graceful exit / "you're done" moment** — after a save (first of a
      session, then every 5th), a calm "you've got something for tonight →
      Watch it" card offers an off-ramp instead of an infinite deck. Suppressed
      in blend mode.
- [ ] _Tuning to refine: cadence/copy once we see real save patterns in metrics._
      Origin thesis (Principal UX Researcher): REX's promise is "pick something in
      ~3 minutes, then go watch it" — not farm endless swiping; the *exit* is the
      product.
