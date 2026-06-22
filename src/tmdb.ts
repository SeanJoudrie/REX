import type { MediaType, Tag, TagType, Title } from './types'
import { SAMPLE_TITLES } from './data/titles'

const TAG_TYPES = new Set<TagType>(['genre', 'person', 'company', 'keyword'])
const toTags = (v: unknown): Tag[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const tags = v.filter((x): x is Tag =>
    !!x && TAG_TYPES.has((x as Tag).type) && typeof (x as Tag).id === 'number' && typeof (x as Tag).name === 'string')
  return tags.length ? tags.map(t => ({ type: t.type, id: t.id, name: t.name, role: t.role })) : undefined
}

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
  /** Sort/discovery mode: popular | top | box_office | new | hidden | streaming_new. */
  sort?: string
  /** Actor name — proxy resolves it to a person and filters by cast. */
  actor?: string
  /** Streaming service name to filter by (e.g. "Netflix"). */
  service?: string
  /** Taste bias: genres to lean into / avoid. */
  withGenres?: string[]
  withoutGenres?: string[]
  /** Entity pivot — a single tag deck (Denzel deck, A24 deck, …). */
  pivot?: { type: string; id?: number; name?: string }
  region?: string
  page?: number
}

// Local sort for the sample deck (no revenue/cast data, so box_office≈rating).
function sortSample(list: Title[], sort?: string): Title[] {
  switch (sort) {
    case 'top':
    case 'hidden':
    case 'box_office': return [...list].sort((a, b) => b.rating - a.rating)
    case 'new': return [...list].sort((a, b) => b.year - a.year)
    default: return list
  }
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
    inTheaters: r.inTheaters === true || undefined,
    tags: toTags(r.tags),
  }
}

export async function fetchDeck(query: DeckQuery, signal?: AbortSignal): Promise<Title[]> {
  if (!PROXY) {
    // No proxy configured yet — play with the sample deck, honoring the filters.
    // Actor search needs cast data the sample doesn't have, so it's a no-op here.
    const types = new Set(query.mediaTypes)
    // Pivot decks: the sample set only has genre data, so genre pivots filter
    // locally and other entity pivots return empty (live data has them).
    if (query.pivot) {
      if (query.pivot.type === 'genre') {
        const pg = (query.pivot.name ?? '').toLowerCase()
        return SAMPLE_TITLES.filter(t => types.has(t.mediaType) && t.genres.some(x => x.toLowerCase() === pg))
      }
      return []
    }
    const g = query.genre?.toLowerCase()
    const svc = query.service?.toLowerCase()
    const likes = (query.withGenres ?? []).map(x => x.toLowerCase())
    const dislikes = (query.withoutGenres ?? []).map(x => x.toLowerCase())
    const filtered = SAMPLE_TITLES.filter(t => {
      const genresLc = t.genres.map(x => x.toLowerCase())
      return types.has(t.mediaType) &&
        (!g || genresLc.includes(g)) &&
        (!query.year || t.year === query.year) &&
        (!svc || t.providers.some(p => p.toLowerCase() === svc)) &&
        (!likes.length || genresLc.some(x => likes.includes(x))) &&
        !genresLc.some(x => dislikes.includes(x))
    })
    return sortSample(filtered, query.sort)
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

/** Fetch a single title by id — used to cold-open a shared deep link. */
export async function fetchTitleById(mediaType: MediaType, id: number, signal?: AbortSignal): Promise<Title | null> {
  if (!PROXY) return SAMPLE_TITLES.find(t => t.mediaType === mediaType && t.id === id) ?? null
  try {
    const res = await fetch(`${PROXY}/discover`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleId: id, mediaType }), signal,
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return null
    return data.map(toTitle).find((t): t is Title => t !== null) ?? null
  } catch {
    return null
  }
}

export const USING_SAMPLE = !PROXY
