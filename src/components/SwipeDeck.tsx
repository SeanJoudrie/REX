import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Title } from '../types'
import MovieCard from './MovieCard'

const THRESH = 90

function Stamp({ label, color, side, o }: { label: string; color: string; side: 'left' | 'right'; o: number }) {
  return (
    <div style={{
      position: 'absolute', top: 26, [side]: 22, opacity: o, pointerEvents: 'none',
      transform: `rotate(${side === 'left' ? -14 : 14}deg)`,
      border: `3px solid ${color}`, color, borderRadius: 10,
      padding: '4px 12px', fontSize: 22, fontWeight: 900, letterSpacing: '0.06em',
    } as CSSProperties}>{label}</div>
  )
}

function ActionButton({ onClick, label, glyph, color }: { onClick: () => void; label: string; glyph: string; color: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{
        width: 58, height: 58, borderRadius: 999, fontSize: 24, cursor: 'pointer',
        background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${color}`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{glyph}</button>
  )
}

export default function SwipeDeck({ deck, onLike, onPass, onOpenDetail }: {
  deck: Title[]
  onLike: (t: Title) => void
  onPass: (t: Title) => void
  onOpenDetail: (t: Title) => void
}) {
  const [dx, setDx] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<null | 'h' | 'v'>(null)
  const dragging = useRef(false)
  const moved = useRef(false)
  const leaving = useRef(false)

  const top = deck[0]

  const decide = (dir: 1 | -1) => {
    if (leaving.current || !top) return
    leaving.current = true
    setDx(dir * (window.innerWidth + 220))
    if (navigator.vibrate) navigator.vibrate(dir > 0 ? 16 : 7)
    window.setTimeout(() => {
      ;(dir > 0 ? onLike : onPass)(top)
      setDx(0)
      leaving.current = false
    }, 230)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, height: 'min(64vh, 560px)' }}>
        {/* depth cards (next titles peeking) */}
        {deck.slice(1, 3).map((t, i) => {
          const off = i + 1
          return (
            <div key={t.id} aria-hidden style={{
              position: 'absolute', inset: 0,
              transform: `translateY(${off * 10}px) scale(${1 - off * 0.04})`,
              opacity: 1 - off * 0.18, transition: 'transform 0.25s, opacity 0.25s', zIndex: 3 - off,
            }}>
              <MovieCard t={t} dimmed />
            </div>
          )
        })}

        {/* live top card */}
        <div
          onPointerDown={e => { dragging.current = true; moved.current = false; axis.current = null; startX.current = e.clientX; startY.current = e.clientY; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ } }}
          onPointerMove={e => {
            if (!dragging.current) return
            const ax = e.clientX - startX.current, ay = e.clientY - startY.current
            if (axis.current === null) {
              if (Math.abs(ax) < 8 && Math.abs(ay) < 8) return
              axis.current = Math.abs(ax) > Math.abs(ay) ? 'h' : 'v'
              if (axis.current === 'v') { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ } }
            }
            if (axis.current === 'v') { dragging.current = false; setDx(0); return }
            moved.current = true
            setDx(ax)
          }}
          onPointerUp={() => {
            if (!dragging.current) { axis.current = null; return }
            dragging.current = false
            const horizontal = axis.current === 'h'
            axis.current = null
            if (horizontal && Math.abs(dx) > THRESH) decide(dx > 0 ? 1 : -1)
            else { if (!moved.current) onOpenDetail(top); setDx(0) }
          }}
          onPointerCancel={() => { dragging.current = false; axis.current = null; setDx(0) }}
          style={{
            position: 'absolute', inset: 0, zIndex: 5, cursor: 'grab', touchAction: 'pan-y',
            transform: `translateX(${dx}px) rotate(${dx * 0.04}deg)`,
            transition: dragging.current ? 'none' : 'transform 0.28s cubic-bezier(0.2,0.7,0.2,1)',
          }}>
          <MovieCard t={top} />
          <Stamp label="WATCH" color="#22c55e" side="left" o={Math.max(0, Math.min(1, (dx - 40) / 80))} />
          <Stamp label="PASS" color="#ef4444" side="right" o={Math.max(0, Math.min(1, (-dx - 40) / 80))} />
        </div>
      </div>

      {/* Optional controls — bottom thumb arc, secondary to the swipe itself */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <ActionButton onClick={() => decide(-1)} label="Pass" glyph="✕" color="#ef4444" />
        <ActionButton onClick={() => onOpenDetail(top)} label="Details" glyph="ℹ" color="#9ca3af" />
        <ActionButton onClick={() => decide(1)} label="Add to watchlist" glyph="✓" color="#22c55e" />
      </div>
    </div>
  )
}
