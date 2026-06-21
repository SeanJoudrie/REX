import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { MediaType, Title, WatchedItem } from './types'
import { fetchDeck, USING_SAMPLE } from './tmdb'
import { loadState, saveState } from './lib/storage'
import SwipeDeck from './components/SwipeDeck'
import Watchlist from './components/Watchlist'
import Watched from './components/Watched'
import Detail from './components/Detail'
import RatingSheet from './components/RatingSheet'

type Screen = 'deck' | 'watchlist' | 'watched'
type Filter = 'all' | MediaType
type Status = 'loading' | 'ready' | 'error'

const keyOf = (t: Title) => `${t.mediaType}-${t.id}`

// Genre chips shown on the deck. The proxy maps these names to TMDB ids; the
// sample deck matches them by name.
const GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']
const NOW = new Date().getFullYear()
const YEARS = Array.from({ length: NOW - 2009 }, (_, i) => NOW - i).concat([2005, 2000, 1995, 1990, 1980])
const SORTS: [string, string][] = [['popular', '🔥 Popular'], ['top', '★ Top Rated'], ['box_office', '💰 Box Office'], ['new', '🆕 Newest'], ['hidden', '💎 Hidden Gems']]

const pillSelect = (active: boolean) => ({
  flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
  background: active ? '#fff' : 'rgba(255,255,255,0.08)', color: active ? '#0B0B12' : '#fff', border: '1px solid rgba(255,255,255,0.16)',
})

export default function App() {
  const initial = useMemo(loadState, [])
  const [watchlist, setWatchlist] = useState<Title[]>(initial.watchlist)
  const [watched, setWatched] = useState<WatchedItem[]>(initial.watched)
  const [seen, setSeen] = useState<string[]>(initial.seen)
  const [pool, setPool] = useState<Title[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [screen, setScreen] = useState<Screen>('deck')
  const [filter, setFilter] = useState<Filter>('all')
  const [genre, setGenre] = useState<string | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [sort, setSort] = useState<string>('popular')
  const [actor, setActor] = useState<string | null>(null)
  const [actorInput, setActorInput] = useState('')
  const [detail, setDetail] = useState<Title | null>(null)
  const [ratingFor, setRatingFor] = useState<Title | null>(null)

  // Fetch the deck for the current filters. Genre/year refetch from the proxy
  // (live recommendations) or filter the sample deck when no proxy is set.
  const load = useCallback(() => {
    setStatus('loading')
    const ctrl = new AbortController()
    const mediaTypes: MediaType[] = filter === 'all' ? ['movie', 'tv'] : [filter]
    fetchDeck({ mediaTypes, genre: genre ?? undefined, year: year ?? undefined, sort, actor: actor ?? undefined }, ctrl.signal)
      .then(d => { setPool(d); setStatus('ready') })
      .catch((e: unknown) => { if ((e as Error)?.name !== 'AbortError') setStatus('error') })
    return () => ctrl.abort()
  }, [filter, genre, year, sort, actor])
  useEffect(() => load(), [load])

  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    saveState({ watchlist, watched, seen })
  }, [watchlist, watched, seen])

  // The deck excludes everything swiped, saved, or watched.
  const excluded = useMemo(() => {
    const s = new Set(seen)
    for (const w of watchlist) s.add(keyOf(w))
    for (const w of watched) s.add(keyOf(w))
    return s
  }, [seen, watchlist, watched])

  const deck = useMemo(() => pool.filter(t => !excluded.has(keyOf(t))), [pool, excluded])

  const savedKeys = useMemo(() => new Set(watchlist.map(keyOf)), [watchlist])
  const isSaved = (t: Title) => savedKeys.has(keyOf(t))

  const markSeen = (k: string) => setSeen(s => (s.includes(k) ? s : [...s, k]))

  const like = (t: Title) => {
    const k = keyOf(t)
    markSeen(k)
    setWatchlist(w => (w.some(x => keyOf(x) === k) ? w : [...w, t]))
  }
  const pass = (t: Title) => markSeen(keyOf(t))

  const markWatched = (t: Title) => {
    const k = keyOf(t)
    markSeen(k)
    setWatchlist(w => w.filter(x => keyOf(x) !== k))
    setWatched(list => (list.some(x => keyOf(x) === k) ? list : [...list, { ...t, stars: 0 }]))
    setRatingFor(t)
  }

  const rate = (t: Title, stars: number) => {
    const k = keyOf(t)
    setWatched(list => list.map(x => (keyOf(x) === k ? { ...x, stars } : x)))
  }
  const removeWatched = (t: WatchedItem) => setWatched(list => list.filter(x => keyOf(x) !== keyOf(t)))

  const toggleSave = (t: Title) => {
    const k = keyOf(t)
    setWatchlist(w => (w.some(x => keyOf(x) === k) ? w.filter(x => keyOf(x) !== k) : [...w, t]))
    markSeen(k)
  }

  const filtersActive = filter !== 'all' || genre !== null || year !== null || sort !== 'popular' || actor !== null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 640, margin: '0 auto' }}>
      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(14px, env(safe-area-inset-top)) 18px 6px' }}>
        <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '0.14em' }}>
          R<span style={{ color: '#22c55e' }}>E</span>X
        </div>
        {screen === 'deck' && (
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

      {/* Sort / year / genre filters (deck only) */}
      {screen === 'deck' && (
        <div role="group" aria-label="Sort and filter" style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '4px 16px 8px', WebkitOverflowScrolling: 'touch' }}>
          <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} style={pillSelect(sort !== 'popular')}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Year" value={year ?? ''} onChange={e => setYear(e.target.value ? Number(e.target.value) : null)} style={pillSelect(!!year)}>
            <option value="">Any year</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Chip active={genre === null} onClick={() => setGenre(null)}>All genres</Chip>
          {GENRES.map(g => <Chip key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Chip>)}
        </div>
      )}

      {/* Actor search (deck only) */}
      {screen === 'deck' && (
        <form onSubmit={e => { e.preventDefault(); setActor(actorInput.trim() || null) }}
          style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 16px 8px' }}>
          <input value={actorInput} onChange={e => setActorInput(e.target.value)} enterKeyHint="search"
            placeholder="🔍 Search by actor… (e.g. Zendaya)"
            style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 999, outline: 'none',
              background: 'rgba(255,255,255,0.08)', color: '#fff', border: `1px solid ${actor ? '#22c55e' : 'rgba(255,255,255,0.16)'}` }} />
          {actor && (
            <button type="button" onClick={() => { setActor(null); setActorInput('') }} aria-label="Clear actor search"
              style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
                background: '#22c55e', color: '#06210f', border: 'none' }}>
              {actor} ✕
            </button>
          )}
        </form>
      )}

      {/* Main */}
      <main style={{ flex: 1, minHeight: 0, overflowY: screen === 'deck' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', justifyContent: screen === 'deck' ? 'center' : 'flex-start', padding: screen === 'deck' ? '6px 16px' : 0 }}>
        {screen === 'deck' ? (
          status === 'loading' ? (
            <Centered glyph="🍿" title="Loading titles…" />
          ) : status === 'error' ? (
            <Centered glyph="⚠️" title="Couldn't load the deck" sub="Check your connection and try again." action={{ label: 'Retry', onClick: load }} />
          ) : deck.length > 0 ? (
            <SwipeDeck deck={deck} onLike={like} onPass={pass} onWatched={markWatched} onOpenDetail={setDetail} />
          ) : (
            <Centered glyph="🍿" title="That's the deck for now"
              sub={`${filtersActive ? 'Try a different genre/year up top, or ' : ''}get a fresh batch.`}
              action={{ label: 'Fresh batch', onClick: () => { setSeen([]); load() } }} />
          )
        ) : screen === 'watchlist' ? (
          <Watchlist items={watchlist} onOpen={setDetail} onRemove={toggleSave} />
        ) : (
          <Watched items={watched} onRate={rate} onRemove={removeWatched} onOpen={setDetail} />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(11,11,18,0.9)', backdropFilter: 'blur(10px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavBtn active={screen === 'deck'} onClick={() => setScreen('deck')} label="Discover" glyph="🔥" />
        <NavBtn active={screen === 'watchlist'} onClick={() => setScreen('watchlist')} label="Watchlist" glyph="🎬" badge={watchlist.length} />
        <NavBtn active={screen === 'watched'} onClick={() => setScreen('watched')} label="Watched" glyph="👁" badge={watched.length} />
      </nav>

      {USING_SAMPLE && (
        <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, opacity: 0.4, pointerEvents: 'none' }}>
          sample deck · connect TMDB to go live
        </div>
      )}

      {detail && <Detail t={detail} saved={isSaved(detail)} onClose={() => setDetail(null)} onToggleSave={toggleSave} />}
      {ratingFor && <RatingSheet t={ratingFor} onRate={s => { rate(ratingFor, s); setRatingFor(null) }} onClose={() => setRatingFor(null)} />}
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
        background: active ? '#fff' : 'rgba(255,255,255,0.08)', color: active ? '#0B0B12' : '#fff',
        border: '1px solid rgba(255,255,255,0.16)', whiteSpace: 'nowrap' }}>{children}</button>
  )
}

function NavBtn({ active, onClick, label, glyph, badge }: { active: boolean; onClick: () => void; label: string; glyph: string; badge?: number }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0 9px', cursor: 'pointer', background: 'transparent', border: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.45)' }}>
      <span style={{ fontSize: 19, position: 'relative' }}>
        {glyph}
        {!!badge && <span aria-label={`${badge}`} style={{ position: 'absolute', top: -4, right: -12, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, lineHeight: '16px', borderRadius: 999, background: '#22c55e', color: '#06210f' }}>{badge}</span>}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em' }}>{label}</span>
    </button>
  )
}
