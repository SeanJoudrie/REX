import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Title } from '../types'
import MovieCard from './MovieCard'

const THRESHOLD = 90        // px of horizontal travel that commits a swipe
const FLICK_VELOCITY = 0.5  // px/ms; a fast flick commits below THRESHOLD
const DURATION = 280        // ms; MUST stay in sync with the CSS transform transition

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
        touchAction: 'manipulation', // kill the 300ms tap delay / double-tap zoom on the thumb arc
      }}>{glyph}</button>
  )
}

export default function SwipeDeck({
  deck, onLike, onPass, onOpenDetail,
  threshold = THRESHOLD, flickVelocity = FLICK_VELOCITY,
}: {
  deck: Title[]
  onLike: (t: Title) => void
  onPass: (t: Title) => void
  onOpenDetail: (t: Title) => void
  /** Configurable swipe sensitivity. Lower threshold / lower flickVelocity = hair-trigger. */
  threshold?: number
  flickVelocity?: number
}) {
  const [dx, setDx] = useState(0)
  const dxRef = useRef(0)          // authoritative dx for handlers (no render-timing reliance)
  const startX = useRef(0)
  const startY = useRef(0)
  const lastX = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)
  const axis = useRef<null | 'h' | 'v'>(null)
  const dragging = useRef(false)
  const moved = useRef(false)
  const leaving = useRef(false)
  const snapping = useRef(false)   // suppress transition so the incoming card doesn't fly in
  const timer = useRef<number | null>(null)
  const activePointer = useRef<number | null>(null)

  const top: Title | undefined = deck[0]

  const setDxBoth = (v: number) => { dxRef.current = v; setDx(v) }

  // Clear the pending fly-off timer on unmount — no setState/onLike on a dead tree.
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])

  const finish = (card: Title, dir: 1 | -1) => {
    ;(dir > 0 ? onLike : onPass)(card)
    snapping.current = true        // center the next card instantly, then re-enable animation
    setDxBoth(0)
    requestAnimationFrame(() => { snapping.current = false })
    leaving.current = false
  }

  const decide = (dir: 1 | -1) => {
    if (leaving.current || !top) return
    leaving.current = true
    if (navigator.vibrate) navigator.vibrate(dir > 0 ? 16 : 7)

    if (reducedMotion()) { finish(top, dir); return }

    const card = top
    setDxBoth(dir * (window.innerWidth + 220))
    timer.current = window.setTimeout(() => { timer.current = null; finish(card, dir) }, DURATION)
  }

  // Keyboard control, cleaned up on unmount (no leaked global listener).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!top || leaving.current) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); decide(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); decide(1) }
      else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'i') { e.preventDefault(); onOpenDetail(top) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top])

  if (!top) return null

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (leaving.current || !e.isPrimary) return
    dragging.current = true; moved.current = false; axis.current = null
    activePointer.current = e.pointerId
    startX.current = e.clientX; startY.current = e.clientY
    lastX.current = e.clientX; lastT.current = e.timeStamp; velocity.current = 0
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || e.pointerId !== activePointer.current) return
    const ax = e.clientX - startX.current, ay = e.clientY - startY.current
    if (axis.current === null) {
      if (Math.abs(ax) < 8 && Math.abs(ay) < 8) return
      axis.current = Math.abs(ax) > Math.abs(ay) ? 'h' : 'v'
      if (axis.current === 'v') { try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ } }
    }
    if (axis.current === 'v') { dragging.current = false; setDxBoth(0); return }
    const dt = e.timeStamp - lastT.current
    if (dt > 0) velocity.current = (e.clientX - lastX.current) / dt // px/ms
    lastX.current = e.clientX; lastT.current = e.timeStamp
    moved.current = true
    setDxBoth(ax)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== null && e.pointerId !== activePointer.current) return
    if (!dragging.current) { axis.current = null; return }
    dragging.current = false
    const horizontal = axis.current === 'h'
    const d = dxRef.current, v = velocity.current
    axis.current = null; activePointer.current = null
    if (horizontal && (Math.abs(d) > threshold || Math.abs(v) > flickVelocity)) {
      decide((Math.abs(d) > threshold ? d : v) > 0 ? 1 : -1)
    } else {
      if (!moved.current) onOpenDetail(top)
      setDxBoth(0)
    }
  }

  const onPointerCancel = () => {
    dragging.current = false; axis.current = null; activePointer.current = null; setDxBoth(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, height: 'min(64vh, 560px)' }}>
        {/* depth cards (next titles peeking) */}
        {deck.slice(1, 3).map((t, i) => {
          const off = i + 1
          return (
            <div key={`${t.mediaType}-${t.id}`} aria-hidden style={{
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
          role="group"
          aria-roledescription="Swipe card"
          aria-label={`${top.title}, ${top.year}, rated ${top.rating.toFixed(1)} of 10. Use left and right arrow keys to pass or save, up arrow for details.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{
            position: 'absolute', inset: 0, zIndex: 5, cursor: 'grab', touchAction: 'pan-y',
            transform: `translateX(${dx}px) rotate(${dx * 0.04}deg)`,
            transition: dragging.current || snapping.current ? 'none' : `transform ${DURATION}ms cubic-bezier(0.2,0.7,0.2,1)`,
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
