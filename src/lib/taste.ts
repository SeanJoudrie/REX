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
 *  TasteVec). billing decays cast weight down the credits order. */
export function applyEntities(aff: EntityAff, tags: Tag[] | undefined, base: number): EntityAff {
  if (!tags || !base) return aff
  const next: EntityAff = { ...aff }
  let castRank = 0
  for (const tag of tags) {
    if (tag.type === 'genre') continue
    const billing = tag.role === 'cast' ? Math.max(0.5, 1 - castRank++ * 0.15) : 1
    const k = entityKey(tag)
    const cur = next[k] ?? { w: 0, n: 0, type: tag.type, label: tag.name }
    next[k] = { w: clip(cur.w + base * typeMult(tag) * billing), n: cur.n + 1, type: tag.type, label: tag.name }
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

/** Blend two taste vectors for a "what do WE watch" deck. Consensus-weighted:
 *  mostly the min (rewards what BOTH like, punishes what either dislikes) with a
 *  little average so neither person is erased. */
export function mergeTaste(a: TasteVec, b: TasteVec): TasteVec {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: TasteVec = {}
  for (const k of keys) {
    const av = a[k]?.w ?? 0, bv = b[k]?.w ?? 0
    out[k] = { w: clip(Math.min(av, bv) + 0.25 * ((av + bv) / 2)), n: (a[k]?.n ?? 0) + (b[k]?.n ?? 0) }
  }
  return out
}

export function applySignal(vec: TasteVec, genres: string[], delta: number): TasteVec {
  if (!genres.length || !delta) return vec
  const next: TasteVec = { ...vec }
  for (const g of genres) {
    const cur = next[g] ?? { w: 0, n: 0 }
    next[g] = { w: clip(cur.w + delta), n: cur.n + 1 }
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

function tasteScore(t: Title, vec: TasteVec): number {
  if (!t.genres.length) return 0.5
  let sum = 0
  for (const g of t.genres) { const v = vec[g]; sum += v ? conf(v.n) * v.w : 0 }
  return (1 + sum / t.genres.length) / 2 // → 0..1
}

/** Order a candidate page by taste + quality + a little serendipity, with greedy
 *  genre diversity so the same genre isn't served back-to-back. */
export function rankDeck(titles: Title[], vec: TasteVec): Title[] {
  const base = new Map<Title, number>()
  for (const t of titles) {
    base.set(t, 0.55 * tasteScore(t, vec) + 0.35 * Math.min(1, (t.rating || 0) / 10) + 0.1 * Math.random())
  }
  const remaining = [...titles]
  const out: Title[] = []
  const served: Record<string, number> = {}
  while (remaining.length) {
    let bestI = 0, bestAdj = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const t = remaining[i]
      const penalty = 0.18 * t.genres.reduce((s, g) => s + (served[g] || 0), 0)
      const adj = (base.get(t) || 0) - penalty
      if (adj > bestAdj) { bestAdj = adj; bestI = i }
    }
    const [picked] = remaining.splice(bestI, 1)
    out.push(picked)
    for (const g of picked.genres) served[g] = (served[g] || 0) + 1
  }
  return out
}
