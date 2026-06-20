import type { Title } from '../types'

// Guest-mode persistence: everything lives on-device in localStorage so users
// can swipe and build a watchlist with no account (per the UX spec). When
// Supabase auth lands, this becomes the offline write-queue mirror.

const KEY = 'rex_state_v1'

interface Persisted {
  /** Full title objects for right-swipes, denormalized so the watchlist renders
   *  with zero API calls (per the architecture teardown §2.4). */
  watchlist: Title[]
  /** Ids of every title already swiped (like or pass), to skip in the deck. */
  seen: number[]
}

const EMPTY: Persisted = { watchlist: [], seen: [] }

export function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }
  } catch {
    return { ...EMPTY }
  }
}

export function saveState(state: Persisted): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota / private mode */ }
}

export type { Persisted }
