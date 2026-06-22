import { useEffect, useRef, useState } from 'react'
import type { Title } from '../types'
import SwipeDeck from './SwipeDeck'
import MovieCard from './MovieCard'
import { sharedDeck } from '../match/deck'
import { openLocal } from '../match/transport'
import type { MatchMsg, MatchTransport } from '../match/transport'

const keyOf = (t: Title) => `${t.mediaType}-${t.id}`
const randomCode = () => String(Math.floor(1000 + Math.random() * 9000))
const watchUrl = (t: Title) => `https://www.justwatch.com/us/search?q=${encodeURIComponent(t.title)}`

const GREEN = '#22c55e'

export default function MatchMode({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'lobby' | 'swiping'>('lobby')
  const [code, setCode] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [remaining, setRemaining] = useState<Title[]>([])
  const [matched, setMatched] = useState<Title | null>(null)
  const [partnerHere, setPartnerHere] = useState(false)

  const myLikes = useRef<Set<string>>(new Set())
  const theirLikes = useRef<Set<string>>(new Set())
  const deckRef = useRef<Title[]>([])
  const ch = useRef<MatchTransport | null>(null)
  const helloedBack = useRef(false)

  useEffect(() => () => { ch.current?.close() }, [])

  const declareMatch = (k: string) => {
    const t = deckRef.current.find(x => keyOf(x) === k)
    if (!t) return
    setMatched(t)
    if (navigator.vibrate) navigator.vibrate([12, 40, 12, 40, 20])
  }

  const onMsg = (m: MatchMsg) => {
    if (m.kind === 'hello') {
      setPartnerHere(true)
      if (!helloedBack.current) { helloedBack.current = true; ch.current?.send({ kind: 'hello' }) }
    } else if (m.kind === 'like') {
      theirLikes.current.add(m.key)
      setPartnerHere(true)
      if (myLikes.current.has(m.key)) declareMatch(m.key)
    } else if (m.kind === 'bye') {
      setPartnerHere(false)
    }
  }

  const start = (c: string) => {
    const d = sharedDeck(c)
    deckRef.current = d
    myLikes.current = new Set(); theirLikes.current = new Set(); helloedBack.current = false
    setRemaining(d); setCode(c); setMatched(null)
    ch.current = openLocal(c, onMsg)
    ch.current.send({ kind: 'hello' })
    setPhase('swiping')
  }

  const removeTop = (t: Title) => setRemaining(r => r.filter(x => keyOf(x) !== keyOf(t)))

  const handleLike = (t: Title) => {
    const k = keyOf(t)
    myLikes.current.add(k)
    ch.current?.send({ kind: 'like', key: k })
    removeTop(t)
    if (theirLikes.current.has(k)) declareMatch(k)
  }

  const leave = () => { ch.current?.close(); ch.current = null; onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0B0B12', display: 'flex', flexDirection: 'column', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(14px, env(safe-area-inset-top)) 18px 8px' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>👥 Watch together</div>
        <button onClick={leave} aria-label="Close"
          style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', fontSize: 16, cursor: 'pointer' }}>✕</button>
      </header>

      {phase === 'lobby' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, padding: '0 28px 40px', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Pick something — together</div>
            <p style={{ marginTop: 8, fontSize: 14, opacity: 0.7, lineHeight: 1.55 }}>
              Both of you swipe the same deck. The instant you both like the same title, it's a match.
            </p>
          </div>

          <button onClick={() => start(randomCode())}
            style={{ padding: '15px', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', background: GREEN, color: '#06210f', border: 'none' }}>
            Create a code
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.4, fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} /> or join one <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <form onSubmit={e => { e.preventDefault(); if (joinInput.trim().length >= 3) start(joinInput.trim()) }}
            style={{ display: 'flex', gap: 8 }}>
            <input value={joinInput} onChange={e => setJoinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric" placeholder="Enter code"
              style={{ flex: 1, fontSize: 18, fontWeight: 700, letterSpacing: '0.3em', textAlign: 'center', padding: '13px', borderRadius: 14, outline: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }} />
            <button type="submit"
              style={{ padding: '0 22px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>Join</button>
          </form>

          <p style={{ fontSize: 11.5, opacity: 0.4, lineHeight: 1.5 }}>
            Demo syncs across browser tabs on this device. Two phones need the Supabase Realtime key wired in — same code, same magic.
          </p>
        </div>
      ) : (
        <>
          {/* Code + partner status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 18px 8px' }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.3em', padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}>{code}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: partnerHere ? GREEN : '#6b7280' }} />
              {partnerHere ? 'Partner connected' : 'Waiting for partner…'}
            </span>
          </div>

          <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '6px 16px' }}>
            {remaining.length > 0 ? (
              <SwipeDeck deck={remaining} onLike={handleLike} onPass={removeTop} onWatched={removeTop} onOpenDetail={() => { /* no detail in match mode */ }} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>No match yet</div>
                <div style={{ marginTop: 6, fontSize: 13.5, opacity: 0.7 }}>You've been through the deck. Start a fresh code together.</div>
                <button onClick={() => start(randomCode())}
                  style={{ marginTop: 18, padding: '12px 22px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', background: GREEN, color: '#06210f', border: 'none' }}>Fresh code</button>
              </div>
            )}
          </main>
        </>
      )}

      {/* Match celebration */}
      {matched && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(11,11,18,0.92)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.2em', color: GREEN }}>IT'S A MATCH</div>
          <div style={{ fontSize: 26, fontWeight: 900, margin: '6px 0 18px', letterSpacing: '-0.02em' }}>You both want {matched.title} 🍿</div>
          <div style={{ position: 'relative', width: 200, height: 280 }}><MovieCard t={matched} /></div>
          <a href={watchUrl(matched)} target="_blank" rel="noopener noreferrer"
            style={{ marginTop: 22, width: '100%', maxWidth: 320, padding: '15px', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', background: GREEN, color: '#06210f', border: 'none', textDecoration: 'none', display: 'block' }}>
            ▶ Watch now
          </a>
          <button onClick={() => setMatched(null)}
            style={{ marginTop: 10, padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
            Keep swiping
          </button>
        </div>
      )}
    </div>
  )
}
