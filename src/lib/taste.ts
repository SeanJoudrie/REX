import type { Tag, Title } from '../types'

// Lightweight on-device taste model: a weight per genre, nudged by every signal.
// Right swipe amplifies, left swipe suppresses (gently), stars push hardest.
export type TasteVec = Record<string, { w: number; n: number }>

// Entity affinity (cast/director/studio/keyword), keyed "type:id". Fed by
// informed actions (opened/watched) where the full tag set is known.
export type EntityAff = Record<string, { w: number; n: number; type: string; label: string }>

export const LIKE_DELTA = 0.15
export const PASS_DELTA = -0.08
/** 5★ → +0.30, 4★ → +0.15, 3★ → 0, 2★ → −0.15, 1★ → −0.30. */
export const starDelta = (stars: number) => ((stars - 3) / 2) * 0.3

const clip = (x: number) => Math.max(-1, Math.min(1, x))
const conf = (n: number) => n / (n + 5) // confidence: a genre needs repeats to swing

// Value-matrix weights (base unit = a right swipe). Genres use TasteVec deltas
// above; these scale the entity affinity channel.
const ENTITY_BASE = { likeInformed: 0.18, like: 0.14, passInformed: -0.11, pass: -0.05 }
export const entityStarDelta = (stars: number) => [0, -0.36, -0.14, 0, 0.22, 0.42][stars] ?? 0
// Type salience: directors/keywords are the strongest fingerprint.
const typeMult = (tag: Tag) =>
  tag.role === 'director' || tag.role === 'creator' ? 1.4
    : tag.type === 'keyword' ? 1.3
      : tag.type === 'person' ? 1.2
        : tag.type === 'company' ? 1.1
          : 1.0

export const entityKey = (tag: Tag) => (tag.type === 'genre' ? `genre:${tag.name.toLowerCase()}` : `${tag.type}:${tag.id}`)

/** Apply a signal across a title's entity tags (skips genres — those go to
 *  TasteVec). billing decays cast weight down the credits order. dn = -1
 *  reverses a previous application (undo), decrementing the sample count. */
export function applyEntities(aff: EntityAff, tags: Tag[] | undefined, base: number, dn = 1): EntityAff {
  if (!tags || !base) return aff
  const next: EntityAff = { ...aff }
  let castRank = 0
  for (const tag of tags) {
    if (tag.type === 'genre') continue
    const billing = tag.role === 'cast' ? Math.max(0.5, 1 - castRank++ * 0.15) : 1
    const k = entityKey(tag)
    const cur = next[k] ?? { w: 0, n: 0, type: tag.type, label: tag.name }
    next[k] = { w: clip(cur.w + base * typeMult(tag) * billing), n: Math.max(0, cur.n + dn), type: tag.type, label: tag.name }
  }
  return next
}

export const ENTITY_DELTAS = ENTITY_BASE

/** Lazy EWMA decay so taste drifts and the echo chamber can't calcify. */
export function decayTaste(vec: TasteVec, days: number): TasteVec {
  if (days <= 0) return vec
  const f = Math.pow(0.98, days)
  const out: TasteVec = {}
  for (const [k, v] of Object.entries(vec)) out[k] = { w: v.w * f, n: v.n }
  return out
}
export function decayAff(aff: EntityAff, days: number): EntityAff {
  if (days <= 0) return aff
  const f = Math.pow(0.98, days)
  const out: EntityAff = {}
  for (const [k, v] of Object.entries(aff)) out[k] = { ...v, w: v.w * f }
  return out
}

/** Top learned entities for "why this" / future Mirror. */
export function topEntities(aff: EntityAff, minW = 0.18, minN = 2, limit = 12) {
  return Object.values(aff).filter(v => v.w >= minW && v.n >= minN).sort((a, b) => b.w - a.w).slice(0, limit)
}

/** Top learned entities WITH their tmdb identity (parsed back out of the key),
 *  usable as discover pivots — feeds the deck's exploration pages. */
export function topEntityTags(aff: EntityAff, minW = 0.25, minN = 2, limit = 8): { type: string; id: number; name: string; w: number }[] {
  return Object.entries(aff)
    .filter(([k, v]) => !k.startsWith('genre:') && v.w >= minW && v.n >= minN)
    .map(([k, v]) => ({ type: v.type, id: Number(k.split(':')[1]), name: v.label, w: v.w }))
    .filter(e => Number.isFinite(e.id))
    .sort((a, b) => b.w - a.w)
    .slice(0, limit)
}

/** Blend two taste vectors for a "what do WE watch" deck. Consensus-weighted:
 *  interpolate from the min (rewards what BOTH like, punishes what either
 *  dislikes) a quarter of the way toward the average so neither person is
 *  erased. Interpolation (not min + avg-bonus) keeps identical tastes fixed:
 *  merge(A, A) = A. */
export function mergeTaste(a: TasteVec, b: TasteVec): TasteVec {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: TasteVec = {}
  for (const k of keys) {
    const av = a[k]?.w ?? 0, bv = b[k]?.w ?? 0
    const mn = Math.min(av, bv), avg = (av + bv) / 2
    out[k] = { w: clip(mn + 0.25 * (avg - mn)), n: (a[k]?.n ?? 0) + (b[k]?.n ?? 0) }
  }
  return out
}

/** How compatible are two tastes? Confidence-weighted cosine over the union of
 *  genres, mapped to 0–100, plus the shared loves and the friction points that
 *  explain the number. Returns score:null when there's not enough overlapping
 *  signal to be honest about it. */
export function tasteCompat(a: TasteVec, b: TasteVec): { score: number | null; shared: string[]; friction: string[] } {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  const av = (v?: { w: number; n: number }) => (v ? conf(v.n) * v.w : 0)
  let dot = 0, na = 0, nb = 0, overlap = 0
  const shared: [string, number][] = []
  const friction: [string, number][] = []
  for (const k of keys) {
    const x = av(a[k]), y = av(b[k])
    dot += x * y; na += x * x; nb += y * y
    if (x !== 0 && y !== 0) overlap++
    if (x > 0.08 && y > 0.08) shared.push([k, Math.min(x, y)])
    if ((x > 0.15 && y < -0.15) || (x < -0.15 && y > 0.15)) friction.push([k, Math.abs(x - y)])
  }
  const score = overlap >= 3 && na > 0 && nb > 0
    ? Math.round(((dot / Math.sqrt(na * nb) + 1) / 2) * 100)
    : null
  return {
    score,
    shared: shared.sort((p, q) => q[1] - p[1]).slice(0, 4).map(([k]) => k),
    friction: friction.sort((p, q) => q[1] - p[1]).slice(0, 2).map(([k]) => k),
  }
}

/** dn is the sample-count change: +1 for a fresh signal, 0 for an adjustment
 *  to an existing one (re-rating), -1 to reverse a signal entirely (undo) —
 *  otherwise undo would restore the weight but inflate the confidence. */
export function applySignal(vec: TasteVec, genres: string[], delta: number, dn = 1): TasteVec {
  if (!genres.length || !delta) return vec
  const next: TasteVec = { ...vec }
  for (const g of genres) {
    const cur = next[g] ?? { w: 0, n: 0 }
    const w = clip(cur.w + delta), n = Math.max(0, cur.n + dn)
    if (dn < 0 && n === 0 && Math.abs(w) < 1e-9) delete next[g] // fully reversed → no husk entry
    else next[g] = { w, n }
  }
  return next
}

export function topGenres(vec: TasteVec, minW = 0.2, minN = 3, limit = 5): string[] {
  return Object.entries(vec).filter(([, v]) => v.w >= minW && v.n >= minN)
    .sort((a, b) => b[1].w - a[1].w).slice(0, limit).map(([g]) => g)
}
export function bottomGenres(vec: TasteVec, maxW = -0.4, minN = 3, limit = 5): string[] {
  return Object.entries(vec).filter(([, v]) => v.w <= maxW && v.n >= minN)
    .sort((a, b) => a[1].w - b[1].w).slice(0, limit).map(([g]) => g)
}

/** Peak-sensitive genre fit in 0..1. The mean alone dilutes a strong hit across
 *  neutral co-genres (a Sci-Fi fan's 3-genre sci-fi epic scored barely above
 *  noise), so blend the mean with the most extreme single-genre signal: one
 *  loved genre lifts a title, one hated genre sinks it. Genres are deduped so
 *  bad metadata can't multiply the signal. */
function tasteScore(t: Title, vec: TasteVec): number {
  const gs = [...new Set(t.genres)]
  if (!gs.length) return 0.5
  let sum = 0, peak = 0
  for (const g of gs) {
    const v = vec[g]
    const c = v ? conf(v.n) * v.w : 0
    sum += c
    if (Math.abs(c) > Math.abs(peak)) peak = c
  }
  const s = 0.5 * (sum / gs.length) + 0.5 * peak
  return (1 + Math.max(-1, Math.min(1, s))) / 2 // → 0..1
}

/** Entity fit in -1..1 from learned affinity (cast/director/studio/keyword),
 *  for the cards that carry tags (detail-hydrated, pivot-seeded, deep-linked). */
function entityFit(t: Title, aff?: EntityAff): number {
  if (!aff || !t.tags?.length) return 0
  let s = 0
  for (const tag of t.tags) {
    if (tag.type === 'genre') continue
    const a = aff[entityKey(tag)]
    if (a) s += conf(a.n) * a.w
  }
  return clip(s)
}

/** Rating stretched over the range TMDB actually serves (~4.5–9) so the
 *  quality term separates good from great instead of compressing into 0.65–0.85. */
const quality = (t: Title) => Math.max(0, Math.min(1, ((t.rating || 0) - 4.5) / 4.5))

/** Order a candidate page: taste-led score + quality tie-break + entity
 *  affinity when tags exist, greedy genre diversity (normalized per genre so
 *  multi-genre titles aren't triple-penalized), and fixed serendipity slots —
 *  every 8th card is the best-quality remaining title regardless of taste, so
 *  exploration can't be sorted away and noise never corrupts the ordering. */
export function rankDeck(titles: Title[], vec: TasteVec, aff?: EntityAff): Title[] {
  const base = new Map<Title, number>()
  for (const t of titles) {
    base.set(t, 0.62 * tasteScore(t, vec) + 0.24 * quality(t) + 0.14 * entityFit(t, aff) + 0.02 * Math.random())
  }
  const remaining = [...titles]
  const out: Title[] = []
  const served: Record<string, number> = {}
  while (remaining.length) {
    const wildcard = out.length % 8 === 7 // serendipity slot
    let bestI = 0, bestAdj = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const t = remaining[i]
      const gs = [...new Set(t.genres)]
      const penalty = gs.length ? (0.16 * gs.reduce((s, g) => s + (served[g] || 0), 0)) / gs.length : 0
      const adj = (wildcard ? quality(t) : base.get(t) || 0) - penalty
      if (adj > bestAdj) { bestAdj = adj; bestI = i }
    }
    const [picked] = remaining.splice(bestI, 1)
    out.push(picked)
    for (const g of new Set(picked.genres)) served[g] = (served[g] || 0) + 1
  }
  return out
}
