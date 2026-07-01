import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { MediaType, Tag, Title, WatchedItem } from './types'
import { fetchDeck, fetchTitleById, USING_SAMPLE } from './tmdb'
import type { DeckQuery } from './tmdb'
import { loadState, saveState } from './lib/storage'
import SwipeDeck from './components/SwipeDeck'
import Watchlist from './components/Watchlist'
import Watched from './components/Watched'
import Mirror from './components/Mirror'
import MatchMode from './components/MatchMode'
import Detail from './components/Detail'
import RatingSheet from './components/RatingSheet'
import Onboarding from './components/Onboarding'
import Settings from './components/Settings'
import Icon from './components/Icon'
import Rex from './components/Rex'
import { track } from './lib/metrics'
import type { TastePayload } from './lib/tasteShare'
import type { TasteVec, EntityAff } from './lib/taste'
import { applySignal, applyEntities, bottomGenres, rankDeck, topGenres, topEntityTags, tasteCompat, decayTaste, decayAff, mergeTaste, ENTITY_DELTAS, entityStarDelta, LIKE_DELTA, PASS_DELTA, starDelta } from './lib/taste'

type Screen = 'deck' | 'watchlist' | 'watched' | 'mirror'
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
  // Force a dark popup so the native option list isn't white-on-white.
  colorScheme: 'dark',
})

// The native dropdown popup ignores the pill's translucent background; give each
// option an explicit dark surface so the list is always legible.
const OPT: CSSProperties = { background: '#15151F', color: '#fff' }

export default function App() {
  const initial = useMemo(() => {
    const s = loadState()
    const days = s.tasteDecayedAt ? (Date.now() - s.tasteDecayedAt) / 86_400_000 : 0
    if (days > 0.5) { s.taste = decayTaste(s.taste, days); s.affinity = decayAff(s.affinity, days) }
    s.tasteDecayedAt = Date.now()
    return s
  }, [])
  const [watchlist, setWatchlist] = useState<Title[]>(initial.watchlist)
  const [watched, setWatched] = useState<WatchedItem[]>(initial.watched)
  const [seen, setSeen] = useState<string[]>(initial.seen)
  const [likes, setLikes] = useState<string[]>(initial.likes)
  const [dislikes, setDislikes] = useState<string[]>(initial.dislikes)
  const [affinity, setAffinity] = useState<EntityAff>(initial.affinity)
  // Auto-pagination: the pool grows page-by-page as the deck drains, so the
  // candidate set is hundreds deep, not one page. pageRef tracks the last page
  // appended; loadingMore guards against concurrent appends; atEnd latches when
  // a page yields nothing new.
  const pageRef = useRef(1)
  const fetchSeq = useRef(0) // appends since load — every 3rd is an exploration page
  const loadingMore = useRef(false)
  const poolRef = useRef<Title[]>([])
  const [atEnd, setAtEnd] = useState(false)
  // Tags for titles whose detail was opened (informed signals + why-this).
  const enrichedTags = useRef<Map<string, Tag[]>>(new Map())
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
  const [pivot, setPivot] = useState<{ type: string; id?: number; name?: string; label: string } | null>(null)
  const [ratingFor, setRatingFor] = useState<Title | null>(null)
  // tags/ebase capture the entity-affinity write of an informed swipe so undo
  // can reverse the WHOLE learning step, not just the genre delta.
  const [undo, setUndo] = useState<{ card: Title; action: 'like' | 'pass' | 'watched'; delta: number; tags?: Tag[]; ebase?: number } | null>(null)
  const undoTimer = useRef<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [matchOpen, setMatchOpen] = useState(false)
  // Title queued to open after Match closes — lets us pop Match's own history
  // entry (via Back) instead of orphaning it, then open the detail cleanly.
  const pendingMatchOpen = useRef<Title | null>(null)
  const pendingBlend = useRef<TastePayload | null>(null)
  // Blend mode: a friend's imported taste, merged into the deck ranking.
  const [blend, setBlend] = useState<TastePayload | null>(null)
  const blendRef = useRef<TastePayload | null>(null)
  useEffect(() => { blendRef.current = blend }, [blend])
  // "You're done" exit moment.
  const sessionSaves = useRef(0)
  const [doneNudge, setDoneNudge] = useState<Title | null>(null)
  const doneTimer = useRef<number | null>(null)
  // Logo-tap easter egg → Rexasaurus Rex roars.
  const logoTaps = useRef(0)
  const logoTimer = useRef<number | null>(null)
  const [rexEgg, setRexEgg] = useState(false)

  // Latest taste read inside load() via a ref, so learning doesn't trigger a
  // refetch on every swipe — it applies on the next deck (filter change / fresh
  // batch / reopen).
  const tasteRef = useRef(taste)
  useEffect(() => { tasteRef.current = taste }, [taste])
  const affinityRef = useRef(affinity)
  useEffect(() => { affinityRef.current = affinity }, [affinity])

  // Ranking vector: my taste, or a consensus blend with a friend's in blend mode.
  const rankVec = () => {
    const b = blendRef.current
    return b ? mergeTaste(tasteRef.current, b.taste) : tasteRef.current
  }

  // Build the discover query for a given page off the current filters + taste.
  const buildQuery = useCallback((p: number): DeckQuery => {
    const v = tasteRef.current
    const mediaTypes: MediaType[] = filter === 'all' ? ['movie', 'tv'] : [filter]
    const tasteGenres = likes.filter(g => g !== 'New Releases')
    const blendLikes = blend ? [...blend.likes.filter(g => g !== 'New Releases'), ...topGenres(blend.taste)] : []
    const blendDislikes = blend ? [...blend.dislikes, ...bottomGenres(blend.taste)] : []
    const withGenres = Array.from(new Set([...tasteGenres, ...topGenres(v), ...blendLikes]))
    const withoutGenres = Array.from(new Set([...dislikes, ...bottomGenres(v), ...blendDislikes]))
    const effSort = sort === 'popular' && likes.includes('New Releases') ? 'new' : sort
    return {
      mediaTypes,
      genre: genre ?? undefined,
      year: year ?? undefined,
      sort: effSort,
      service: service ?? undefined,
      actor: actor ?? undefined,
      pivot: pivot ? { type: pivot.type, id: pivot.id, name: pivot.name } : undefined,
      withGenres: genre ? undefined : (withGenres.length ? withGenres : undefined),
      withoutGenres: withoutGenres.length ? withoutGenres : undefined,
      page: p,
    }
  }, [filter, genre, year, sort, service, actor, likes, dislikes, pivot, blend])

  // Fresh load (filters/taste changed): reset paging and replace the pool.
  const load = useCallback(() => {
    setStatus('loading')
    setAtEnd(false)
    pageRef.current = 1
    fetchSeq.current = 0
    const ctrl = new AbortController()
    fetchDeck(buildQuery(1), ctrl.signal)
      .then(d => { setPool(rankDeck(d, rankVec(), affinityRef.current)); setStatus('ready') })
      .catch((e: unknown) => { if ((e as Error)?.name !== 'AbortError') setStatus('error') })
    return () => ctrl.abort()
  }, [buildQuery])
  useEffect(() => load(), [load])

  // Append the next page, deduped against what's already pooled. A page with no
  // new titles latches atEnd so we stop hitting the proxy. Every 3rd append on
  // the default deck is an EXPLORATION page seeded from a top learned entity
  // (a "Denzel page", an "A24 page") so the pool follows the user's actual
  // taste instead of only TMDB popularity order.
  const loadMore = useCallback(() => {
    if (loadingMore.current || atEnd) return
    loadingMore.current = true
    fetchSeq.current += 1
    const next = pageRef.current + 1
    const vanilla = !pivot && !actor && !service && !genre && !year && sort === 'popular' && !blendRef.current
    const seeds = vanilla && fetchSeq.current % 3 === 0 ? topEntityTags(affinityRef.current) : []
    const seed = seeds.length ? seeds[Math.floor(Math.random() * Math.min(seeds.length, 5))] : null

    const append = (q: DeckQuery, isExplore: boolean): Promise<void> =>
      fetchDeck(q).then(d => {
        const have = new Set(poolRef.current.map(keyOf))
        const fresh = d.filter(t => !have.has(keyOf(t)))
        if (!fresh.length) {
          // A dry exploration page falls back to the regular cursor; only a dry
          // REGULAR page means the deck is truly exhausted.
          if (isExplore) return append(buildQuery(next), false)
          setAtEnd(true)
          return
        }
        if (!isExplore) pageRef.current = next
        setPool(prev => [...prev, ...rankDeck(fresh, rankVec(), affinityRef.current)])
      })

    const q: DeckQuery = seed
      ? { ...buildQuery(1), pivot: { type: seed.type, id: seed.id, name: seed.name }, page: 1 + Math.floor(Math.random() * 2) }
      : buildQuery(next)
    append(q, !!seed)
      .catch(() => { /* keep the current pool; the manual Fresh batch can retry */ })
      .finally(() => { loadingMore.current = false })
  }, [buildQuery, atEnd, pivot, actor, service, genre, year, sort])

  // Cold-open a shared deep link (#/t/:type/:id): strip the hash, fetch the
  // title, open its detail sheet.
  useEffect(() => {
    const m = location.hash.match(/^#\/t\/(movie|tv)\/(\d+)/)
    if (!m) return
    history.replaceState(null, '', location.pathname + location.search)
    fetchTitleById(m[1] as MediaType, Number(m[2])).then(t => { if (t) setDetail(t) })
  }, [])

  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    saveState({ watchlist, watched, seen, likes, dislikes, taste, affinity, tasteDecayedAt: initial.tasteDecayedAt, onboarded })
  }, [watchlist, watched, seen, likes, dislikes, taste, affinity, onboarded, initial.tasteDecayedAt])

  // Keep poolRef current so loadMore can dedup synchronously.
  useEffect(() => { poolRef.current = pool }, [pool])

  // Milestone haptic every 10th save.
  const prevWlLen = useRef(watchlist.length)
  useEffect(() => {
    if (watchlist.length > prevWlLen.current && watchlist.length % 10 === 0 && navigator.vibrate) navigator.vibrate([12, 30, 12, 30, 20])
    prevWlLen.current = watchlist.length
  }, [watchlist.length])

  const excluded = useMemo(() => {
    const s = new Set(seen)
    for (const w of watchlist) s.add(keyOf(w))
    for (const w of watched) s.add(keyOf(w))
    return s
  }, [seen, watchlist, watched])

  const deck = useMemo(() => pool.filter(t => !excluded.has(keyOf(t))), [pool, excluded])

  // Auto-paginate: when the visible deck runs low, pull the next page in the
  // background so the user never feels the wall (unless we've truly run out).
  // We also watch pool.length so a page that's entirely already-seen (deck.length
  // unchanged) still re-triggers the next page instead of stalling.
  useEffect(() => {
    if (screen === 'deck' && status === 'ready' && !atEnd && deck.length < 6) loadMore()
  }, [deck.length, pool.length, screen, status, atEnd, loadMore])

  const savedKeys = useMemo(() => new Set(watchlist.map(keyOf)), [watchlist])
  const isSaved = (t: Title) => savedKeys.has(keyOf(t))

  const markSeen = (k: string) => setSeen(s => (s.includes(k) ? s : [...s, k]))

  const showUndo = (card: Title, action: 'like' | 'pass' | 'watched', delta: number, tags?: Tag[], ebase?: number) => {
    setUndo({ card, action, delta, tags, ebase })
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 4500)
  }

  // The anti-doomscroll moment: once the user has a good-enough pick, offer a
  // calm "you've got something for tonight" off-ramp (first save, then sparingly)
  // instead of an endless deck.
  const maybeDoneNudge = (t: Title) => {
    sessionSaves.current += 1
    if (blend || (sessionSaves.current !== 1 && sessionSaves.current % 5 !== 0)) return
    setDoneNudge(t)
    if (doneTimer.current) window.clearTimeout(doneTimer.current)
    doneTimer.current = window.setTimeout(() => setDoneNudge(null), 7000)
  }

  const like = (t: Title) => {
    const k = keyOf(t); markSeen(k)
    setWatchlist(w => (w.some(x => keyOf(x) === k) ? w : [...w, t]))
    const tags = enrichedTags.current.get(k)
    const gd = LIKE_DELTA * (tags ? 1.25 : 1) // informed > impulse
    setTaste(v => applySignal(v, t.genres, gd))
    if (tags) setAffinity(a => applyEntities(a, tags, ENTITY_DELTAS.likeInformed))
    track('like'); track('save')
    showUndo(t, 'like', gd, tags, tags ? ENTITY_DELTAS.likeInformed : undefined)
    maybeDoneNudge(t)
  }
  const pass = (t: Title) => {
    const k = keyOf(t); markSeen(k)
    const tags = enrichedTags.current.get(k)
    const gd = PASS_DELTA * (tags ? 2 : 1) // informed pass = genuine "not for me"
    setTaste(v => applySignal(v, t.genres, gd))
    if (tags) setAffinity(a => applyEntities(a, tags, ENTITY_DELTAS.passInformed))
    track('pass')
    showUndo(t, 'pass', gd, tags, tags ? ENTITY_DELTAS.passInformed : undefined)
  }

  const markWatched = (t: Title) => {
    const k = keyOf(t)
    markSeen(k)
    setWatchlist(w => w.filter(x => keyOf(x) !== k))
    setWatched(list => (list.some(x => keyOf(x) === k) ? list : [...list, { ...t, stars: 0 }]))
    setRatingFor(t)
    track('watched')
    showUndo(t, 'watched', 0)
  }

  // Reverse the last swipe: undo the list change, the seen key, the taste delta,
  // the entity-affinity delta, and re-top the card so it returns to the deck.
  const doUndo = () => {
    if (!undo) return
    const { card, action, delta, tags, ebase } = undo
    const k = keyOf(card)
    setSeen(s => s.filter(x => x !== k))
    if (action === 'like') setWatchlist(w => w.filter(x => keyOf(x) !== k))
    if (action === 'watched') { setWatched(list => list.filter(x => keyOf(x) !== k)); setRatingFor(r => (r && keyOf(r) === k ? null : r)) }
    if (delta) setTaste(v => applySignal(v, card.genres, -delta, -1))
    if (tags && ebase) setAffinity(a => applyEntities(a, tags, -ebase, -1))
    setPool(p => [card, ...p.filter(x => keyOf(x) !== k)])
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo(null)
  }
  const rate = (t: Title, stars: number) => {
    const k = keyOf(t)
    const prev = watched.find(x => keyOf(x) === k)?.stars ?? 0
    setWatched(list => list.map(x => (keyOf(x) === k ? { ...x, stars } : x)))
    const contr = (s: number) => (s ? starDelta(s) : 0) // unrated counts as neutral
    const d = contr(stars) - contr(prev)
    track('rate')
    if (d) setTaste(v => applySignal(v, t.genres, d, prev ? 0 : 1)) // stars push hardest; a re-rate adjusts, it isn't a new sample
    // Entity affinity from the rating (the heaviest signal) — use cached tags or
    // fetch them once.
    const eb = entityStarDelta(stars) - entityStarDelta(prev)
    if (eb) {
      const k2 = keyOf(t)
      const tags = enrichedTags.current.get(k2)
      if (tags) setAffinity(a => applyEntities(a, tags, eb))
      else if (!USING_SAMPLE) fetchTitleById(t.mediaType, t.id).then(full => {
        if (full?.tags) { enrichedTags.current.set(k2, full.tags); setAffinity(a => applyEntities(a, full.tags!, eb)) }
      }).catch(() => {})
    }
  }
  const removeWatched = (t: WatchedItem) => setWatched(list => list.filter(x => keyOf(x) !== keyOf(t)))

  const toggleSave = (t: Title) => {
    const k = keyOf(t)
    setWatchlist(w => {
      const had = w.some(x => keyOf(x) === k)
      if (!had) track('save')
      return had ? w.filter(x => keyOf(x) !== k) : [...w, t]
    })
    markSeen(k)
  }

  // Open detail immediately, then hydrate tags/poster from the proxy.
  const openDetail = (t: Title) => {
    track('open')
    setDetail(t)
    if (USING_SAMPLE) return
    fetchTitleById(t.mediaType, t.id).then(full => {
      if (!full) return
      if (full.tags) enrichedTags.current.set(keyOf(t), full.tags) // informed signal + why-this
      setDetail(d => (d && keyOf(d) === keyOf(t) ? { ...d, tags: full.tags ?? d.tags, poster: d.poster ?? full.poster, overview: d.overview || full.overview } : d))
    }).catch(() => {})
  }

  // Tap any tag → a single-entity deck (Denzel deck, A24 deck, …).
  const deckFromTag = (tag: { type: string; id: number; name: string }) => {
    setDetail(null)
    setScreen('deck')
    track('pivot')
    setPivot({ type: tag.type, id: tag.id, name: tag.name, label: tag.name })
  }

  // Logo-tap easter egg: 5 quick taps → Rexasaurus Rex roars.
  const tapLogo = () => {
    logoTaps.current += 1
    if (logoTimer.current) window.clearTimeout(logoTimer.current)
    logoTimer.current = window.setTimeout(() => { logoTaps.current = 0 }, 1200)
    if (logoTaps.current >= 5) {
      logoTaps.current = 0
      setRexEgg(true)
      if (navigator.vibrate) navigator.vibrate([10, 40, 10, 40, 20])
      window.setTimeout(() => setRexEgg(false), 2600)
    }
  }

  // "Why this?" — the overlap of the title with the user's learned taste.
  const whyThis = (t: Title): string | null => {
    const parts: string[] = []
    for (const g of t.genres) if ((taste[g]?.w ?? 0) > 0.15 && parts.length < 2) parts.push(g)
    for (const tag of t.tags ?? []) {
      if (tag.type === 'genre' || parts.length >= 2) continue
      const a = affinity[`${tag.type}:${tag.id}`]
      if (a && a.w > 0.18) parts.push(tag.name)
    }
    return parts.length ? `Because you like ${parts.slice(0, 2).join(' + ')}` : null
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

  // "Why you two matched" — headline number + shared loves for the blend banner.
  const blendCompat = useMemo(() => (blend ? tasteCompat(taste, blend.taste) : null), [blend, taste])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 640, margin: '0 auto' }}>
      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(14px, env(safe-area-inset-top)) 18px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={tapLogo} aria-label="REX"
            style={{ fontWeight: 900, fontSize: 22, letterSpacing: '0.14em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            R<span style={{ color: '#22c55e' }}>E</span>X
          </button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Settings"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 999, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
            <Icon name="gear" size={18} />
          </button>
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
            {SORTS.map(([v, l]) => <option key={v} value={v} style={OPT}>{l}</option>)}
          </select>
          <select aria-label="Genre" value={genre ?? ''} onChange={e => setGenre(e.target.value || null)} style={pillSelect(!!genre)}>
            <option value="" style={OPT}>All genres</option>
            {GENRES.map(g => <option key={g} value={g} style={OPT}>{g}</option>)}
          </select>
          <select aria-label="Year" value={year ?? ''} onChange={e => setYear(e.target.value ? Number(e.target.value) : null)} style={pillSelect(!!year)}>
            <option value="" style={OPT}>Any year</option>
            {YEARS.map(y => <option key={y} value={y} style={OPT}>{y}</option>)}
          </select>
          <select aria-label="Streaming service" value={service ?? ''} onChange={e => setService(e.target.value || null)} style={pillSelect(!!service)}>
            <option value="" style={OPT}>Any service</option>
            {SERVICES.map(s => <option key={s} value={s} style={OPT}>{s}</option>)}
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

      {/* Blend-mode banner — "what do WE watch" deck */}
      {screen === 'deck' && blend && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 16px 6px', padding: '8px 12px', borderRadius: 12, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Icon name="users" size={15} /> Blending with <span style={{ color: '#7dd3fc' }}>{blend.name || 'a friend'}</span>
            {blendCompat?.score != null && <span style={{ opacity: 0.75 }}>· {blendCompat.score}% match</span>}
          </span>
          <button onClick={() => setBlend(null)} aria-label="Clear blend"
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}>
            Clear <Icon name="x" size={13} />
          </button>
        </div>
      )}

      {/* Active entity-pivot banner */}
      {screen === 'deck' && pivot && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 16px 6px', padding: '8px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Deck: <span style={{ color: '#86efac' }}>{pivot.label}</span>
          </span>
          <button onClick={() => setPivot(null)} aria-label="Clear pivot deck"
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}>
            Clear <Icon name="x" size={13} />
          </button>
        </div>
      )}

      {/* Cold-start nudge: REX is still learning. */}
      {screen === 'deck' && status === 'ready' && !pivot && seen.length < 10 && (
        <div style={{ margin: '0 16px 6px', padding: '7px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12.5, fontWeight: 600, opacity: 0.85, textAlign: 'center' }}>
          Swipe {10 - seen.length} more to sharpen your recommendations
        </div>
      )}

      {/* Main */}
      <main key={screen} className="rex-fade" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: screen === 'deck' ? 'hidden' : 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: screen === 'deck' ? 'center' : 'flex-start', padding: screen === 'deck' ? '6px 16px' : 0 }}>
        {screen === 'deck' ? (
          status === 'loading' ? (
            <Centered icon={<Rex mood="idle" size={92} />} title="Rex is sniffing out picks…" />
          ) : status === 'error' ? (
            <Centered icon={<Icon name="warning" size={40} />} title="Couldn't load the deck" sub="Check your connection and try again." action={{ label: 'Retry', onClick: load }} />
          ) : deck.length > 0 ? (
            <SwipeDeck deck={deck} onLike={like} onPass={pass} onWatched={markWatched} onOpenDetail={openDetail} />
          ) : (
            <Centered icon={<Rex mood="shrug" size={92} />}
              title={atEnd ? "Rex is all out of fresh meat" : "That's the deck for now"}
              sub={atEnd
                ? `${filtersActive ? 'Try different filters up top to find more.' : 'Adjust your taste or check back later for new titles.'}`
                : `${filtersActive ? 'Try different filters up top, or ' : ''}get a fresh batch.`}
              action={atEnd ? undefined : { label: 'Fresh batch', onClick: loadMore }} />
          )
        ) : screen === 'watchlist' ? (
          <Watchlist items={watchlist} onOpen={openDetail} onRemove={toggleSave} />
        ) : screen === 'watched' ? (
          <Watched items={watched} onRate={rate} onRemove={removeWatched} onOpen={openDetail}
            likes={likes} dislikes={dislikes} onTaste={toggleTaste} onResetTaste={resetTaste} />
        ) : (
          <Mirror taste={taste} affinity={affinity} watched={watched} watchlist={watchlist} seenCount={seen.length}
            likes={likes} dislikes={dislikes}
            onPivot={deckFromTag} onStartMatch={() => setMatchOpen(true)} onGoSwipe={() => setScreen('deck')} />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(11,11,18,0.9)', backdropFilter: 'blur(10px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavBtn active={screen === 'deck'} onClick={() => setScreen('deck')} label="Discover" icon="discover" />
        <NavBtn active={screen === 'watchlist'} onClick={() => setScreen('watchlist')} label="Watchlist" icon="bookmark" badge={watchlist.length} />
        <NavBtn active={screen === 'watched'} onClick={() => setScreen('watched')} label="Watched" icon="eye" badge={watched.length} />
        <NavBtn active={screen === 'mirror'} onClick={() => setScreen('mirror')} label="Mirror" icon="sparkle" />
      </nav>

      {/* Stacks above the "you're done" nudge when both are up — the first save
          of a session must stay undoable. */}
      {screen === 'deck' && undo && (
        <button onClick={doUndo} aria-label={`Undo ${undo.action === 'like' ? 'save' : undo.action === 'watched' ? 'watched' : 'pass'}`}
          style={{ position: 'fixed', bottom: doneNudge ? 168 : 84, left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
            background: 'rgba(22,22,32,0.96)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', fontSize: 13.5, fontWeight: 700, boxShadow: '0 8px 24px -8px rgba(0,0,0,0.7)' }}>
          <Icon name="undo" size={16} /> Undo {undo.action === 'like' ? 'save' : undo.action === 'watched' ? 'watched' : 'pass'}
        </button>
      )}

      {/* "You're done" exit moment — REX's promise is pick-and-go, not endless swiping. */}
      {screen === 'deck' && doneNudge && (
        <div className="rex-fade" role="status"
          style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 41, width: 'min(420px, calc(100% - 32px))',
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16,
            background: 'rgba(22,22,32,0.98)', border: '1px solid rgba(34,197,94,0.4)', boxShadow: '0 12px 32px -10px rgba(0,0,0,0.8)' }}>
          <Rex mood="happy" size={44} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>You've got something for tonight</div>
            <div style={{ fontSize: 12, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doneNudge.title} is on your watchlist.</div>
          </div>
          <button onClick={() => { const t = doneNudge; setDoneNudge(null); if (t) openDetail(t) }}
            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 800, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
            Watch it
          </button>
          <button onClick={() => setDoneNudge(null)} aria-label="Keep swiping"
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)' }}>
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {/* Easter egg */}
      {rexEgg && (
        <div className="rex-fade" onClick={() => setRexEgg(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'rgba(11,11,18,0.82)', backdropFilter: 'blur(3px)' }}>
          <Rex mood="roar" size={180} />
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.04em' }}>RAWR. You found me.</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>— Rexasaurus Rex 🦖</div>
        </div>
      )}

      {USING_SAMPLE && (
        <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, opacity: 0.4, pointerEvents: 'none' }}>
          sample deck · connect TMDB to go live
        </div>
      )}

      {detail && <Detail t={detail} saved={isSaved(detail)} reason={whyThis(detail)} onClose={() => setDetail(null)} onToggleSave={toggleSave} onPivot={deckFromTag} />}
      {ratingFor && <RatingSheet t={ratingFor} onRate={s => { rate(ratingFor, s); setRatingFor(null) }} onClose={() => setRatingFor(null)} />}
      {!onboarded && <Onboarding onDone={picks => {
        // Cold-start seed: picked genres become taste-prefs AND a warm vector
        // (w=0.45, n=3 — enough for topGenres to bias the very first fetch),
        // so a new user's deck is personal from swipe one.
        if (picks.length) {
          setLikes(l => Array.from(new Set([...l, ...picks])))
          setTaste(v => picks.reduce((acc, g) => applySignal(applySignal(applySignal(acc, [g], 0.15), [g], 0.15), [g], 0.15), v))
        }
        setOnboarded(true)
      }} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {matchOpen && <MatchMode deck={deck} myTaste={taste}
        onClose={() => {
          setMatchOpen(false)
          const t = pendingMatchOpen.current; pendingMatchOpen.current = null
          const b = pendingBlend.current; pendingBlend.current = null
          if (t) setTimeout(() => openDetail(t), 0)
          if (b) { setBlend(b); setScreen('deck'); setPivot(null); if (navigator.vibrate) navigator.vibrate(16) }
        }}
        onOpenTitle={t => { pendingMatchOpen.current = t; window.history.back() }}
        onBlend={p => { pendingBlend.current = p; window.history.back() }} />}
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

function NavBtn({ active, onClick, label, icon, badge }: { active: boolean; onClick: () => void; label: string; icon: 'discover' | 'bookmark' | 'eye' | 'sparkle'; badge?: number }) {
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
