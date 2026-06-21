import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { WatchedItem } from '../types'
import StarRating from './StarRating'
import Poster from './Poster'
import Icon from './Icon'

export const TASTE_TAGS = ['New Releases', 'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Animation', 'Documentary', 'Family']

function TasteChip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
        background: active ? color : 'rgba(255,255,255,0.08)', color: active ? '#0B0B12' : '#fff',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.16)'}`, whiteSpace: 'nowrap' } as CSSProperties}>
      {children}
    </button>
  )
}

function TastePanel({ likes, dislikes, onTaste, onReset }: {
  likes: string[]; dislikes: string[]
  onTaste: (tag: string, kind: 'like' | 'dislike') => void
  onReset: () => void
}) {
  const row: CSSProperties = { display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 6 }
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 14px 12px', margin: '6px 0 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800 }}>
          <Icon name="sliders" size={18} /> Your taste
        </div>
        {(likes.length > 0 || dislikes.length > 0) && (
          <button onClick={onReset} style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Reset</button>
        )}
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.4, marginBottom: 12 }}>
        Remember — you have a say in the algorithm here. Tap to add or remove anytime.
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>More of this</div>
      <div style={row}>
        {TASTE_TAGS.map(t => <TasteChip key={t} active={likes.includes(t)} color="#22c55e" onClick={() => onTaste(t, 'like')}>{t}</TasteChip>)}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 7px' }}>Less of this</div>
      <div style={row}>
        {TASTE_TAGS.filter(t => t !== 'New Releases').map(t => <TasteChip key={t} active={dislikes.includes(t)} color="#ef4444" onClick={() => onTaste(t, 'dislike')}>{t}</TasteChip>)}
      </div>
    </div>
  )
}

export default function Watched({ items, onRate, onRemove, onOpen, likes, dislikes, onTaste, onResetTaste }: {
  items: WatchedItem[]
  onRate: (t: WatchedItem, stars: number) => void
  onRemove: (t: WatchedItem) => void
  onOpen: (t: WatchedItem) => void
  likes: string[]
  dislikes: string[]
  onTaste: (tag: string, kind: 'like' | 'dislike') => void
  onResetTaste: () => void
}) {
  const shown = useMemo(() => [...items].sort((a, b) => (b.stars || 0) - (a.stars || 0)), [items])

  return (
    <div style={{ padding: '4px 16px 24px', maxWidth: 520, width: '100%', minWidth: 0, margin: '0 auto' }}>
      <TastePanel likes={likes} dislikes={dislikes} onTaste={onTaste} onReset={onResetTaste} />

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 2px 4px' }}>
        Watched <span style={{ opacity: 0.5, fontSize: 16 }}>{items.length}</span>
      </div>
      <div style={{ fontSize: 12.5, opacity: 0.6, margin: '0 2px 14px', lineHeight: 1.4 }}>
        Rate to tune your deck — <strong style={{ color: '#f6c244' }}>5 stars = more like this</strong>, 1 star = less. Private, just for your recs.
      </div>

      {!items.length ? (
        <div style={{ textAlign: 'center', padding: '32px 24px', opacity: 0.7 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: '#9ca3af' }}><Icon name="eye" size={36} /></div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Nothing watched yet</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>Swipe a card up to mark it watched, then rate it.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(t => (
            <div key={`${t.mediaType}-${t.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', alignItems: 'center', gap: 8, background: '#15151F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 8 }}>
              <button onClick={() => onOpen(t)} aria-label={`Open ${t.title}`}
                style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                <div style={{ width: 38, height: 54, flexShrink: 0, position: 'relative', borderRadius: 6, overflow: 'hidden', background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                  <Poster src={t.poster} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>{t.title}</div>
                  <div style={{ marginTop: 2, fontSize: 11, opacity: 0.55 }}>{t.year} · {t.mediaType === 'tv' ? 'TV' : 'Film'}</div>
                </div>
              </button>
              <StarRating value={t.stars} onChange={n => onRate(t, n)} size={15} />
              <button onClick={() => { if (navigator.vibrate) navigator.vibrate(8); onRemove(t) }} aria-label={`Remove ${t.title} from watched`}
                style={{ width: 26, height: 26, borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 'none', touchAction: 'manipulation' }}>
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
