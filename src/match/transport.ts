// Match Mode sync transport.
//
// Two people on the SAME 4-digit code swipe a shared deck; when both like the
// same title it's a match. That needs a channel between the two clients.
//
// `openLocal` uses BroadcastChannel — it works across TABS in the same browser,
// which is enough to demo and test the whole flow end-to-end with zero backend.
//
// For real cross-DEVICE play (two phones), swap this for a Supabase Realtime
// channel keyed on the same code (`supabase.channel('rex-match-'+code)`), which
// the existing REX Supabase project can host — it just needs the anon key +
// Realtime enabled. The component below depends only on the MatchTransport
// interface, so that swap is a one-file change.

export type MatchMsg =
  | { kind: 'hello' }
  | { kind: 'like'; key: string }
  | { kind: 'bye' }

export interface MatchTransport {
  send(msg: MatchMsg): void
  close(): void
}

export function openLocal(code: string, onMsg: (m: MatchMsg) => void): MatchTransport {
  const bc = new BroadcastChannel(`rex-match-${code}`)
  bc.onmessage = (e: MessageEvent<MatchMsg>) => onMsg(e.data)
  return {
    send: (m) => { try { bc.postMessage(m) } catch { /* channel closing */ } },
    close: () => { try { bc.postMessage({ kind: 'bye' }) } catch { /* ignore */ } bc.close() },
  }
}
