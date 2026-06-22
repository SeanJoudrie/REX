import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Title } from '../types'
import type { TasteVec } from '../lib/taste'
import { mergeTaste, rankDeck } from '../lib/taste'
import {
  createRoom, joinRoom, syncRoom, matchesOf, normalizeCode, isErr, leaveLocal, ROOM_BACKEND,
} from '../lib/matchRoom'
import type { Player, Role, Room } from '../lib/matchRoom'
import SwipeDeck from './SwipeDeck'
import Poster from './Poster'
import Icon from './Icon'

const keyOf = (t: Title) => `${t.mediaType}-${t.id}`
const SIZES: [string, number, string][] = [['Quick', 15, '~2 min'], ['Standard', 30, '~5 min'], ['Marathon', 75, 'go long']]
const POLL_MS = 1500

type Stage = 'lobby' | 'create' | 'join' | 'waiting' | 'swiping' | 'summary'

export default function RemoteMatch({ deck, myTaste, onOpenTitle, onExit }: {
  deck: Title[]
  myTaste: TasteVec
  onOpenTitle: (t: Title) => void
  onExit: () => void
}) {
  const [stage, setStage] = useState<Stage>('lobby')
  const [role, setRole] = useState<Role>('host')
  const [code, setCode] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [name, setName] = useState('')
  const [size, setSize] = useState(30)
  const [room, setRoom] = useState<Room | null>(null)
  const [idx, setIdx] = useState(0)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [popup, setPopup] = useState<Title | null>(null)
  const [matches, setMatches] = useState<Title[]>([])

  const mySwipes = useRef<Record<string, 'like' | 'pass'>>({})
  const celebrated = useRef<Set<string>>(new Set())
  const queue = useRef<Title[]>([])
  const showing = useRef(false)

  const me = useCallback((): Player => ({ name: name.trim() || 'You', taste: myTaste, swipes: { ...mySwipes.current } }), [name, myTaste])
  const peer = room ? (role === 'host' ? room.guest : room.host) : null

  // ── room lifecycle ─────────────────────────────────────────────────────────
  const create = async () => {
    setBusy(true); setErr('')
    const snapshot = deck.slice(0, size)
    const r = await createRoom(snapshot, me())
    setBusy(false)
    if (isErr(r)) { setErr(r.error); return }
    setRole('host'); setCode(r.code); setStage('waiting')
  }
  const join = async () => {
    const c = normalizeCode(joinInput)
    if (c.length !== 4) { setErr('Enter the 4-character code.'); return }
    setBusy(true); setErr('')
    const r = await joinRoom(c, me())
    setBusy(false)
    if (isErr(r)) { setErr(r.error); return }
    setRole('guest'); setCode(c); setRoom(r); setStage('swiping')
  }

  // Poll: push my state, pull the room. Runs while connected.
  useEffect(() => {
    if (!code || (stage !== 'waiting' && stage !== 'swiping' && stage !== 'summary')) return
    let alive = true
    const tick = async () => {
      const r = await syncRoom(code, role, me())
      if (!alive || isErr(r)) return
      setRoom(r)
      if (stage === 'waiting' && r.guest) setStage('swiping') // guest arrived → go
    }
    tick()
    const h = window.setInterval(tick, POLL_MS)
    return () => { alive = false; window.clearInterval(h) }
  }, [code, role, stage, me])

  // New matches → celebrate (Tinder pop-up) + keep the running list.
  useEffect(() => {
    if (!room) return
    const ms = matchesOf(room)
    setMatches(ms)
    for (const t of ms) {
      const k = keyOf(t)
      if (!celebrated.current.has(k)) { celebrated.current.add(k); queue.current.push(t) }
    }
    if (!showing.current && queue.current.length) {
      showing.current = true
      setPopup(queue.current.shift()!)
      if (navigator.vibrate) navigator.vibrate([14, 40, 14])
    }
  }, [room])

  const dismissPopup = () => {
    if (queue.current.length) { setPopup(queue.current.shift()!); if (navigator.vibrate) navigator.vibrate(14) }
    else { showing.current = false; setPopup(null) }
  }

  // Leave a local room behind so the code can be reused / cleaned up.
  useEffect(() => () => { if (code) leaveLocal(code) }, [code])

  // ── swiping ──────────────────────────────────────────────────────────────
  const pushNow = useCallback(() => {
    if (!code) return
    syncRoom(code, role, me()).then(r => { if (!isErr(r)) setRoom(r) })
  }, [code, role, me])

  const record = (t: Title, dir: 'like' | 'pass') => {
    mySwipes.current[keyOf(t)] = dir
    setIdx(i => i + 1)
    pushNow()
  }

  const sharedDeck = room?.deck ?? []
  useEffect(() => {
    if (stage === 'swiping' && sharedDeck.length && idx >= sharedDeck.length) { pushNow(); setStage('summary') }
  }, [idx, stage, sharedDeck.length, pushNow])

  const recs = useMemo(() => {
    if (!room || !peer) return []
    const blended = mergeTaste(myTaste, peer.taste || {})
    const matched = new Set(matches.map(keyOf))
    return rankDeck(room.deck.filter(t => !matched.has(keyOf(t))), blended).slice(0, 4)
  }, [room, peer, matches, myTaste])

  const peerName = peer?.name || 'Your friend'
  const iFinished = stage === 'summary'
  const peerFinished = !!peer && Object.keys(peer.swipes).length >= sharedDeck.length

  // ── render ─────────────────────────────────────────────────────────────────
  if (stage === 'lobby') {
    return (
      <Wrap>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#7dd3fc' }}><Icon name="users" size={40} /></div>
        <H>Match on two phones</H>
        <P>Connect with someone anywhere. You both swipe the same deck and get a live <strong style={{ color: '#fff' }}>It's a Match!</strong> the moment you both like something.</P>
        {ROOM_BACKEND === 'local' && <Note>Demo mode (no server configured): rooms work between tabs on this device.</Note>}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name (optional)" maxLength={16}
          style={inputStyle} />
        <button onClick={() => { setErr(''); setStage('create') }} style={primary}>Create a room</button>
        <button onClick={() => { setErr(''); setStage('join') }} style={secondary}>Join with a code</button>
      </Wrap>
    )
  }

  if (stage === 'create') {
    return (
      <Wrap>
        <H>How long a round?</H>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0 18px' }}>
          {SIZES.map(([label, n, sub]) => (
            <button key={n} onClick={() => setSize(n)} aria-pressed={size === n}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderRadius: 14, cursor: 'pointer',
                border: `1px solid ${size === n ? '#22c55e' : 'rgba(255,255,255,0.16)'}`, background: size === n ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.06)', color: '#fff' }}>
              <span style={{ fontWeight: 800 }}>{label} <span style={{ opacity: 0.6, fontWeight: 600 }}>· {n} titles</span></span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>{sub}</span>
            </button>
          ))}
        </div>
        {err && <Err>{err}</Err>}
        <button onClick={create} disabled={busy || !deck.length} style={primary}>{busy ? 'Creating…' : deck.length ? 'Create room' : 'Swipe a deck first'}</button>
        <button onClick={() => setStage('lobby')} style={ghost}>Back</button>
      </Wrap>
    )
  }

  if (stage === 'join') {
    return (
      <Wrap>
        <H>Enter the code</H>
        <P>Ask your friend for the 4-character room code.</P>
        <input value={joinInput} onChange={e => { setJoinInput(normalizeCode(e.target.value)); setErr('') }} placeholder="ABCD" maxLength={4}
          autoCapitalize="characters" style={{ ...inputStyle, textAlign: 'center', fontSize: 30, fontWeight: 900, letterSpacing: '0.4em' }} />
        {err && <Err>{err}</Err>}
        <button onClick={join} disabled={busy} style={primary}>{busy ? 'Joining…' : 'Join'}</button>
        <button onClick={() => setStage('lobby')} style={ghost}>Back</button>
      </Wrap>
    )
  }

  if (stage === 'waiting') {
    return (
      <Wrap>
        <H>Share this code</H>
        <P>Tell your friend to open REX → Match → Join, and enter:</P>
        <div style={{ margin: '16px 0', fontSize: 52, fontWeight: 900, letterSpacing: '0.3em', color: '#86efac', textAlign: 'center' }}>{code}</div>
        <button onClick={() => { navigator.share?.({ text: `Match with me on REX — room code ${code}` }).catch(() => {}) ?? navigator.clipboard?.writeText(code) }} style={secondary}>
          <Icon name="share" size={15} /> Share code
        </button>
        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className="rex-bob" style={{ width: 8, height: 8, borderRadius: 999, background: '#7dd3fc' }} /> Waiting for someone to join…
        </div>
        <button onClick={onExit} style={ghost}>Cancel</button>
      </Wrap>
    )
  }

  // swiping + summary share the live match pop-up + running tally
  const remaining = sharedDeck.slice(idx)
  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
      {stage === 'swiping' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 12.5, fontWeight: 700, opacity: 0.75 }}>
            with {peerName} · {Math.min(idx + 1, sharedDeck.length)}/{sharedDeck.length}
            {matches.length > 0 && <span style={{ color: '#86efac' }}> · {matches.length} match{matches.length > 1 ? 'es' : ''} 💚</span>}
          </div>
          {remaining.length > 0 && (
            <SwipeDeck key={role} deck={remaining} showDetails={false}
              onLike={t => record(t, 'like')} onPass={t => record(t, 'pass')} onWatched={t => record(t, 'like')} onOpenDetail={() => {}} />
          )}
        </>
      )}

      {stage === 'summary' && (
        <Summary matches={matches} recs={recs} peerName={peerName} peerFinished={peerFinished} iFinished={iFinished}
          onOpenTitle={onOpenTitle} onExit={onExit} />
      )}

      {popup && <MatchPopup title={popup} peerName={peerName} onKeep={dismissPopup} />}
    </div>
  )
}

// ── pieces ─────────────────────────────────────────────────────────────────
function MatchPopup({ title, peerName, onKeep }: { title: Title; peerName: string; onKeep: () => void }) {
  return (
    <div className="rex-fade" style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: 'rgba(11,11,18,0.9)', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '0.02em', color: '#86efac' }}>It's a Match!</div>
      <div style={{ fontSize: 14, opacity: 0.8 }}>You and {peerName} both want to watch</div>
      <div style={{ width: 150, aspectRatio: '2/3', borderRadius: 14, overflow: 'hidden', position: 'relative', background: `linear-gradient(155deg, ${title.gradient[0]}, ${title.gradient[1]})`, boxShadow: '0 16px 40px -12px rgba(0,0,0,0.8)' }}>
        <Poster src={title.poster} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, textAlign: 'center' }}>{title.title}</div>
      <button onClick={onKeep} style={{ ...primary, maxWidth: 260 }}>Keep swiping</button>
    </div>
  )
}

function Summary({ matches, recs, peerName, peerFinished, iFinished, onOpenTitle, onExit }: {
  matches: Title[]; recs: Title[]; peerName: string; peerFinished: boolean; iFinished: boolean
  onOpenTitle: (t: Title) => void; onExit: () => void
}) {
  return (
    <div style={{ maxHeight: '100%', overflowY: 'auto', paddingBottom: 8 }}>
      <div style={{ textAlign: 'center', margin: '4px 0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: matches.length ? '#22c55e' : '#9ca3af' }}>
          <Icon name={matches.length ? 'heart' : 'film'} size={36} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{matches.length ? `${matches.length} match${matches.length > 1 ? 'es' : ''} with ${peerName}` : 'No matches yet'}</div>
        {iFinished && !peerFinished && <div style={{ marginTop: 6, fontSize: 12.5, opacity: 0.6 }}>Waiting for {peerName} to finish — new matches will pop in live.</div>}
      </div>

      {matches.length > 0 && <Rows items={matches} onOpenTitle={onOpenTitle} />}

      {recs.length > 0 && (
        <>
          <div style={{ margin: '20px 2px 10px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>
            {matches.length ? 'Also recommended for you both' : 'No overlap — but based on both your tastes'}
          </div>
          <Rows items={recs} onOpenTitle={onOpenTitle} />
        </>
      )}

      <button onClick={onExit} style={{ ...primary, marginTop: 18 }}>Done</button>
    </div>
  )
}

function Rows({ items, onOpenTitle }: { items: Title[]; onOpenTitle: (t: Title) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(t => (
        <button key={keyOf(t)} onClick={() => onOpenTitle(t)} aria-label={`Open ${t.title}`}
          style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 11, background: '#15151F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 8, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ width: 42, height: 60, position: 'relative', borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
            <Poster src={t.poster} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
            <div style={{ marginTop: 2, fontSize: 11.5, opacity: 0.6 }}>{t.year} · {t.mediaType === 'tv' ? 'TV' : 'Film'} · ★ {t.rating.toFixed(1)}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── shared styles ────────────────────────────────────────────────────────────
const Wrap = ({ children }: { children: React.ReactNode }) => (
  <div style={{ textAlign: 'center', maxWidth: 360, margin: '0 auto', width: '100%' }}>{children}</div>
)
const H = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{children}</div>
const P = ({ children }: { children: React.ReactNode }) => <div style={{ marginTop: 8, fontSize: 14, opacity: 0.7, lineHeight: 1.5 }}>{children}</div>
const Note = ({ children }: { children: React.ReactNode }) => <div style={{ marginTop: 12, fontSize: 12, opacity: 0.55, fontStyle: 'italic' }}>{children}</div>
const Err = ({ children }: { children: React.ReactNode }) => <div style={{ margin: '10px 0', fontSize: 12.5, color: '#fca5a5', fontWeight: 600 }}>{children}</div>

const primary: CSSProperties = { marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }
const secondary: CSSProperties = { marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer', background: 'rgba(56,189,248,0.16)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.4)' }
const ghost: CSSProperties = { marginTop: 10, width: '100%', padding: '11px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.6)', border: 'none' }
const inputStyle: CSSProperties = { marginTop: 14, width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, outline: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)', fontSize: 15, fontWeight: 600 }
