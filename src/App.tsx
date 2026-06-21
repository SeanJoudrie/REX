import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { MediaType, Title, WatchedItem } from './types'
import { fetchDeck, USING_SAMPLE } from './tmdb'
import { loadState, saveState } from './lib/storage'
import SwipeDeck from './components/SwipeDeck'
import Watchlist from './components/Watchlist'
import Watched from './components/Watched'
import Detail from './components/Detail'
import RatingSheet from './components/RatingSheet'
import Onboarding from './components/Onboarding'
import Icon from './components/Icon'
import type { TasteVec } from './lib/taste'
import { applySignal, bottomGenres, rankDeck, topGenres, LIKE_DELTA, PASS_DELTA, starDelta } from './lib/taste'

type Screen = 'deck' | 'watchlist' | 'watched'
type Filter = 'all' | MediaType
type Status = 'loading' | 'ready' | 'error'

const keyOf = (t: Title) => `${t.mediaType}-${t.id}`

const GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']
const SERVICES = ['Netflix', 'Disney+', 'Hulu', 'Max', 'Prime Video', 'Apple TV+', 'Paramount+', 'Peacock']
const SORTS: [string, string][] = [['popular', 'Popular'], ['top', 'Top Rated'], ['box_office', 'Box Office'], ['new', 'Newest'], ['streaming_new', 'New on Streaming'], ['hidden', 'Hidden Gems']]
const NOW = new Date().getFullYear()
const YEARS = Array.from({ length: NOW - 2009 }, (_, i) => NOW - i).concat([2005, 2000, 1995, 1990, 1980])

const pillSelect = (active: boolean): CSSProperties => ({
  flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '7px 11px', borderRadius: 999, cursor: 'pointer',
  background: active ? '#fff' : 'rgba(255,255,255,0.08)', color: active ? '#0B0B12' : '#fff', border: '1px solid rgba(255,255,255,0.16)',
})

export default function App() {
  const initial = useMemo(loadState, [])
  const [watchlist, setWatchlist] = useState<Title[]>(initial.watchlist)
  const [watched, setWatched] = useState<WatchedItem[]>(initial.watched)
  const [seen, setSeen] = useState<string[]>(initial.seen)
  const [likes, setLikes] = useState<string[]>(initial.likes)
  const [dislikes, setDislikes] = useState<string[]>(initial.dislikes)
  const [taste, setTaste] = useState<TasteVec>(initial.taste)
  const [onboarded, setOnboarded] = useState<boolean>(initial.onboarded)
  const [pool, setPool] = useState<Title[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [screen, setScreen] = useState<Screen>('deck')
  const [filter, setFilter] = useState<Filter>('all')
  const [genre, setGenre] = useState<string | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [sort, setSort] = useState<string>('popular')
  const [service, setService] = useState<string | null>(null)
  const [actor, setActor] = useState<string | null>(null)
  const [actorInput, setActorInput] = useState('')
  const [detail, setDetail] = useState<Title | null>(null)
  const [ratingFor, setRatingFor] = useState<Title | null>(null)

  // Latest taste read inside load() via a ref, so learning doesn't trigger a
  // refetch on every swipe — it applies on the next deck (filter change / fresh
  // batch / reopen).
  const tasteRef = useRef(taste)
  useEffect(() => { tasteRef.current = taste }, [taste])

  const load = useCallback(() => {
    setStatus('loading')
    const ctrl = new AbortController()
    const v = tasteRef.current
    const mediaTypes: MediaType[] = filter === 'all' ? ['movie', 'tv'] : [filter]
    const tasteGenres = likes.filter(g => g !== 'New Releases')
    const withGenres = Array.from(new Set([...tasteGenres, ...topGenres(v)]))
    const withoutGenres = Array.from(new Set([...dislikes, ...bottomGenres(v)]))
    const effSort = sort === 'popular' && likes.includes('New Releases') ? 'new' : sort
    fetchDeck({
      mediaTypes,
      genre: genre ?? undefined,
      year: year ?? undefined,
      sort: effSort,
      service: service ?? undefined,
      actor: actor ?? undefined,
      withGenres: genre ? undefined : (withGenres.length ? withGenres : undefined),
      withoutGenres: withoutGenres.length ? withoutGenres : undefined,
    }, ctrl.signal)
      .then(d => { setPool(rankDeck(d, tasteRef.current)); setStatus('ready') })
      .catch((e: unknown) => { if ((e as Error)?.name !== 'AbortError') setStatus('error') })
    return () => ctrl.abort()
  }, [filter, genre, year, sort, service, actor, likes, dislikes])
  useEffect(() => load(), [load])

  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    saveState({ watchlist, watched, seen, likes, dislikes, taste, onboarded })
  }, [watchlist, watched, seen, likes, dislikes, taste, onboarded])

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
    const k = keyOf(t); markSeen(k)
    setWatchlist(w => (w.some(x => keyOf(x) === k) ? w : [...w, t]))
    setTaste(v => applySignal(v, t.genres, LIKE_DELTA)) // amplify these genres
  }
  const pass = (t: Title) => {
    markSeen(keyOf(t))
    setTaste(v => applySignal(v, t.genres, PASS_DELTA)) // gently suppress
  }

  const markWatched = (t: Title) => {
    const k = keyOf(t)
    markSeen(k)
    setWatchlist(w => w.filter(x => keyOf(x) !== k))
    setWatched(list => (list.some(x => keyOf(x) === k) ? list : [...list, { ...t, stars: 0 }]))
    setRatingFor(t)
  }
  const rate = (t: Title, stars: number) => {
    const k = keyOf(t)
    const prev = watched.find(x => keyOf(x) === k)?.stars ?? 0
    setWatched(list => list.map(x => (keyOf(x) === k ? { ...x, stars } : x)))
    const contr = (s: number) => (s ? starDelta(s) : 0) // unrated counts as neutral
    const d = contr(stars) - contr(prev)
    if (d) setTaste(v => applySignal(v, t.genres, d)) // stars push hardest
  }
  const removeWatched = (t: WatchedItem) => setWatched(list => list.filter(x => keyOf(x) !== keyOf(t)))

  const toggleSave = (t: Title) => {
    const k = keyOf(t)
    setWatchlist(w => (w.some(x => keyOf(x) === k) ? w.filter(x => keyOf(x) !== k) : [...w, t]))
    markSeen(k)
  }

  // Taste prefs — a tag is either liked, disliked, or neither.
  const toggleTaste = (tag: string, kind: 'like' | 'dislike') => {
    if (kind === 'like') {
      setLikes(l => (l.includes(tag) ? l.filter(x => x !== tag) : [...l, tag]))
      setDislikes(d => d.filter(x => x !== tag))
    } else {
      setDislikes(d => (d.includes(tag) ? d.filter(x => x !== tag) : [...d, tag]))
      setLikes(l => l.filter(x => x !== tag))
    }
  }
  const resetTaste = () => { setLikes([]); setDislikes([]) }

  const filtersActive = filter !== 'all' || genre !== null || year !== null || sort !== 'popular' || service !== null || actor !== null

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

      {/* Sort / genre / year / service / actor — one scrollable row */}
      {screen === 'deck' && (
        <div role="group" aria-label="Sort and filter" style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '4px 16px 8px', WebkitOverflowScrolling: 'touch' }}>
          <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} style={pillSelect(sort !== 'popular')}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Genre" value={genre ?? ''} onChange={e => setGenre(e.target.value || null)} style={pillSelect(!!genre)}>
            <option value="">All genres</option>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select aria-label="Year" value={year ?? ''} onChange={e => setYear(e.target.value ? Number(e.target.value) : null)} style={pillSelect(!!year)}>
            <option value="">Any year</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select aria-label="Streaming service" value={service ?? ''} onChange={e => setService(e.target.value || null)} style={pillSelect(!!service)}>
            <option value="">Any service</option>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <form onSubmit={e => { e.preventDefault(); setActor(actorInput.trim() || null) }} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 10, color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}><Icon name="search" size={15} /></span>
              <input value={actorInput} onChange={e => setActorInput(e.target.value)} enterKeyHint="search" placeholder="Actor…"
                style={{ width: 130, fontSize: 12.5, fontWeight: 600, padding: '7px 12px 7px 30px', borderRadius: 999, outline: 'none',
                  background: 'rgba(255,255,255,0.08)', color: '#fff', border: `1px solid ${actor ? '#22c55e' : 'rgba(255,255,255,0.16)'}` }} />
            </div>
            {actor && (
              <button type="button" onClick={() => { setActor(null); setActorInput('') }} aria-label="Clear actor search"
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '7px 10px', borderRadius: 999, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
                {actor} <Icon name="x" size={13} />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: screen === 'deck' ? 'hidden' : 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: screen === 'deck' ? 'center' : 'flex-start', padding: screen === 'deck' ? '6px 16px' : 0 }}>
        {screen === 'deck' ? (
          status === 'loading' ? (
            <Centered icon={<Icon name="film" size={40} />} title="Loading titles…" />
          ) : status === 'error' ? (
            <Centered icon={<Icon name="warning" size={40} />} title="Couldn't load the deck" sub="Check your connection and try again." action={{ label: 'Retry', onClick: load }} />
          ) : deck.length > 0 ? (
            <SwipeDeck deck={deck} onLike={like} onPass={pass} onWatched={markWatched} onOpenDetail={setDetail} />
          ) : (
            <Centered icon={<Icon name="film" size={40} />} title="That's the deck for now"
              sub={`${filtersActive ? 'Try different filters up top, or ' : ''}get a fresh batch.`}
              action={{ label: 'Fresh batch', onClick: () => { setSeen([]); load() } }} />
          )
        ) : screen === 'watchlist' ? (
          <Watchlist items={watchlist} onOpen={setDetail} onRemove={toggleSave} />
        ) : (
          <Watched items={watched} onRate={rate} onRemove={removeWatched} onOpen={setDetail}
            likes={likes} dislikes={dislikes} onTaste={toggleTaste} onResetTaste={resetTaste} />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(11,11,18,0.9)', backdropFilter: 'blur(10px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavBtn active={screen === 'deck'} onClick={() => setScreen('deck')} label="Discover" icon="discover" />
        <NavBtn active={screen === 'watchlist'} onClick={() => setScreen('watchlist')} label="Watchlist" icon="bookmark" badge={watchlist.length} />
        <NavBtn active={screen === 'watched'} onClick={() => setScreen('watched')} label="Watched" icon="eye" badge={watched.length} />
      </nav>

      {USING_SAMPLE && (
        <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, opacity: 0.4, pointerEvents: 'none' }}>
          sample deck · connect TMDB to go live
        </div>
      )}

      {detail && <Detail t={detail} saved={isSaved(detail)} onClose={() => setDetail(null)} onToggleSave={toggleSave} />}
      {ratingFor && <RatingSheet t={ratingFor} onRate={s => { rate(ratingFor, s); setRatingFor(null) }} onClose={() => setRatingFor(null)} />}
      {!onboarded && <Onboarding onDone={() => setOnboarded(true)} />}
    </div>
  )
}

function Centered({ icon, title, sub, action }: {
  icon: ReactNode; title: string; sub?: string; action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#9ca3af' }}>{icon}</div>
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

function NavBtn({ active, onClick, label, icon, badge }: { active: boolean; onClick: () => void; label: string; icon: 'discover' | 'bookmark' | 'eye'; badge?: number }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '9px 0 8px', cursor: 'pointer', background: 'transparent', border: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.45)' }}>
      <span style={{ position: 'relative', display: 'flex' }}>
        <Icon name={icon} size={21} fill={active && icon !== 'eye'} />
        {!!badge && <span aria-label={`${badge}`} style={{ position: 'absolute', top: -6, right: -11, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, lineHeight: '16px', textAlign: 'center', borderRadius: 999, background: '#22c55e', color: '#06210f' }}>{badge}</span>}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em' }}>{label}</span>
    </button>
  )
}
