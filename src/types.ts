export type MediaType = 'movie' | 'tv'

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
  rating: number // 0–10, TMDB vote_average style
  /** Real poster URL when available; undefined → render a gradient. */
  poster?: string
  /** Two-stop gradient used as the placeholder poster. */
  gradient: [string, string]
  /** Currently in cinemas (not streaming yet). */
  inTheaters?: boolean
}

/** A title the user has marked watched, with their private 1–5 star rating
 *  (0 = watched but not yet rated). Stars are a recommendation signal, not a
 *  public review: ★5 = "more like this", ★1 = "less like this". */
export interface WatchedItem extends Title {
  stars: number
}
