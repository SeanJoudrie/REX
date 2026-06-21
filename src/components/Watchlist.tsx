import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Title } from '../types'

type Sort = 'added' | 'rating' | 'title'

export default function Watchlist({ items, onOpen, onRemove }: {
  items: Title[]
  onOpen: (t: Title) => void
  onRemove?: (t: Title) => void
}) {
  const [provider, setProvider] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('added')

  const providers = useMemo(
    () => [...new Set(items.flatMap(t => t.providers))].sort(),
    [items],
  )

  // Clamp a stale provider filter (e.g. after removing the last title on a
  // service) so the grid never gets stuck empty with no active chip.
  useEffect(() => {
    if (provider && !providers.includes(provider)) setProvider(null)
  }, [provider, providers])

  const shown = useMemo(() => {
    const base = provider ? items.filter(t => t.providers.includes(provider)) : items
    if (sort === 'added') return base // insertion order = order saved
    const copy = [...base]
    if (sort === 'rating') copy.sort((a, b) => b.rating - a.rating)
    else copy.sort((a, b) => a.title.localeCompare(b.title))
    return copy
  }, [items, provider, sort])

  if (!items.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', opacity: 0.7 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Your watchlist is empty</div>
        <div style={{ marginTop: 6, fontSize: 13.5, opacity: 0.7 }}>Swipe right on anything you want to watch and it lands here.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 16px 24px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '8px 2px 14px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Watchlist <span style={{ opacity: 0.5, fontSize: 16 }}>{items.length}</span>
        </div>
        {items.length > 1 && (
          <div role="group" aria-label="Sort" style={{ display: 'flex', gap: 6 }}>
            {(['added', 'rating', 'title'] as Sort[]).map(s => (
              <button key={s} onClick={() => setSort(s)} aria-pressed={sort === s}
                style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.16)', whiteSpace: 'nowrap',
                  background: sort === s ? '#fff' : 'rgba(255,255,255,0.08)', color: sort === s ? '#0B0B12' : '#fff' }}>
                {s === 'added' ? 'Added' : s === 'rating' ? '★ Rating' : 'A–Z'}
              </button>
            ))}
          </div>
        )}
      </div>

      {providers.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          <Chip active={provider === null} onClick={() => setProvider(null)}>All</Chip>
          {providers.map(p => <Chip key={p} active={provider === p} onClick={() => setProvider(p)}>{p}</Chip>)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {shown.map(t => (
          <div key={`${t.mediaType}-${t.id}`} style={{ position: 'relative' }}>
            <button onClick={() => onOpen(t)} aria-label={`Open ${t.title}`}
              style={{ width: '100%', textAlign: 'left', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: '#15151F', padding: 0 }}>
              <div style={{ height: 150, position: 'relative', background: t.poster ? '#111' : `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                {t.poster && (
                  <img src={t.poster} alt="" draggable={false}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, background: 'rgba(0,0,0,0.5)' }}>★ {t.rating.toFixed(1)}</span>
              </div>
              <div style={{ padding: '10px 11px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                <div style={{ marginTop: 3, fontSize: 11, opacity: 0.6 }}>{t.year} · {t.providers[0] ?? '—'}</div>
              </div>
            </button>
            {onRemove && (
              <button onClick={() => { if (navigator.vibrate) navigator.vibrate(8); onRemove(t) }}
                aria-label={`Remove ${t.title} from watchlist`}
                style={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 999, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1,
                  background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
                  backdropFilter: 'blur(4px)', touchAction: 'manipulation' }}>✕</button>
            )}
          </div>
        ))}
      </div>
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
