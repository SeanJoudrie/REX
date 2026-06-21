import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaType, Title } from './types'
import { fetchDeck, USING_SAMPLE } from './tmdb'
import { loadState, saveState } from './lib/storage'
import SwipeDeck from './components/SwipeDeck'
import Watchlist from './components/Watchlist'
import Detail from './components/Detail'

type Screen = 'deck' | 'watchlist'
type Filter = 'all' | MediaType
type Status = 'loading' | 'ready' | 'error'

/** Stable identity: TMDB reuses numeric ids across movies and TV, so a title is
 *  only unique by (mediaType, id). Everything keys off this. */
const keyOf = (t: Title) => `${t.mediaType}-${t.id}`

export default function App() {
  const initial = useMemo(loadState, [])
  const [watchlist, setWatchlist] = useState<Title[]>(initial.watchlist)
  const [seen, setSeen] = useState<string[]>(initial.seen)
  const [pool, setPool] = useState<Title[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [screen, setScreen] = useState<Screen>('deck')
  const [filter, setFilter] = useState<Filter>('all')
  const [detail, setDetail] = useState<Title | null>(null)

  // Load the deck source (sample today, TMDB proxy once configured), with an
  // explicit loading + error + retry path.
  const load = useCallback(() => {
    setStatus('loading')
    let alive = true
    fetchDeck({ mediaTypes: ['movie', 'tv'] })
      .then(d => { if (alive) { setPool(d); setStatus('ready') } })
      .catch(() => { if (alive) setStatus('error') })
    return () => { alive = false }
  }, [])
  useEffect(() => load(), [load])

  // Persist, but skip the redundant write of the just-loaded state.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    saveState({ watchlist, seen })
  }, [watchlist, seen])

  // The deck excludes everything swiped OR already saved, so "Start over"
  // (which clears seen) can't resurrect watchlisted titles.
  const excluded = useMemo(() => {
    const s = new Set(seen)
    for (const w of watchlist) s.add(keyOf(w))
    return s
  }, [seen, watchlist])

  const deck = useMemo(
    () => pool.filter(t => !excluded.has(keyOf(t)) && (filter === 'all' || t.mediaType === filter)),
    [pool, excluded, filter],
  )

  const savedKeys = useMemo(() => new Set(watchlist.map(keyOf)), [watchlist])
  const isSaved = (t: Title) => savedKeys.has(keyOf(t))

  const like = (t: Title) => {
    const k = keyOf(t)
    setSeen(s => (s.includes(k) ? s : [...s, k]))
    setWatchlist(w => (w.some(x => keyOf(x) === k) ? w : [...w, t]))
  }
  const pass = (t: Title) => {
    const k = keyOf(t)
    setSeen(s => (s.includes(k) ? s : [...s, k]))
  }

  // Decide add/remove inside the updater so concurrent taps can't duplicate.
  const toggleSave = (t: Title) => {
    const k = keyOf(t)
    setWatchlist(w => (w.some(x => keyOf(x) === k) ? w.filter(x => keyOf(x) !== k) : [...w, t]))
    setSeen(s => (s.includes(k) ? s : [...s, k]))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 640, margin: '0 auto' }}>
      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(14px, env(safe-area-inset-top)) 18px 6px' }}>
        <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '0.14em' }}>
          R<span style={{ color: '#22c55e' }}>E</span>X
        </div>
        {screen === 'deck' && status === 'ready' && (
          <div role="group" aria-label="Filter by type" style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.06)', padding: 4, borderRadius: 999 }}>
            {(['all', 'movie', 'tv'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: 'none',
                  background: filter === f ? '#fff' : 'transparent', color: filter === f ? '#0B0B12' : '#fff' }}>
                {f === 'all' ? 'All' : f === 'movie' ? 'Film' : 'TV'}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main */}
      <main style={{ flex: 1, minHeight: 0, overflowY: screen === 'watchlist' ? 'auto' : 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: screen === 'deck' ? '8px 16px' : 0 }}>
        {screen === 'deck' ? (
          status === 'loading' ? (
            <Centered glyph="🍿" title="Loading titles…" />
          ) : status === 'error' ? (
            <Centered glyph="⚠️" title="Couldn't load the deck"
              sub="Check your connection and try again."
              action={{ label: 'Retry', onClick: load }} />
          ) : deck.length > 0 ? (
            <SwipeDeck deck={deck} onLike={like} onPass={pass} onOpenDetail={setDetail} />
          ) : (
            <Centered glyph="🍿" title="You've seen everything"
              sub={`${filter !== 'all' ? 'Try switching Film/TV up top, or ' : ''}reset to swipe again.`}
              action={{ label: 'Start over', onClick: () => setSeen([]) }} />
          )
        ) : (
          <Watchlist items={watchlist} onOpen={setDetail} onRemove={toggleSave} />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(11,11,18,0.9)', backdropFilter: 'blur(10px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavBtn active={screen === 'deck'} onClick={() => setScreen('deck')} label="Discover" glyph="🔥" />
        <NavBtn active={screen === 'watchlist'} onClick={() => setScreen('watchlist')} label="Watchlist" glyph="🎬" badge={watchlist.length} />
      </nav>

      {USING_SAMPLE && (
        <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, opacity: 0.4, pointerEvents: 'none' }}>
          sample deck · connect TMDB to go live
        </div>
      )}

      {detail && <Detail t={detail} saved={isSaved(detail)} onClose={() => setDetail(null)} onToggleSave={toggleSave} />}
    </div>
  )
}

function Centered({ glyph, title, sub, action }: {
  glyph: string; title: string; sub?: string; action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{glyph}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 13.5, opacity: 0.7 }}>{sub}</div>}
      {action && (
        <button onClick={action.onClick}
          style={{ marginTop: 18, padding: '12px 22px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
          {action.label}
        </button>
      )}
    </div>
  )
}

function NavBtn({ active, onClick, label, glyph, badge }: { active: boolean; onClick: () => void; label: string; glyph: string; badge?: number }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0 9px', cursor: 'pointer', background: 'transparent', border: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.45)' }}>
      <span style={{ fontSize: 19, position: 'relative' }}>
        {glyph}
        {!!badge && <span aria-label={`${badge} saved`} style={{ position: 'absolute', top: -4, right: -12, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, lineHeight: '16px', borderRadius: 999, background: '#22c55e', color: '#06210f' }}>{badge}</span>}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em' }}>{label}</span>
    </button>
  )
}
