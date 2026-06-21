import { useMemo } from 'react'
import type { WatchedItem } from '../types'
import StarRating from './StarRating'
import Poster from './Poster'

export default function Watched({ items, onRate, onRemove, onOpen }: {
  items: WatchedItem[]
  onRate: (t: WatchedItem, stars: number) => void
  onRemove: (t: WatchedItem) => void
  onOpen: (t: WatchedItem) => void
}) {
  // Highest-rated first; unrated (0) sink to the bottom.
  const shown = useMemo(
    () => [...items].sort((a, b) => (b.stars || 0) - (a.stars || 0)),
    [items],
  )

  if (!items.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', opacity: 0.7 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👀</div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Nothing watched yet</div>
        <div style={{ marginTop: 6, fontSize: 13.5, opacity: 0.7 }}>Swipe a card up to mark it watched, then rate it.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 16px 24px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '8px 2px 4px' }}>
        Watched <span style={{ opacity: 0.5, fontSize: 16 }}>{items.length}</span>
      </div>
      <div style={{ fontSize: 12.5, opacity: 0.6, margin: '0 2px 14px', lineHeight: 1.4 }}>
        Rate to tune your deck — <strong style={{ color: '#f6c244' }}>★5 = more like this</strong>, ★1 = less. Private, just for your recs.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {shown.map(t => (
          <div key={`${t.mediaType}-${t.id}`} style={{ position: 'relative' }}>
            <button onClick={() => onOpen(t)} aria-label={`Open ${t.title}`}
              style={{ width: '100%', textAlign: 'left', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: '#15151F', padding: 0 }}>
              <div style={{ height: 150, position: 'relative', background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                <Poster src={t.poster} />
              </div>
              <div style={{ padding: '10px 11px 6px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                <div style={{ marginTop: 3, fontSize: 11, opacity: 0.6 }}>{t.year}</div>
              </div>
            </button>
            <div style={{ padding: '4px 11px 12px', display: 'flex', justifyContent: 'center' }}>
              <StarRating value={t.stars} onChange={n => onRate(t, n)} size={20} />
            </div>
            <button onClick={() => { if (navigator.vibrate) navigator.vibrate(8); onRemove(t) }}
              aria-label={`Remove ${t.title} from watched`}
              style={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 999, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1,
                background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
                backdropFilter: 'blur(4px)', touchAction: 'manipulation' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
