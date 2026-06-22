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

export function decodeTaste(code: string): TastePayload | null {
  try {
    const body = code.trim().startsWith(PREFIX) ? code.trim().slice(PREFIX.length) : code.trim()
    const obj = JSON.parse(fromB64(body))
    if (!obj || obj.v !== 1 || typeof obj.taste !== 'object') return null
    return {
      v: 1,
      name: typeof obj.name === 'string' ? obj.name.slice(0, 24) : undefined,
      taste: obj.taste ?? {},
      likes: Array.isArray(obj.likes) ? obj.likes.filter((x: unknown) => typeof x === 'string') : [],
      dislikes: Array.isArray(obj.dislikes) ? obj.dislikes.filter((x: unknown) => typeof x === 'string') : [],
    }
  } catch {
    return null
  }
}
