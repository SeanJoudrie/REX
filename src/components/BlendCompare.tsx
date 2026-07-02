import { useEffect } from 'react'
import type { TasteVec } from '../lib/taste'
import { tasteCompat } from '../lib/taste'
import type { TastePayload } from '../lib/tasteShare'
import Icon from './Icon'

/** "You two" — the destination behind the blend banner: the compatibility
 *  number, what you share, where you split, and each person's top genres side
 *  by side. All on-device; the friend's side comes from their taste code. */
export default function BlendCompare({ myTaste, friend, onClose }: {
  myTaste: TasteVec
  friend: TastePayload
  onClose: () => void
}) {
  const c = tasteCompat(myTaste, friend.taste)
  const who = friend.name || 'Your friend'
  const top = (v: TasteVec) =>
    Object.entries(v).filter(([, e]) => e.w > 0).sort((a, b) => b[1].w - a[1].w).slice(0, 5)
  const mine = top(myTaste), theirs = top(friend.taste)
  const maxW = Math.max(mine[0]?.[1].w ?? 1, theirs[0]?.[1].w ?? 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Taste comparison with ${who}`}
        style={{ width: '100%', maxWidth: 480, maxHeight: '88dvh', overflowY: 'auto', borderRadius: '24px 24px 0 0', background: '#15151F', border: '1px solid rgba(255,255,255,0.1)', padding: '18px 20px calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>You + {who}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={17} /></button>
        </div>

        <div style={{ textAlign: 'center', margin: '14px 0 4px' }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#7dd3fc', letterSpacing: '-0.02em' }}>
            {c.score != null ? `${c.score}%` : '· · ·'}
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 2 }}>
            {c.score != null ? 'taste match' : 'still learning you two — swipe more, both of you'}
          </div>
        </div>

        {c.shared.length > 0 && (
          <>
            <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em' }}>You both love</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {c.shared.map(g => (
                <span key={g} style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 13px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac' }}>{g}</span>
              ))}
            </div>
          </>
        )}
        {c.friction.length > 0 && (
          <>
            <div style={{ marginTop: 14, fontSize: 11.5, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Where you split</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {c.friction.map(g => (
                <span key={g} style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 13px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>{g}</span>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.55 }}>The blended deck keeps these out.</div>
          </>
        )}

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Column label="You" rows={mine} color="34,197,94" maxW={maxW} />
          <Column label={who} rows={theirs} color="56,189,248" maxW={maxW} />
        </div>
      </div>
    </div>
  )
}

function Column({ label, rows, color, maxW }: { label: string; rows: [string, { w: number }][]; color: string; maxW: number }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      {rows.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>No strong genres yet</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(([g, e]) => (
          <div key={g} style={{ position: 'relative', overflow: 'hidden', fontSize: 12.5, fontWeight: 700, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(8, (e.w / maxW) * 100)}%`, background: `rgba(${color},0.18)` }} />
            <span style={{ position: 'relative' }}>{g}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
