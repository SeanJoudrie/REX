import type { Title } from '../types'
import { SAMPLE_TITLES } from '../data/titles'

// A deterministic deck both partners share: same code → same titles in the same
// order, computed independently on each client with no server round-trip. (When
// wired to live TMDB, pass this seed to the proxy so both get the same page.)

function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sharedDeck(code: string): Title[] {
  const rng = mulberry32(hashStr(`rex-${code}`))
  const a = [...SAMPLE_TITLES]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
