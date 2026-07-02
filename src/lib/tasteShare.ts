import type { TasteVec } from './taste'

// A shareable "taste code" — enough of someone's taste to blend a deck with a
// friend, encoded as base64 so it copy/pastes cleanly. No network, no account.
export interface TastePayload {
  v: 1
  name?: string
  taste: TasteVec
  likes: string[]
  dislikes: string[]
}

// base64 that survives UTF-8 (genre names are ASCII today, but be safe).
const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const fromB64 = (s: string) => decodeURIComponent(escape(atob(s)))

const PREFIX = 'REX1:'

export function encodeTaste(p: TastePayload): string {
  return PREFIX + toB64(JSON.stringify(p))
}

// The payload is untrusted paste input: cap the blob, the key count, and every
// value so a hostile code can't bloat state or skew the blend beyond ±1.
const MAX_CODE_LEN = 16_384
const MAX_KEYS = 64
const cleanVec = (v: unknown): TasteVec => {
  const out: TasteVec = {}
  if (!v || typeof v !== 'object') return out
  for (const [k, raw] of Object.entries(v as Record<string, unknown>).slice(0, MAX_KEYS)) {
    const e = raw as { w?: unknown; n?: unknown }
    if (!e || typeof e.w !== 'number' || !Number.isFinite(e.w)) continue
    const n = typeof e.n === 'number' && Number.isFinite(e.n) ? Math.max(0, Math.min(10_000, e.n)) : 1
    out[k.slice(0, 40)] = { w: Math.max(-1, Math.min(1, e.w)), n }
  }
  return out
}
const cleanTags = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_KEYS).map(x => x.slice(0, 40)) : []

export function decodeTaste(code: string): TastePayload | null {
  if (code.length > MAX_CODE_LEN) return null
  try {
    const body = code.trim().startsWith(PREFIX) ? code.trim().slice(PREFIX.length) : code.trim()
    const obj = JSON.parse(fromB64(body))
    if (!obj || obj.v !== 1 || typeof obj.taste !== 'object') return null
    return {
      v: 1,
      name: typeof obj.name === 'string' ? obj.name.slice(0, 24) : undefined,
      taste: cleanVec(obj.taste),
      likes: cleanTags(obj.likes),
      dislikes: cleanTags(obj.dislikes),
    }
  } catch {
    return null
  }
}
