import type { Title } from '../types'

// Lightweight on-device taste model: a weight per genre, nudged by every signal.
// Right swipe amplifies, left swipe suppresses (gently), stars push hardest.
export type TasteVec = Record<string, { w: number; n: number }>

export const LIKE_DELTA = 0.15
export const PASS_DELTA = -0.08
/** 5★ → +0.30, 4★ → +0.15, 3★ → 0, 2★ → −0.15, 1★ → −0.30. */
export const starDelta = (stars: number) => ((stars - 3) / 2) * 0.3

const clip = (x: number) => Math.max(-1, Math.min(1, x))
const conf = (n: number) => n / (n + 5) // confidence: a genre needs repeats to swing

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
