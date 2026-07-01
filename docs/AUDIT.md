# REX — Full Feature Overhaul, Algorithm Audit & Seamless-UX Pass

_Audit date: 2026-07-01. Every claim below was verified against the actual code,
and the algorithm findings were **measured** by running `src/lib/taste.ts`
through a simulation harness (constructed decks + constructed users, 400
rank runs per case). Fixes marked ✅ shipped in this branch; everything else is
ranked in the blueprint at the end._

---

## Phase 1 — Current state

### Feature inventory

| Area | State | Where |
|---|---|---|
| Swipe deck (3-way swipe, flick velocity, stamps, haptics, keyboard, undo) | Built, solid | `SwipeDeck.tsx`, `App.tsx` |
| Auto-pagination w/ dedup + `atEnd` latch | Built | `App.tsx` `loadMore` |
| Filters (type/sort/genre/year/service/actor) | Built; **TV genre filter was silently broken** (fixed ✅) | `App.tsx`, `supabase/functions/discover` |
| Entity pivots ("a tag is just a query") | Built | `App.tsx` `deckFromTag`, `discover` |
| Detail sheet (drag-dismiss, focus trap, share deep link, providers) | Built, polished | `Detail.tsx` |
| Watchlist (list/grid, sorts, provider filter) | Built | `Watchlist.tsx` |
| Watched + stars + taste panel | Built | `Watched.tsx`, `StarRating.tsx` |
| Learning engine (genre vector + entity affinity + decay) | Built; **ranking barely used it** (fixed ✅) | `lib/taste.ts` |
| Mirror (taste portrait, rails, share image, taste code) | Built v1+v3; tune (v2) missing | `Mirror.tsx` |
| Match A — pass-the-phone (2–4 players) | Built | `MatchMode.tsx` |
| Match B — blend by taste code | Built; **no explainability** (fixed ✅) | `MatchMode.tsx`, `App.tsx` |
| Match C — remote realtime rooms | Built; **silent death on room loss** (fixed ✅), no endless paging | `RemoteMatch.tsx`, `lib/matchRoom.ts`, `functions/match` |
| Onboarding | Was rules-only; **no taste capture** (fixed ✅) | `Onboarding.tsx` |
| Backup (file + cloud code) | Built | `Settings.tsx`, `lib/backup.ts`, `functions/backup` |
| Local metrics / insights panel | Built | `lib/metrics.ts`, `Settings.tsx` |
| PWA (SW, manifest, offline shell) | Built (prod only) | `public/sw.js`, `main.tsx` |
| Accounts / cross-device sync / push | **Not built** | — |
| Messaging / shared watchlist / social layer | **Not built** | — |
| Feedback on match quality (good/bad match) | **Not built** | — |

Nothing is dead code; the half-built areas are Mirror v2 (long-press tune) and
remote-match endless paging (Marathon = fixed 75-card deck).

### User journey (state by state)

1. **Onboarding** (`Onboarding.tsx`): swipe rules → _(new ✅)_ genre picker that
   seeds the algorithm → deck.
2. **Discover** (`App.tsx`): loading (Rex idle) → deck → empty ("fresh batch")
   → true end ("all out of fresh meat") → error (retry). Cold-start banner
   under 10 swipes. Undo pill after every swipe. "You're done" nudge after the
   1st/5th save.
3. **Detail**: tap card → sheet → tags pivot the deck; share deep-links
   `#/t/:type/:id`.
4. **Library**: Watchlist ↔ Watched (+rating sheet on swipe-up).
5. **Mirror**: gated below 12 swipes → portrait (taste type, rails, bedrock) →
   share image / taste code / Match CTA.
6. **Match**: hub → two-phone (code, live pop-ups, summary + blended recs) |
   same-phone (handoff, results) | blend (paste code → _(new ✅)_ compatibility
   card → blended deck banner).
7. **Retention**: none beyond PWA install — no notifications, no daily hook
   (see Phase 4).

### Data model

- `Title` (`types.ts:13`) — denormalized TMDB row; `tags?: Tag[]` only after a
  detail hydrate. `WatchedItem = Title + stars`.
- `TasteVec` (`taste.ts:5`) — `{ [genre]: { w: -1..1, n: samples } }`.
- `EntityAff` (`taste.ts:9`) — `{ "type:id": { w, n, type, label } }`.
- Persistence: single `localStorage` blob `rex_state_v2` (`storage.ts`);
  metrics under `rex_metrics_v1`; rooms in Supabase `match_rooms` (RLS on, no
  policies, service-role only) or `rex_room_<code>` in localStorage demo mode.

### Dependency map (engine → product)

```
swipes/ratings ──▶ TasteVec ──▶ buildQuery (withGenres/withoutGenres) ──▶ discover proxy
   (App.tsx)         │      └──▶ rankDeck (orders every page)  ──▶ SwipeDeck
opened/rated ──▶ EntityAff ──▶ Mirror rails / taste type / hero chips
                     │     └──▶ whyThis (Detail provenance)
                     │     └──▶ (new ✅) exploration pages in loadMore
                     │     └──▶ (new ✅) entityFit term in rankDeck
TasteVec ──▶ encodeTaste ──▶ friend pastes ──▶ mergeTaste ──▶ blended deck + banner
TasteVec ──▶ match rooms (player.taste) ──▶ "recommended for you both" + (new ✅) match reasons
```

---

## Phase 2 — Algorithm audit (measured)

### How it works (after this branch)

- **Learning** (`taste.ts`): every swipe nudges genre weights
  (`LIKE_DELTA` +0.15, `PASS_DELTA` −0.08, stars ±0.30 max, informed actions
  ×1.25/×2); entity affinity from informed actions with type salience
  (director 1.4 > keyword 1.3 > person 1.2×billing > studio 1.1); lazy EWMA
  decay (0.98^days ≈ 34-day half-life) on load.
- **Ranking** (`rankDeck`, `taste.ts`): per candidate
  `0.62·tasteScore + 0.24·quality + 0.14·entityFit + 0.02·tiebreak`, greedy
  genre-diversity ordering with per-genre-normalized penalty, and every 8th
  slot is a **wildcard** (best remaining quality regardless of taste).
- **Query shaping** (`App.tsx buildQuery`): likes/top-genres → `withGenres`,
  dislikes/bottom-genres → `withoutGenres`; blend adds the friend's.
- **Blending** (`mergeTaste`): `min(A,B) + 0.25·(avg−min)` per genre.

### What the harness found in the OLD algorithm (v1) and what changed

| # | Case | v1 measured result | v2 measured result | Fix |
|---|---|---|---|---|
| 1 | **Strong fan** (w=1.0 Sci-Fi, w=−0.8 Comedy), 12-title page | Sci-Fi avg rank **5.98/12**; hated Comedy **7.48**; non-matching 8.9-rated blockbuster **2.36** — popularity beat maxed-out taste | Sci-Fi **2.09**; Comedy **8.77**; blockbuster **4.71** | ✅ taste weight 0.55→0.62, quality rescaled `(r−4.5)/4.5`, noise 0.10→0.02 |
| 2 | **Multi-genre dilution**: acclaimed 3-genre Sci-Fi epic vs low-rated pure-Sci-Fi title, mild fan | epic rank **8.09**, pure title **2.14** — mean-across-genres + summed diversity penalty double-punished the best match | epic **0.00** (always first), pure **8.15** | ✅ peak-sensitive `tasteScore` (0.5·mean + 0.5·extreme), penalty normalized per genre |
| 3 | **Noise vs signal**: 1-of-3 genre hit (w=0.75) contributes 0.034 to score; old additive noise spanned 0.100 (**2.9× the signal**) | ordering corrupted every load | noise now 0.02 tie-break; serendipity moved to fixed wildcard slots (every 8th card) that can't be sorted away | ✅ |
| 4 | **Identical tastes blended**: `min+0.25·avg` amplified below the clip (0.6→0.75) | inflation | `merge(A,A)=A` exactly | ✅ interpolation `min+0.25·(avg−min)` |
| 5 | **Opposite tastes**: everything merged negative, deck falls back to quality | correct, kept | unchanged | — |
| 6 | **One-sided love**: A's w=0.75 → merged 0.094 (erased) | by design (consensus) but harsh | unchanged at rank layer; candidate FETCH still includes it via `topGenres(blend.taste)` in `buildQuery`, so it's down-ranked, not invisible | documented; P2: per-key "only-A-knows" passthrough at 0.5× |
| 7 | **Sparse×sparse blend**: two 6-swipe users merge to w≈0.06, `topGenres`=∅ → blend does nothing | cold-start hole | mitigated upstream: onboarding seeding (below) makes sparse vectors rarer; compat card says "still learning you two" instead of pretending | ✅ partial |
| 8 | **Cold start**: empty vector → ranking is quality+noise; nothing personalizes the first fetch | first session generic | ✅ onboarding genre picker seeds `likes[]` + w=0.45/n=3 per pick — `topGenres` biases the **first** query; measured: picked genres persisted before first swipe | ✅ |
| 9 | **Duplicate genre metadata** triple-counted the diversity penalty and buried the title (rank 12/13) | metadata-fragile | genres deduped in `tasteScore`/`rankDeck`/`tmdb.ts toTitle` | ✅ |
| 10 | **Undo corrupted the model**: genre `n` inflated on every undo (3→5 after like+undo); entity affinity never reversed at all (`App.tsx doUndo`) | permanent drift for heavy undo users | verified in-browser: like→undo restores the exact vector; `applySignal`/`applyEntities` take a `dn` param; re-rates no longer double-count samples | ✅ |
| 11 | **Entity affinity was learned but never ranked with** — `rankDeck` only read genres, so directors/studios/keywords influenced nothing but the Mirror display | half the engine decorative | ✅ `entityFit` term (0.14) for tagged cards **plus** exploration pages: on the default feed every 3rd append is a discover-pivot page seeded by a top learned entity (a "Denzel page", an "A24 page") | ✅ |

### Bias & quality assessment

- **Popularity bias**: was the dominant term (case 1); now a tie-break. TMDB
  `vote_count.gte` floors in the proxy (150 popular / 500 top) still keep the
  candidate pool mainstream — the "Hidden Gems" sort and exploration pages are
  the counterweights.
- **Filter bubble**: `withoutGenres` hard-excludes disliked genres from the
  *fetch*, which is aggressive (a −0.4 genre never appears again until decay
  lifts it). Wildcard slots restore in-page diversity but not fetch diversity.
  P2: swap hard `without` for soft down-rank above w=−0.6.
- **Quantity vs signal**: confidence shrinkage `n/(n+5)` + informed multipliers
  already reward deliberate actions over spam swiping. `n` never decays
  (weights do), which is acceptable but means confidence is immortal — P2.

### Performance & scalability

- Client scoring is O(page²) in the greedy loop with page ≈ 24 — microseconds;
  fine to hundreds. Nothing scans a DB; the model relocates to an edge function
  unchanged when accounts land (as `ROADMAP.md` planned).
- `deckCache` 5-min TTL + in-flight dedup dedups filter-flipping.
- Real risks are server-side: per-IP rate limit is **per-instance in-memory**
  (documented in ROADMAP; Postgres/Redis bucket when it matters) and
  `match_rooms` had **no TTL** — ✅ fixed with an opportunistic 24 h purge on
  room create.

---

## Phase 3 — The Mirror (the centerpiece)

**What Mirror is today:** a *portrait* — taste type line, People/Studios/Themes/
Genre rails with confidence bars, bedrock shelf, share image, taste code. The
*pairing* half of the vision ("pairs users by their movie matches") lives in the
Match modes launched from the Mirror's CTA. The audit treats them as one
feature, because that's how users experience it.

### What was weak, and what shipped

1. **The blend was a blind toggle.** Pasting a friend's code instantly re-ranked
   the deck with zero payoff — no number, no "why", no moment.
   ✅ Shipped `tasteCompat()` (`taste.ts`): confidence-weighted cosine over the
   genre union → **"You + Alex — 78% taste match · You both love Sci-Fi ·
   Thriller · You split on Romance — the blend keeps those out"** rendered as a
   reveal card (`MatchMode.tsx CompatCard`) before blending, and the live
   banner now reads "Blending with Alex · 78% match". Honest null state
   ("Still learning you two") below 3 overlapping genres — verified against
   identical (100), opposite (10), sparse (null) pairs.
2. **Taste codes were anonymous.** `Mirror.copyCode` sent no name, so the
   friend's banner said "a friend". ✅ The name entered in remote Match persists
   (`rex_name`) and rides the taste code.
3. **"It's a Match!" didn't say why.** ✅ The pop-up now shows the genres *both*
   players demonstrably lean into ("You both lean Sci-Fi · Thriller").
4. **A dead room was silent.** If the peer left or the row vanished, sync
   errors were swallowed and you swiped into the void. ✅ Poll now surfaces
   "Connection lost — … Your matches so far are below" and stops.
5. **Low-confidence gate** (below 12 swipes) was already good — kept.

### Still open (ranked, see blueprint)

- **P1 — Side-by-side compare view**: after blending, a "you two" screen —
  shared bedrock titles, each person's top rails, the overlap collage. The
  compat card is the moment; this is the destination.
- **P1 — Mirror long-press tune** (more/less/mute per chip) — the promised
  "you have a say" surface; the write path (`applyEntities`) already exists.
- **P2 — Shareable read-only Mirror link** (`#/mirror/:code`, reuses the backup
  code pattern) — turns the screenshot loop into a tap loop.
- **P2 — Match history**: matches are ephemeral; a "we matched on Dune (with
  Alex, last Tuesday)" shelf gives Mirror a social memory and re-engagement
  hook.
- **Edge cases**: re-matching the same person re-plays the same snapshot order
  (fine); blocking/reporting is N/A until accounts exist, but the free-text
  peer name should be length-capped server-side (it is: `cap(o.name, 24)`).

---

## Phase 4 — Missing features, ranked by impact on the core loop

1. **Feedback loop on outcomes** (not built): after a title sits on the
   watchlist or a match happens, ask *"did you watch it? any good?"* — one tap,
   feeds `starDelta` without the Watched detour. This is the only signal that
   measures whether REX's *picks* (not swipes) are good. Cheap: a nudge card
   reusing `RatingSheet`.
2. **Re-engagement hook** (not built): no notifications, no reason to return.
   Minimal PWA version: a "fresh matches for you" badge computed on open +
   optional Web Push later. Pairs with match history.
3. **Watch handoff** (half-built): provider chips link to a JustWatch *search*
   (`Detail.tsx watchUrl`) — the last mile of "pick → watch" leaks. TMDB detail
   responses carry JustWatch deep links; persist them on save.
4. **Accounts / sync** (not built, planned): backup codes work but are manual;
   taste + watchlist sync unlocks real cross-device and durable matches. The
   storage layer was explicitly structured for this.
5. **Library parity** (open in ROADMAP): Watchlist/Watched lack Discover's
   full filter surface.
6. **Search** (not built): `/search/multi` typeahead (titles + people +
   studios) — the pivot machinery already handles the result.
7. **Trust & data transparency**: a "what REX knows about me" view — the Mirror
   *is* this; add a "reset my taste" button (likes/dislikes reset exists;
   the learned vectors have no user-facing reset).

## Phase 5 — Defect list (all verified; ✅ = fixed in this branch)

| Sev | Defect | Repro | Fix |
|---|---|---|---|
| P0 | Undo inflated genre confidence and never reversed entity affinity | like → undo; inspect `rex_state_v2` (n went 3→5) | ✅ `dn` param through `applySignal`/`applyEntities`; verified in-browser |
| P0 | Taste barely influenced ranking (popularity + noise dominated) | harness cases 1–3 above | ✅ rankDeck v2 |
| P0 | TV rows ignored genre filters (name map mismatch) → unfiltered TV mixed into filtered decks | set genre=Sci-Fi with type=All against live proxy | ✅ TV alias map + skip-type guard (`functions/discover`) — **needs an edge-function deploy** |
| P1 | First save of a session un-undoable (done-nudge suppressed the undo pill; nudge outlives the 4.5 s undo window) | fresh session → swipe right once | ✅ undo pill stacks above the nudge |
| P1 | Remote room death was silent (sync errors swallowed) | join room, delete `rex_room_*` in another tab | ✅ lost-room banner + poll stop |
| P1 | `match_rooms` grew forever (no TTL) | create rooms; count rows | ✅ 24 h purge on create — needs deploy |
| P1 | `mergeTaste` amplified agreement below the clip (0.6→0.75) | unit case 4 | ✅ interpolation form |
| P2 | Duplicate genres multiplied learning deltas and diversity penalties | harness case 9 | ✅ dedup in 3 layers |
| P2 | Undo `aria-label` ("Undo like") contradicted visible text ("Undo save") | screen reader / locator | ✅ label matches text |
| P2 | Re-rating a title double-counted samples | rate 4★ then 5★ | ✅ `dn=0` on re-rate |
| P2 | `seen[]` grows unboundedly (years of swipes → localStorage bloat) | — | open; cap at ~5k with FIFO eviction |
| P2 | Rate limit is per-isolate in-memory (documented) | — | open (ROADMAP) |
| P2 | `decodeTaste` accepts arbitrarily large payloads | paste a 10 MB code | open; cap input length |

_Also stress-tested and **passing**: onboarding both steps, deck render, swipe
via keyboard, Mirror gate ↔ full portrait, invalid taste code error, compat
card (%, name, shared, friction), blend banner, named taste code round-trip —
13/13 in a scripted Chromium run against the production build._

## Phase 6 — Blueprint

**Shipped in this branch (P0s + highest-leverage P1s):** rankDeck v2 ·
undo-model integrity · cold-start onboarding picker · entity exploration pages
· `entityFit` ranking term · `mergeTaste` fix · `tasteCompat` + compat reveal
card · named taste codes · match-reason pop-up · lost-room handling · TV genre
filter fix · room TTL · genre dedup · undo/nudge stacking.
_Deploy note: `supabase functions deploy discover match` to pick up the two
server fixes._

**Next (P1, in order):**
1. Outcome feedback loop ("did you watch it?") — direct match-quality signal.
2. Blend compare view ("you two" screen) — completes the Mirror moment.
3. Mirror long-press tune — the "your say in the algorithm" promise.
4. Real watch deep links — closes the core loop's last mile.
5. Match history shelf — memory + re-engagement.

**Later (P2):** soft `without` (down-rank not exclude) · confidence decay ·
read-only Mirror link · `/search/multi` · accounts + sync + push · distributed
rate limiting · `seen[]` cap · taste-code input cap · endless remote-match
paging.
