import type { Title } from '../types'
import type { TasteVec } from './taste'

// Remote match rooms: two devices share a short code, swipe the same deck, and
// poll each other's swipes for live matches. Two transports:
//   • cloud  — a Supabase Edge Function (`match`) for real cross-device play.
//   • local  — localStorage, so it works same-browser (and is testable offline);
//              "another device" = another tab. Used when no proxy is configured.

export type Dir = 'like' | 'pass'
export interface Player { name: string; taste: TasteVec; swipes: Record<string, Dir> }
export interface Room { code: string; deck: Title[]; host: Player; guest: Player | null }
export type Role = 'host' | 'guest'

const PROXY = import.meta.env.VITE_TMDB_PROXY as string | undefined
export const ROOM_BACKEND: 'cloud' | 'local' = PROXY ? 'cloud' : 'local'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
const makeCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)

type Result<T> = T | { error: string }
export const isErr = <T,>(r: Result<T>): r is { error: string } => !!r && typeof r === 'object' && 'error' in r

// ── cloud transport ──────────────────────────────────────────────────────────
async function call(action: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${PROXY}/match`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: data?.error || `request failed (${res.status})` }
  return data
}

// ── local transport ──────────────────────────────────────────────────────────
const LKEY = (code: string) => `rex_room_${code}`
const readLocal = (code: string): Room | null => {
  try { const r = localStorage.getItem(LKEY(code)); return r ? JSON.parse(r) : null } catch { return null }
}
const writeLocal = (room: Room) => { try { localStorage.setItem(LKEY(room.code), JSON.stringify(room)) } catch { /* quota */ } }

// ── unified API ──────────────────────────────────────────────────────────────
export async function createRoom(deck: Title[], me: Player): Promise<Result<{ code: string }>> {
  if (ROOM_BACKEND === 'cloud') return call('create', { deck, player: me })
  let code = makeCode()
  for (let i = 0; i < 5 && readLocal(code); i++) code = makeCode()
  writeLocal({ code, deck, host: me, guest: null })
  return { code }
}

export async function joinRoom(code: string, me: Player): Promise<Result<Room>> {
  if (ROOM_BACKEND === 'cloud') return call('join', { code, player: me })
  const room = readLocal(code)
  if (!room) return { error: 'Room not found — check the code.' }
  if (room.guest) return { error: 'That room is already full.' }
  room.guest = me
  writeLocal(room)
  return room
}

/** Push my latest state, pull the whole room (peer swipes + tastes). */
export async function syncRoom(code: string, role: Role, me: Player): Promise<Result<Room>> {
  if (ROOM_BACKEND === 'cloud') return call('sync', { code, role, player: me })
  const room = readLocal(code)
  if (!room) return { error: 'Room closed.' }
  room[role] = me
  writeLocal(room)
  return room
}

export function leaveLocal(code: string) {
  if (ROOM_BACKEND === 'local') { try { localStorage.removeItem(LKEY(code)) } catch { /* ignore */ } }
}

/** Titles both players swiped right on, in deck order. */
export function matchesOf(room: Room): Title[] {
  if (!room.guest) return []
  const h = room.host.swipes, g = room.guest.swipes
  return room.deck.filter(t => {
    const k = `${t.mediaType}-${t.id}`
    return h[k] === 'like' && g[k] === 'like'
  })
}
