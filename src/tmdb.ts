import type { Title } from './types'
import { SAMPLE_TITLES } from './data/titles'

// ── TMDB deck source ─────────────────────────────────────────────────────────
// Per the build spec, TMDB calls MUST go through a server-side proxy (a Supabase
// Edge Function) that holds the API key — never ship the key in the client.
//
// Until that proxy + key exist, fetchDeck() returns the local sample deck so the
// swipe loop is fully playable. Point VITE_TMDB_PROXY at the deployed proxy and
// this transparently switches to live /discover results.

const PROXY = import.meta.env.VITE_TMDB_PROXY as string | undefined

export interface DeckQuery {
  mediaTypes: ('movie' | 'tv')[]
  genres?: string[]
  providers?: string[]
  region?: string
  page?: number
}

export async function fetchDeck(_query: DeckQuery): Promise<Title[]> {
  if (!PROXY) {
    // No proxy configured yet — play with the sample deck.
    return SAMPLE_TITLES
  }
  // Live path (once the proxy is deployed). The proxy is responsible for the
  // TMDB key, caching, normalizing provider data, and shaping the Title objects.
  const res = await fetch(`${PROXY}/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(_query),
  })
  if (!res.ok) throw new Error(`deck fetch failed: ${res.status}`)
  return (await res.json()) as Title[]
}

export const USING_SAMPLE = !PROXY
