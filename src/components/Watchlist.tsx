import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Title } from '../types'
import Poster from './Poster'
import Icon from './Icon'

type Sort = 'added' | 'rating' | 'title'
type View = 'list' | 'grid'

export default function Watchlist({ items, onOpen, onRemove }: {
  items: Title[]
  onOpen: (t: Title) => void
  onRemove?: (t: Title) => void
}) {
  const [provider, setProvider] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('added')
  const [view, setView] = useState<View>('list') // compact list by default — see them all

  const providers = useMemo(() => [...new Set(items.flatMap(t => t.providers))].sort(), [items])

  useEffect(() => {
    if (provider && !providers.includes(provider)) setProvider(null)
  }, [provider, providers])

  const shown = useMemo(() => {
    const base = provider ? items.filter(t => t.providers.includes(provider)) : items
    if (sort === 'added') return base
    const copy = [...base]
    if (sort === 'rating') copy.sort((a, b) => b.rating - a.rating)
    else copy.sort((a, b) => a.title.localeCompare(b.title))
    return copy
  }, [items, provider, sort])

  if (!items.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', opacity: 0.7 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#9ca3af' }}><Icon name="bookmark" size={38} /></div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Your watchlist is empty</div>
        <div style={{ marginTop: 6, fontSize: 13.5, opacity: 0.7 }}>Swipe right on anything you want to watch and it lands here.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 16px 24px', maxWidth: 520, width: '100%', minWidth: 0, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '8px 2px 12px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Watchlist <span style={{ opacity: 0.5, fontSize: 16 }}>{items.length}</span>
        </div>
        <div role="group" aria-label="View" style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.06)', padding: 3, borderRadius: 999 }}>
          {(['list', 'grid'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v}
              style={{ width: 32, height: 28, borderRadius: 999, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: view === v ? '#fff' : 'transparent', color: view === v ? '#0B0B12' : '#fff' }}>
              <Icon name={v === 'list' ? 'list' : 'grid'} size={15} />
            </button>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <div role="group" aria-label="Sort" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['added', 'rating', 'title'] as Sort[]).map(s => (
            <button key={s} onClick={() => setSort(s)} aria-pressed={sort === s}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.16)', whiteSpace: 'nowrap',
                background: sort === s ? '#fff' : 'rgba(255,255,255,0.08)', color: sort === s ? '#0B0B12' : '#fff' }}>
              {s === 'added' ? 'Added' : s === 'rating' ? 'Rating' : 'A–Z'}
            </button>
          ))}
        </div>
      )}

      {providers.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          <Chip active={provider === null} onClick={() => setProvider(null)}>All</Chip>
          {providers.map(p => <Chip key={p} active={provider === p} onClick={() => setProvider(p)}>{p}</Chip>)}
        </div>
      )}

      {view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(t => (
            <div key={`${t.mediaType}-${t.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 11, background: '#15151F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 8 }}>
              <button onClick={() => onOpen(t)} aria-label={`Open ${t.title}`}
                style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                <div style={{ width: 42, height: 60, flexShrink: 0, position: 'relative', borderRadius: 7, overflow: 'hidden', background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                  <Poster src={t.poster} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>{t.title}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.year} · {t.mediaType === 'tv' ? 'TV' : 'Film'} · ★ {t.rating.toFixed(1)} · {t.inTheaters ? 'In Theaters' : (t.providers[0] ?? '—')}
                  </div>
                </div>
              </button>
              {onRemove && (
                <button onClick={() => { if (navigator.vibrate) navigator.vibrate(8); onRemove(t) }} aria-label={`Remove ${t.title} from watchlist`}
                  style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', touchAction: 'manipulation' }}>
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {shown.map(t => (
            <div key={`${t.mediaType}-${t.id}`} style={{ position: 'relative' }}>
              <button onClick={() => onOpen(t)} aria-label={`Open ${t.title}`}
                style={{ width: '100%', textAlign: 'left', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: '#15151F', padding: 0 }}>
                <div style={{ height: 150, position: 'relative', background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                  <Poster src={t.poster} />
                  <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, background: 'rgba(0,0,0,0.5)' }}>★ {t.rating.toFixed(1)}</span>
                </div>
                <div style={{ padding: '10px 11px 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ marginTop: 3, fontSize: 11, opacity: 0.6 }}>{t.year} · {t.providers[0] ?? '—'}</div>
                </div>
              </button>
              {onRemove && (
                <button onClick={() => { if (navigator.vibrate) navigator.vibrate(8); onRemove(t) }} aria-label={`Remove ${t.title} from watchlist`}
                  style={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)', touchAction: 'manipulation' }}>
                  <Icon name="x" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
        background: active ? '#fff' : 'rgba(255,255,255,0.08)', color: active ? '#0B0B12' : '#fff',
        border: '1px solid rgba(255,255,255,0.16)' }}>{children}</button>
  )
}
