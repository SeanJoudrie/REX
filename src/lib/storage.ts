import type { Title, WatchedItem } from '../types'

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
}

const EMPTY: Persisted = { watchlist: [], watched: [], seen: [] }

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

export type { Persisted }
