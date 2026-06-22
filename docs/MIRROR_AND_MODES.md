# REX — Mirror & Match Modes (design sketch)

Two bets that turn REX from "another catalog browser" into something people
*share*: the **Mirror** (a portrait of your taste) and **Match modes** (decide
together). Both are designed to ride the existing engine — `lib/taste.ts`
(`TasteVec`, `EntityAff`, `topEntities`, `topGenres`), `lib/storage.ts`
(`exportRaw`/`importRaw`), and the Supabase `discover`/`backup` functions — so
the MVP of each ships with **no new infrastructure**.

---

## 1. The Mirror — "your taste, as a portrait"

### Why
A feed is invisible; a *mirror* is shareable. Showing someone a striking
summary of their own taste (top actors, vibes, studios, a one-line "taste type")
is the viral loop a discovery app normally lacks. It also gives the learning
engine a payoff screen — you *see* it working, which builds trust in the recs.

### Where it lives
A 4th bottom-nav tab (`Mirror`, icon `sparkle`/`user`). Nav grid goes
3 → 4 columns.

### Data — already on device, no fetch needed
- `topGenres(taste)` → top vibes.
- `topEntities(affinity)` filtered by `type`:
  - `type:'person'` → **Top People** (cast + directors; directors get the badge).
  - `type:'company'` → **Top Studios**.
  - `type:'keyword'` → **Top Themes** (e.g. "neo-noir", "time loop").
- `watched` + stars → **bedrock** (★4–5) vs **tried** lists.
- Counts (`seen.length`, `watchlist.length`) → confidence / progress.

### Screens (top → bottom)
1. **Fingerprint header** — big, screenshot-bait.
   - A generated **"Taste Type"** line: a templated phrase from the top signals,
     e.g. *"Auteur-driven thrillers with a soft spot for A24."* (Pure
     client string-template over top genre × top studio × top keyword — no LLM.)
   - 3 hero chips: Top Person · Top Vibe · Top Studio, each over a poster
     collage (posters of titles that carry that tag, pulled from
     watchlist/watched first, else a cheap `discover` pivot).
2. **Dimension rails** — horizontal scroller per namespace (People / Studios /
   Themes / Genres). Each chip shows label + a confidence bar (`w` scaled).
   - **Tap** a chip → pivots the deck (reuses `deckFromTag`).
   - **Long-press** a chip → tune sheet: *More like this / Less / Mute* →
     writes the affinity directly (`applyEntities`-style nudge, or a hard
     mute set). This is the "you have a say in the algorithm" promise, surfaced.
3. **Bedrock shelf** — your ★4–5, "the films that define you."
4. **Low-confidence state** — if `seen.length < ~15`: a calm
   *"Swipe ~N more to develop your Mirror"* instead of a thin/embarrassing chart.

### Shareability (the actual growth mechanic)
- **Share my Mirror** button → renders the fingerprint header to an image
  (`<canvas>`, no deps) → `navigator.share` / download.
- Optional deep link `#/mirror/:code` that cold-loads a read-only Mirror from a
  backup-style snapshot (reuses the `backup` function's code pattern). Phase 2.

### Build tiers
- **v1 (zero infra):** tab + header + rails + tap-to-pivot, all from on-device
  state. Taste-type templating. ~1 focused PR.
- **v2:** long-press tune (writes affinities) + poster collages.
- **v3:** canvas share image + shareable read-only Mirror link.

---

## 2. Match Modes — "what do WE watch tonight"

The highest-value unsolved version of the problem. Three escalating tiers; ship
the first with **zero backend.**

### Mode A — Pass-the-phone (MVP, no infra) ✅ start here
Two people, one device, one couch.
- Entry: Mirror/Discover → **"Match"** → pick **2–4 players**, choose a deck
  (current filters, or a blended deck — see blending below).
- Each player swipes the **same fixed deck** (the deck is snapshotted up front so
  everyone sees identical cards in the same order). Hand the phone over between
  players, or "Player 1 does N, then Player 2."
- A title is a **match** if every player swiped right. Surface matches live
  ("🎉 You both want **Dune**") and in a final **Match results** sheet ranked by
  how fast/strongly everyone agreed.
- State is ephemeral (in-memory for the session) — nothing persisted, nothing
  shipped to a server. **This is the cheapest possible test of "do people care."**

### Mode B — Blended deck from two tastes (no infra, async)
Don't even need to swipe together — just merge taste.
- Person B exports their taste (existing `exportRaw` → code/file), Person A
  imports it (`importRaw`) into a transient "guest taste."
- Build a **blended `TasteVec`/`EntityAff`**: per-tag `min(A,B)` (consensus —
  rewards what *both* like, punishes what *either* hates) with a small `avg`
  blend so neither person is erased. `without`/muted from *either* side is a hard
  filter.
- Generate a deck via `discover` from the blended `with_genres` / pivots, ranked
  by the blended vector. Now even solo browsing is "for us."

### Mode C — Remote realtime match (lean infra) — Phase 2
Two phones, two locations.
- New Supabase table `match_sessions` (reuse the `backup` function's
  service-role + code pattern): `code`, `deck_snapshot jsonb`, `swipes jsonb`
  (`{playerId: {titleKey: dir}}`), `created_at`, short TTL.
- Host creates a session → 6-char code (same UX as cloud backup). Guest joins by
  code. Both pull the **same `deck_snapshot`** (host's blended deck) so cards
  line up.
- Swipes POST to the row; lightweight **poll every ~2s** (no websockets needed
  at this scale) to compute the live intersection. Matches pop on both phones.
- Still no accounts — a code is the whole session, like the backup feature.

### Deck blending math (shared by B & C)
```
score(title) = rankDeck base
             + Σ_tag γ_type · consensus(A_w, B_w)        // both-like bonus
consensus(a,b) = min(a,b) + 0.25·(a+b)/2                  // mostly AND, a little OR
hard-exclude if title carries any tag muted/without by EITHER player
```
Keeps the "agree" bias without serving bland middle-of-the-road picks.

### Build tiers
- **MVP:** Mode A pass-the-phone, ephemeral, zero infra. 1 PR.
- **+ Mode B:** taste import + blended deck. Reuses backup export/import.
- **Phase 2:** Mode C remote sessions (`match_sessions` table + poll).

---

## Suggested order
1. **Mirror v1** — payoff screen, shareable, all on-device. Lowest risk, highest
   "wow," makes the engine legible.
2. **Match Mode A** — pass-the-phone. Cheapest real signal on the social bet.
3. Then layer: Mirror tune/share → Mode B blend → Mode C remote.

Everything above is additive and respects the constraints: deps stay
react/react-dom, animation/3D via vanilla CSS, secrets stay in Supabase.
