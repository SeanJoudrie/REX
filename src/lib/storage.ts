import type { Title, WatchedItem } from '../types'
import type { TasteVec, EntityAff } from './taste'

// Guest-mode persistence: everything lives on-device in localStorage so users
// can swipe and build a watchlist with no account (per the UX spec). When
// Supabase auth lands, this becomes the offline write-queue mirror.

const KEY = 'rex_state_v2'

interface Persisted {
  /** Full title objects for right-swipes, denormalized so the watchlist renders
   *  with zero API calls. */
  watchlist: Title[]
  /** Titles the user marked watched (swipe up), with a 1–5 star rating. */
  watched: WatchedItem[]
  /** Composite "mediaType-id" keys of every title already swiped or saved, to
   *  skip in the deck. Keyed by (mediaType, id) because TMDB reuses numeric ids
   *  across movies and TV. */
  seen: string[]
  /** Taste prefs that bias the deck: tags the user wants more / less of. */
  likes: string[]
  dislikes: string[]
  /** Learned per-genre weights, updated by every swipe/rating. */
  taste: TasteVec
  /** Learned per-entity weights (cast/director/studio/keyword), keyed type:id.
   *  Fed by informed actions (opened/watched), surfaced in "why this" + tuning. */
  affinity: EntityAff
  /** Timestamp of the last EWMA decay pass (so taste drifts over time). */
  tasteDecayedAt: number
  /** First-run tutorial shown? */
  onboarded: boolean
}

const EMPTY: Persisted = { watchlist: [], watched: [], seen: [], likes: [], dislikes: [], taste: {}, affinity: {}, tasteDecayedAt: 0, onboarded: false }

export function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY, ...JSON.parse(raw) }
    // One-time migration from v1 (seen was number[] keyed by id alone, which is
    // ambiguous once TMDB lands). Preserve the watchlist and rebuild seen from
    // it; the old numeric passes are unrecoverable without mediaType, so drop.
    const v1raw = localStorage.getItem('rex_state_v1')
    if (v1raw) {
      const v1 = JSON.parse(v1raw) as { watchlist?: Title[] }
      const watchlist = v1.watchlist ?? []
      return { ...EMPTY, watchlist, seen: watchlist.map(t => `${t.mediaType}-${t.id}`) }
    }
    return { ...EMPTY }
  } catch {
    return { ...EMPTY }
  }
}

export function saveState(state: Persisted): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota / private mode */ }
}

/** Raw persisted JSON (for backup/export). */
export function exportRaw(): string {
  return localStorage.getItem(KEY) ?? JSON.stringify(EMPTY)
}
/** Replace persisted state from a backup. Throws if the JSON is invalid. */
export function importRaw(json: string): void {
  const parsed = JSON.parse(json) // validate
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid backup')
  localStorage.setItem(KEY, JSON.stringify({ ...EMPTY, ...parsed }))
}

export type { Persisted }
