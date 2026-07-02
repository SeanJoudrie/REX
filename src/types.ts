export type MediaType = 'movie' | 'tv'

export type TagType = 'genre' | 'person' | 'company' | 'keyword'
/** A taste entity attached to a title (cast, director, studio, keyword, genre).
 *  Canonical identity is (type, tmdb id); name is a display label. */
export interface Tag {
  type: TagType
  id: number
  name: string
  role?: string // cast | director | creator | studio
}

export interface Title {
  /** TMDB id once wired; for sample data it's a stable local id. */
  id: number
  mediaType: MediaType
  title: string
  year: number
  genres: string[]
  overview: string
  /** Streaming services it's on (subscription / flatrate). */
  providers: string[]
  /** JustWatch page for THIS title (from TMDB watch/providers) — the one-tap
   *  watch handoff. Falls back to a title search when absent. */
  watchLink?: string
  rating: number // 0–10, TMDB vote_average style
  /** Real poster URL when available; undefined → render a gradient. */
  poster?: string
  /** Two-stop gradient used as the placeholder poster. */
  gradient: [string, string]
  /** Currently in cinemas (not streaming yet). */
  inTheaters?: boolean
  /** Enriched taste entities (populated on the detail hydrate). */
  tags?: Tag[]
  /** When the user saved it to the watchlist (drives the outcome nudge). */
  addedAt?: number
}

/** A title the user has marked watched, with their private 1–5 star rating
 *  (0 = watched but not yet rated). Stars are a recommendation signal, not a
 *  public review: ★5 = "more like this", ★1 = "less like this". */
export interface WatchedItem extends Title {
  stars: number
}
