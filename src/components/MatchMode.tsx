import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Title } from '../types'
import SwipeDeck from './SwipeDeck'
import Poster from './Poster'
import Icon from './Icon'

const MAX_CARDS = 12 // a quick round, not a marathon
const titleKey = (t: Title) => `${t.mediaType}-${t.id}`

type Stage = 'setup' | 'handoff' | 'swipe' | 'results'

/** Pass-the-phone match: 2–4 players swipe the SAME snapshotted deck in turn;
 *  a title everyone swiped right on is a match. Fully ephemeral — nothing is
 *  persisted or sent anywhere. */
export default function MatchMode({ deck, onClose, onOpenTitle }: {
  deck: Title[]
  onClose: () => void
  onOpenTitle: (t: Title) => void
}) {
  const [stage, setStage] = useState<Stage>('setup')
  const [count, setCount] = useState(2)
  const [cur, setCur] = useState(0)
  const [idx, setIdx] = useState(0)

  const gameDeck = useRef<Title[]>([])
  const likes = useRef<string[][]>([]) // likes[player] = [titleKey, …]
  const names = useRef<string[]>([])

  // Give the system Back gesture / button something to pop instead of leaving.
  useEffect(() => {
    window.history.pushState({ rexMatch: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])
  const close = () => window.history.back()

  const start = () => {
    gameDeck.current = deck.slice(0, MAX_CARDS)
    likes.current = Array.from({ length: count }, () => [])
    names.current = Array.from({ length: count }, (_, i) => `Player ${i + 1}`)
    setCur(0); setIdx(0); setStage('handoff')
  }

  // Advance when a player finishes the deck.
  useEffect(() => {
    if (stage !== 'swipe') return
    if (idx >= gameDeck.current.length) {
      if (cur < names.current.length - 1) { setCur(c => c + 1); setIdx(0); setStage('handoff') }
      else setStage('results')
    }
  }, [idx, stage, cur])

  const record = (t: Title, liked: boolean) => {
    if (liked) likes.current[cur].push(titleKey(t))
    setIdx(i => i + 1)
  }

  const matches = (): Title[] =>
    gameDeck.current.filter(t => likes.current.every(pl => pl.includes(titleKey(t))))

  const remaining = gameDeck.current.slice(idx)
  const total = gameDeck.current.length

  return (
    <div role="dialog" aria-modal="true" aria-label="Match mode"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0B0B12', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(14px, env(safe-area-inset-top)) 18px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
          <Icon name="users" size={19} /> Match
        </div>
        <button onClick={close} aria-label="Close match"
          style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}>
          <Icon name="x" size={17} />
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 18px 22px' }}>
        {stage === 'setup' && (
          <div style={{ textAlign: 'center', maxWidth: 360, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: '#7dd3fc' }}><Icon name="users" size={40} /></div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>What do you both watch?</div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.7, lineHeight: 1.5 }}>
              Everyone swipes the same {Math.min(MAX_CARDS, deck.length)} titles, one after another. Pass the phone between turns — a title you all swipe right on is a match.
            </div>
            <div style={{ marginTop: 22, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>Players</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setCount(n)} aria-pressed={count === n}
                  style={{ width: 52, height: 52, borderRadius: 14, fontSize: 18, fontWeight: 800, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.16)',
                    background: count === n ? '#fff' : 'rgba(255,255,255,0.08)', color: count === n ? '#0B0B12' : '#fff' }}>{n}</button>
              ))}
            </div>
            <button onClick={start} disabled={deck.length === 0}
              style={{ marginTop: 26, width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: deck.length ? 'pointer' : 'default', background: deck.length ? '#22c55e' : 'rgba(255,255,255,0.1)', color: deck.length ? '#06210f' : '#fff', border: 'none' }}>
              {deck.length ? 'Start matching' : 'No titles to match — swipe a deck first'}
            </button>
          </div>
        )}

        {stage === 'handoff' && (
          <div style={{ textAlign: 'center', maxWidth: 340, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: '#7dd3fc' }}><Icon name="share" size={36} /></div>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>Pass the phone to</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{names.current[cur]}</div>
            <div style={{ marginTop: 8, fontSize: 13.5, opacity: 0.65 }}>Don't peek at anyone else's picks. Tap when you've got it.</div>
            <button onClick={() => setStage('swipe')}
              style={{ marginTop: 24, width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
              I'm {names.current[cur]} — start
            </button>
          </div>
        )}

        {stage === 'swipe' && remaining.length > 0 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.7 }}>{names.current[cur]} · {Math.min(idx + 1, total)}/{total}</span>
            </div>
            <SwipeDeck
              key={`p${cur}`}
              deck={remaining}
              onLike={t => record(t, true)}
              onPass={t => record(t, false)}
              onWatched={t => record(t, true)}
              onOpenDetail={() => { /* keep picks blind during a round */ }}
            />
          </div>
        )}

        {stage === 'results' && <Results matches={matches()} players={names.current.length} onOpenTitle={onOpenTitle} onAgain={() => setStage('setup')} onClose={close} />}
      </main>
    </div>
  )
}

function Results({ matches, players, onOpenTitle, onAgain, onClose }: {
  matches: Title[]; players: number; onOpenTitle: (t: Title) => void; onAgain: () => void; onClose: () => void
}) {
  const cell: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 11, background: '#15151F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 8, width: '100%', textAlign: 'left', cursor: 'pointer' }
  return (
    <div style={{ maxWidth: 420, width: '100%', margin: '0 auto', overflowY: 'auto', maxHeight: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: matches.length ? '#22c55e' : '#9ca3af' }}>
          <Icon name={matches.length ? 'heart' : 'film'} size={38} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {matches.length ? `${matches.length} match${matches.length > 1 ? 'es' : ''}!` : 'No matches this round'}
        </div>
        <div style={{ marginTop: 6, fontSize: 13.5, opacity: 0.7 }}>
          {matches.length ? `All ${players} of you swiped right on these.` : 'Nobody agreed on a title — run it back with a fresh deck.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map(t => (
          <button key={titleKey(t)} style={cell} onClick={() => onOpenTitle(t)} aria-label={`Open ${t.title}`}>
            <div style={{ width: 44, height: 62, position: 'relative', borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
              <Poster src={t.poster} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div style={{ marginTop: 2, fontSize: 11.5, opacity: 0.6 }}>{t.year} · {t.mediaType === 'tv' ? 'TV' : 'Film'} · ★ {t.rating.toFixed(1)}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={onAgain}
          style={{ flex: 1, padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}>
          Play again
        </button>
        <button onClick={onClose}
          style={{ flex: 1, padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
          Done
        </button>
      </div>
    </div>
  )
}
