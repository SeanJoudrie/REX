import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { Title } from '../types'
import MovieCard from './MovieCard'
import Icon from './Icon'

const THRESHOLD = 90        // px of travel that commits a swipe
const FLICK_VELOCITY = 0.5  // px/ms; a fast flick commits below THRESHOLD
const DURATION = 280        // ms; MUST stay in sync with the CSS transform transition

type Action = 'like' | 'pass' | 'watched'

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Stamp({ label, color, pos, o }: { label: string; color: string; pos: CSSProperties; o: number }) {
  return (
    <div style={{
      position: 'absolute', opacity: o, pointerEvents: 'none', ...pos,
      border: `3px solid ${color}`, color, borderRadius: 10,
      padding: '4px 12px', fontSize: 22, fontWeight: 900, letterSpacing: '0.06em',
    } as CSSProperties}>{label}</div>
  )
}

function ActionButton({ onClick, label, icon, color }: { onClick: () => void; label: string; icon: ReactNode; color: string }) {
  // Transparent 72px tap target around a 52px visual circle — high-velocity
  // thumbs miss small precise targets, so the hit-slop exceeds the visible ring.
  return (
    <button onClick={onClick} aria-label={label}
      style={{ width: 72, height: 72, borderRadius: 999, cursor: 'pointer', background: 'none', border: 'none', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', color }}>
      <span style={{ width: 52, height: 52, borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
    </button>
  )
}

export default function SwipeDeck({
  deck, onLike, onPass, onWatched, onOpenDetail,
  threshold = THRESHOLD, flickVelocity = FLICK_VELOCITY, showDetails = true,
}: {
  deck: Title[]
  onLike: (t: Title) => void
  onPass: (t: Title) => void
  onWatched: (t: Title) => void
  onOpenDetail: (t: Title) => void
  threshold?: number
  flickVelocity?: number
  showDetails?: boolean
}) {
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const dxRef = useRef(0)
  const dyRef = useRef(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const vx = useRef(0)
  const vy = useRef(0)
  const axis = useRef<null | 'h' | 'v'>(null)
  const dragging = useRef(false)
  const moved = useRef(false)
  const leaving = useRef(false)
  const snapping = useRef(false)
  const timer = useRef<number | null>(null)
  const activePointer = useRef<number | null>(null)

  const top: Title | undefined = deck[0]

  const setOff = (x: number, y: number) => { dxRef.current = x; dyRef.current = y; setDx(x); setDy(y) }

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])

  const commit = (action: Action) => {
    if (leaving.current || !top) return
    leaving.current = true
    const card = top
    // Haptic grammar: a distinct feel per verb (second, non-visual channel).
    if (navigator.vibrate) navigator.vibrate(action === 'watched' ? [10, 40, 10] : action === 'like' ? 16 : 7)

    const run = () => {
      ;(action === 'like' ? onLike : action === 'pass' ? onPass : onWatched)(card)
      snapping.current = true
      setOff(0, 0)
      requestAnimationFrame(() => { snapping.current = false })
      leaving.current = false
    }
    if (reducedMotion()) { run(); return }

    if (action === 'watched') setOff(0, -(window.innerHeight + 220))
    else setOff((action === 'like' ? 1 : -1) * (window.innerWidth + 220), 0)
    timer.current = window.setTimeout(() => { timer.current = null; run() }, DURATION)
  }

  // Keyboard control: ←/→ pass/like, ↑ watched, i/details for the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!top || leaving.current) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); commit('pass') }
      else if (e.key === 'ArrowRight') { e.preventDefault(); commit('like') }
      else if (e.key === 'ArrowUp') { e.preventDefault(); commit('watched') }
      else if (showDetails && e.key.toLowerCase() === 'i') { e.preventDefault(); onOpenDetail(top) }
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
    lastX.current = e.clientX; lastY.current = e.clientY; lastT.current = e.timeStamp
    vx.current = 0; vy.current = 0
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || e.pointerId !== activePointer.current) return
    const ax = e.clientX - startX.current, ay = e.clientY - startY.current
    if (axis.current === null) {
      if (Math.abs(ax) < 8 && Math.abs(ay) < 8) return
      axis.current = Math.abs(ax) > Math.abs(ay) ? 'h' : 'v'
    }
    const dt = e.timeStamp - lastT.current
    if (dt > 0) { vx.current = (e.clientX - lastX.current) / dt; vy.current = (e.clientY - lastY.current) / dt }
    lastX.current = e.clientX; lastY.current = e.clientY; lastT.current = e.timeStamp
    moved.current = true
    if (axis.current === 'h') setOff(ax, 0)
    else setOff(0, Math.min(ay, 40)) // allow upward freely; resist downward drag
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== null && e.pointerId !== activePointer.current) return
    if (!dragging.current) { axis.current = null; return }
    dragging.current = false
    const ax = axis.current
    const x = dxRef.current, y = dyRef.current
    axis.current = null; activePointer.current = null
    if (ax === 'h' && (Math.abs(x) > threshold || Math.abs(vx.current) > flickVelocity)) {
      commit((Math.abs(x) > threshold ? x : vx.current) > 0 ? 'like' : 'pass')
    } else if (ax === 'v' && (y < -threshold || vy.current < -flickVelocity)) {
      commit('watched')
    } else {
      if (!moved.current) onOpenDetail(top)
      setOff(0, 0)
    }
  }

  const onPointerCancel = () => {
    dragging.current = false; axis.current = null; activePointer.current = null; setOff(0, 0)
  }

  const clamp = (n: number) => Math.max(0, Math.min(1, n))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, height: 'min(62vh, 540px)' }}>
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

        <div
          role="group"
          aria-roledescription="Swipe card"
          aria-label={`${top.title}, ${top.year}, rated ${top.rating.toFixed(1)} of 10. Arrow keys: left pass, right save, up watched; i for details.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{
            position: 'absolute', inset: 0, zIndex: 5, cursor: 'grab', touchAction: 'none',
            transform: `translate(${dx}px, ${dy}px) rotate(${dx * 0.04}deg)`,
            transition: dragging.current || snapping.current ? 'none' : `transform ${DURATION}ms cubic-bezier(0.2,0.7,0.2,1)`,
          }}>
          <MovieCard t={top} />
          <Stamp label="WATCH" color="#22c55e" pos={{ top: 26, left: 22, transform: 'rotate(-14deg)' }} o={clamp((dx - 40) / 80)} />
          <Stamp label="PASS" color="#ef4444" pos={{ top: 26, right: 22, transform: 'rotate(14deg)' }} o={clamp((-dx - 40) / 80)} />
          <Stamp label="WATCHED" color="#38bdf8" pos={{ top: 26, left: '50%', transform: 'translateX(-50%) rotate(-6deg)' }} o={clamp((-dy - 30) / 70)} />
        </div>
      </div>

      {/* Thumb arc — swipe is primary; up arrow = watched */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ActionButton onClick={() => commit('pass')} label="Pass" icon={<Icon name="x" size={22} />} color="#ef4444" />
        <ActionButton onClick={() => commit('watched')} label="Mark watched" icon={<Icon name="eye" size={22} />} color="#38bdf8" />
        {showDetails && <ActionButton onClick={() => onOpenDetail(top)} label="Details" icon={<Icon name="info" size={22} />} color="#9ca3af" />}
        <ActionButton onClick={() => commit('like')} label="Add to watchlist" icon={<Icon name="check" size={22} />} color="#22c55e" />
      </div>
    </div>
  )
}
