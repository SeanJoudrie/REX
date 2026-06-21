import type { MediaType, Title } from './types'
import { SAMPLE_TITLES } from './data/titles'

// ── TMDB deck source ─────────────────────────────────────────────────────────
// Per the build spec, TMDB calls MUST go through a server-side proxy (a Supabase
// Edge Function) that holds the API key — never ship the key in the client.
//
// Until that proxy + key exist, fetchDeck() returns the local sample deck so the
// swipe loop is fully playable. Point VITE_TMDB_PROXY at the deployed proxy and
// this transparently switches to live /discover results.

const PROXY = import.meta.env.VITE_TMDB_PROXY as string | undefined

const TIMEOUT_MS = 12000
const FALLBACK_GRADIENT: [string, string] = ['#3b3b52', '#15151f']

export interface DeckQuery {
  mediaTypes: MediaType[]
  /** Single genre name to filter/recommend by (proxy maps it to a TMDB id). */
  genre?: string
  /** Release / first-air year. */
  year?: number
  region?: string
  page?: number
}

const stringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/** Normalize one item from the (untrusted) proxy payload into a renderable
 *  Title. Returns null for items missing a usable identity — those are dropped
 *  rather than crashing a card. Every other field is coerced/backfilled so the
 *  UI can never hit an undefined gradient/provider/rating. */
function toTitle(raw: unknown): Title | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const mediaType: MediaType | null = r.mediaType === 'tv' ? 'tv' : r.mediaType === 'movie' ? 'movie' : null
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!Number.isFinite(id) || !mediaType || !title) return null

  const gradient: [string, string] =
    Array.isArray(r.gradient) && r.gradient.length === 2 && r.gradient.every(x => typeof x === 'string')
      ? [r.gradient[0] as string, r.gradient[1] as string]
      : FALLBACK_GRADIENT

  return {
    id,
    mediaType,
    title,
    year: Number.isFinite(Number(r.year)) ? Number(r.year) : 0,
    genres: stringArray(r.genres),
    overview: typeof r.overview === 'string' ? r.overview : '',
    providers: stringArray(r.providers),
    rating: Number.isFinite(Number(r.rating)) ? Number(r.rating) : 0,
    poster: typeof r.poster === 'string' ? r.poster : undefined,
    gradient,
  }
}

export async function fetchDeck(query: DeckQuery, signal?: AbortSignal): Promise<Title[]> {
  if (!PROXY) {
    // No proxy configured yet — play with the sample deck, honoring the filters.
    const types = new Set(query.mediaTypes)
    const g = query.genre?.toLowerCase()
    return SAMPLE_TITLES.filter(t =>
      types.has(t.mediaType) &&
      (!g || t.genres.some(x => x.toLowerCase() === g)) &&
      (!query.year || t.year === query.year),
    )
  }

  // Live path. Bound the request with a timeout and honor a caller abort
  // (e.g. unmount / retry) so a hung proxy can't pin the deck on "loading".
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; ctrl.abort() }, TIMEOUT_MS)

  try {
    const res = await fetch(`${PROXY}/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`deck fetch failed: ${res.status}`)
    const data: unknown = await res.json()
    if (!Array.isArray(data)) throw new Error('deck response was not an array')
    return data.map(toTitle).filter((t): t is Title => t !== null)
  } catch (err) {
    if (timedOut) throw new Error('deck fetch timed out')
    throw err
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

export const USING_SAMPLE = !PROXY
