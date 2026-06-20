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
  /** Real poster URL when available (TMDB); undefined → render a gradient. */
  poster?: string
  /** Two-stop gradient used as the placeholder poster. */
  gradient: [string, string]
}
