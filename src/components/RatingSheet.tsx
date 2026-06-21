import { useEffect } from 'react'
import type { Title } from '../types'
import StarRating from './StarRating'

/** Shown right after a swipe-up. Rating is optional — closing leaves the title
 *  in Watched, unrated. ★5 = more like this, ★1 = less. */
export default function RatingSheet({ t, onRate, onClose }: {
  t: Title
  onRate: (stars: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); return }
      if (e.key.startsWith('Arrow')) e.stopImmediatePropagation()
      if (e.key >= '1' && e.key <= '5') { e.stopImmediatePropagation(); onRate(Number(e.key)) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onRate, onClose])

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Rate ${t.title}`}
        style={{ width: '100%', maxWidth: 360, borderRadius: 22, background: '#15151F', border: '1px solid rgba(255,255,255,0.1)', padding: '22px 22px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55 }}>Watched ✓</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>{t.title}</div>
        <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>How was it?</div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 10px' }}>
          <StarRating value={0} onChange={onRate} size={34} />
        </div>

        <div style={{ fontSize: 12, opacity: 0.55, lineHeight: 1.45 }}>
          <strong style={{ color: '#f6c244' }}>★5 = more like this</strong> · ★1 = less.<br />Private — just tunes your recommendations.
        </div>

        <button onClick={onClose}
          style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
