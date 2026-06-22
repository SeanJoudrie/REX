import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { Title } from '../types'
import MovieCard from './MovieCard'
import Icon from './Icon'

const THRESHOLD = 90        // px of travel that commits a swipe
const FLICK_VELOCITY = 0.5  // px/ms; a fast flick commits below THRESHOLD
const DURATION = 280        // ms; MUST stay in sync with the CSS transform transition

type Action = 'like' | 'pass' | 'watched'
const ACTION_COLOR: Record<Action, string> = { like: '#22c55e', pass: '#ef4444', watched: '#38bdf8' }

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Stamp({ label, color, pos, o, popKey }: { label: string; color: string; pos: CSSProperties; o: number; popKey?: number }) {
  return (
    <div style={{
      position: 'absolute', opacity: o, pointerEvents: 'none', ...pos,
      border: `3px solid ${color}`, color, borderRadius: 10,
      padding: '4px 12px', fontSize: 22, fontWeight: 900, letterSpacing: '0.06em',
    } as CSSProperties}>
      {/* The rotate lives on the parent; the pop scales this span so they don't
          fight over `transform`. Re-keyed by armTick to re-fire on each arming. */}
      <span key={popKey} style={{ display: 'inline-block', animation: popKey ? 'rexStampPop 120ms ease-out' : undefined }}>{label}</span>
    </div>
  )
}

function ActionButton({ onClick, label, icon, color }: { onClick: () => void; label: string; icon: ReactNode; color: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{
        width: 54, height: 54, borderRadius: 999, cursor: 'pointer',
        background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${color}`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        touchAction: 'manipulation',
      }}>{icon}</button>
  )
}

export default function SwipeDeck({
  deck, onLike, onPass, onWatched, onOpenDetail,
  threshold = THRESHOLD, flickVelocity = FLICK_VELOCITY,
}: {
  deck: Title[]
  onLike: (t: Title) => void
  onPass: (t: Title) => void
  onWatched: (t: Title) => void
  onOpenDetail: (t: Title) => void
  threshold?: number
  flickVelocity?: number
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
  const timer = useRef<number | null>(null)
  const activePointer = useRef<number | null>(null)

  // #4 commit-line detent: which action (if any) the current drag is past the
  // threshold for. Latched so the haptic + pop fire once per crossing.
  const [armed, setArmed] = useState<Action | null>(null)
  const armedRef = useRef<Action | null>(null)
  const [armTick, setArmTick] = useState(0)

  const top: Title | undefined = deck[0]

  const setOff = (x: number, y: number) => { dxRef.current = x; dyRef.current = y; setDx(x); setDy(y) }

  const setArm = (a: Action | null) => {
    if (armedRef.current === a) return
    armedRef.current = a
    setArmed(a)
    if (a !== null) { if (navigator.vibrate) navigator.vibrate(8); setArmTick(t => t + 1) }
  }

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])

  const commit = (action: Action) => {
    if (leaving.current || !top) return
    setArm(null)
    leaving.current = true
    const card = top
    if (navigator.vibrate) navigator.vibrate(action === 'watched' ? 12 : action === 'like' ? 16 : 7)

    const run = () => {
      ;(action === 'like' ? onLike : action === 'pass' ? onPass : onWatched)(card)
      // The flown card unmounts (stable keys), so dx/dy=0 now belongs to the
      // card promoting up from the depth slot — it transitions into place.
      setOff(0, 0)
      leaving.current = false
    }
    if (reducedMotion()) { run(); return }

    if (action === 'watched') setOff(0, -(window.innerHeight + 220))
    else setOff((action === 'like' ? 1 : -1) * (window.innerWidth + 220), 0)
    timer.current = window.setTimeout(() => { timer.current = null; run() }, DURATION)
  }

  // Keyboard control: ←/→ pass/like, ↑ watched, i for the detail sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!top || leaving.current) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); commit('pass') }
      else if (e.key === 'ArrowRight') { e.preventDefault(); commit('like') }
      else if (e.key === 'ArrowUp') { e.preventDefault(); commit('watched') }
      else if (e.key.toLowerCase() === 'i') { e.preventDefault(); onOpenDetail(top) }
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

    // #4: arm/disarm at the commit line (once per crossing via setArm's latch).
    let armNow: Action | null = null
    if (axis.current === 'h' && Math.abs(ax) > threshold) armNow = ax > 0 ? 'like' : 'pass'
    else if (axis.current === 'v' && ay < -threshold) armNow = 'watched'
    setArm(armNow)
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
      setArm(null)
      if (!moved.current) onOpenDetail(top)
      setOff(0, 0)
    }
  }

  const onPointerCancel = () => {
    dragging.current = false; axis.current = null; activePointer.current = null
    setArm(null); setOff(0, 0)
  }

  const clamp = (n: number) => Math.max(0, Math.min(1, n))

  const interactiveProps: HTMLAttributes<HTMLDivElement> = {
    role: 'group',
    'aria-roledescription': 'Swipe card',
    'aria-label': `${top.title}, ${top.year}, rated ${top.rating.toFixed(1)} of 10. Arrow keys: left pass, right save, up watched; i for details.`,
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, height: 'min(62vh, 540px)' }}>
        {/* One keyed stack: top card is interactive, the two behind sit at depth
            poses. Stable keys mean a card that was behind *transitions* up to the
            top when the deck shifts, instead of re-mounting in place. */}
        {deck.slice(0, 3).map((t, i) => {
          const isTop = i === 0
          return (
            <div
              key={`${t.mediaType}-${t.id}`}
              {...(isTop ? interactiveProps : { 'aria-hidden': true })}
              style={{
                position: 'absolute', inset: 0, zIndex: 5 - i,
                cursor: isTop ? 'grab' : undefined,
                touchAction: isTop ? 'none' : undefined,
                transform: isTop
                  ? `translate(${dx}px, ${dy}px) rotate(${dx * 0.04}deg)`
                  : `translateY(${i * 10}px) scale(${1 - i * 0.04})`,
                opacity: isTop ? 1 : 1 - i * 0.18,
                transition: isTop
                  ? (dragging.current ? 'none' : `transform ${DURATION}ms cubic-bezier(0.2,0.7,0.2,1)`)
                  : 'transform 200ms cubic-bezier(0.2,0.7,0.2,1), opacity 200ms',
              }}>
              <MovieCard t={t} dimmed={!isTop} />
              {isTop && (
                <>
                  {/* #4: the card edge "arms" to the action color past threshold,
                      and snaps back instantly (no transition) when you fall below. */}
                  <div aria-hidden style={{
                    position: 'absolute', inset: 0, borderRadius: 24, pointerEvents: 'none',
                    border: '2px solid transparent',
                    borderColor: armed ? ACTION_COLOR[armed] : 'transparent',
                    transition: armed ? 'border-color 90ms ease-out' : 'none',
                  }} />
                  <Stamp label="WATCH" color="#22c55e" pos={{ top: 26, left: 22, transform: 'rotate(-14deg)' }} o={clamp((dx - 40) / 80)} popKey={armed === 'like' ? armTick : undefined} />
                  <Stamp label="PASS" color="#ef4444" pos={{ top: 26, right: 22, transform: 'rotate(14deg)' }} o={clamp((-dx - 40) / 80)} popKey={armed === 'pass' ? armTick : undefined} />
                  <Stamp label="WATCHED" color="#38bdf8" pos={{ top: 26, left: '50%', transform: 'translateX(-50%) rotate(-6deg)' }} o={clamp((-dy - 30) / 70)} popKey={armed === 'watched' ? armTick : undefined} />
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Thumb arc — swipe is primary; up arrow = watched */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ActionButton onClick={() => commit('pass')} label="Pass" icon={<Icon name="x" size={22} />} color="#ef4444" />
        <ActionButton onClick={() => commit('watched')} label="Mark watched" icon={<Icon name="eye" size={22} />} color="#38bdf8" />
        <ActionButton onClick={() => onOpenDetail(top)} label="Details" icon={<Icon name="info" size={22} />} color="#9ca3af" />
        <ActionButton onClick={() => commit('like')} label="Add to watchlist" icon={<Icon name="check" size={22} />} color="#22c55e" />
      </div>
    </div>
  )
}
