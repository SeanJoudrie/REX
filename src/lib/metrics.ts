// Local-first, privacy-respecting usage metrics. Nothing leaves the device —
// this exists so the user (and we) can SEE whether the engine is working: the
// deck → open → save → watched funnel and how often a pick is accepted.

const KEY = 'rex_metrics_v1'

export type Event =
  | 'like' | 'pass' | 'watched' | 'open' | 'save' | 'rate' | 'pivot'
  | 'match_round' | 'match_match'

export interface Metrics {
  counts: Record<Event, number>
  firstUse: number
  lastUse: number
}

const ZERO: Record<Event, number> = {
  like: 0, pass: 0, watched: 0, open: 0, save: 0, rate: 0, pivot: 0, match_round: 0, match_match: 0,
}

export function getMetrics(): Metrics {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { counts: { ...ZERO }, firstUse: 0, lastUse: 0 }
    const p = JSON.parse(raw)
    return { counts: { ...ZERO, ...(p.counts ?? {}) }, firstUse: p.firstUse ?? 0, lastUse: p.lastUse ?? 0 }
  } catch {
    return { counts: { ...ZERO }, firstUse: 0, lastUse: 0 }
  }
}

export function track(event: Event, n = 1): void {
  try {
    const m = getMetrics()
    m.counts[event] = (m.counts[event] ?? 0) + n
    const now = Date.now()
    if (!m.firstUse) m.firstUse = now
    m.lastUse = now
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch { /* quota / private mode — metrics are best-effort */ }
}

export function resetMetrics(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export interface Insights {
  swipes: number
  saveRate: number   // saves / swipes
  watchRate: number  // watched / swipes
  openRate: number   // opens / swipes
  saves: number
  watched: number
  opens: number
  rates: number
  matches: number
  days: number
}

export function insights(m = getMetrics()): Insights {
  const c = m.counts
  const swipes = c.like + c.pass + c.watched
  const pct = (a: number) => (swipes ? a / swipes : 0)
  const days = m.firstUse ? Math.max(1, Math.round((m.lastUse - m.firstUse) / 86_400_000) + 1) : 0
  return {
    swipes,
    saveRate: pct(c.save || c.like),
    watchRate: pct(c.watched),
    openRate: pct(c.open),
    saves: c.save || c.like,
    watched: c.watched,
    opens: c.open,
    rates: c.rate,
    matches: c.match_match,
    days,
  }
}
