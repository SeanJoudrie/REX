import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Title } from '../types'
import Icon from './Icon'

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Deep-link the watch handoff: tapping a provider jumps to the title. Real
// per-provider deep links come from the JustWatch data on the TMDB detail
// response; until that's wired we hand off to a JustWatch title search, which
// still collapses "I want this" to one tap.
function watchUrl(t: Title): string {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(t.title)}`
}

const tagColor = (type: string) =>
  type === 'person' ? 'rgba(56,189,248,0.5)' : type === 'company' ? 'rgba(246,194,68,0.5)' : type === 'keyword' ? 'rgba(255,255,255,0.18)' : 'rgba(34,197,94,0.5)'

export default function Detail({ t, saved, reason, onClose, onToggleSave, onPivot }: {
  t: Title
  saved: boolean
  reason?: string | null
  onClose: () => void
  onToggleSave: (t: Title) => void
  onPivot: (tag: { type: string; id: number; name: string }) => void
}) {
  const reduced = reducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = `rex-detail-title-${t.mediaType}-${t.id}`
  const chips = (t.tags && t.tags.length ? t.tags : t.genres.map(g => ({ type: 'genre' as const, id: 0, name: g }))).slice(0, 12)

  const [entered, setEntered] = useState(reduced) // reduced: appear immediately
  const [exiting, setExiting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dragY, setDragY] = useState(0)

  const shareUrl = `${location.origin}${location.pathname}#/t/${t.mediaType}/${t.id}`
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: t.title, text: `${t.title} — on REX`, url: shareUrl })
      else { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
    } catch { /* user dismissed the share sheet */ }
  }
  const dragStart = useRef<number | null>(null)

  // Animated close. We pop our own history entry (below); the resulting popstate
  // is the single close path, which keeps Back-button and in-app close identical
  // and is safe under StrictMode's double-invoked effects.
  const close = useCallback(() => {
    if (reduced) { window.history.back(); return }
    setExiting(true)
    window.setTimeout(() => window.history.back(), 200)
  }, [reduced])

  // Slide-up enter.
  useEffect(() => {
    if (reduced) return
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [reduced])

  // Focus into the sheet on open; restore to the opener on close.
  useEffect(() => {
    restoreRef.current = (document.activeElement as HTMLElement) ?? null
    sheetRef.current?.focus()
    return () => restoreRef.current?.focus?.()
  }, [])

  // Lock background scroll.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Escape closes, Tab is trapped, and Arrow keys are swallowed in the capture
  // phase so the deck's window-level hotkeys can't fire behind the sheet.
  useEffect(() => {
    const focusables = () =>
      sheetRef.current
        ? Array.from(sheetRef.current.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'))
        : []
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); return }
      if (e.key.startsWith('Arrow')) { e.stopImmediatePropagation(); return } // default scroll preserved
      if (e.key === 'Tab') {
        const f = focusables()
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close])

  // Give the system Back gesture something to pop instead of exiting the app.
  // Every close (button, Escape, backdrop, drag) routes through history.back(),
  // so popstate is the one and only place that calls onClose.
  useEffect(() => {
    window.history.pushState({ rexDetail: true }, '', `#/t/${t.mediaType}/${t.id}`)
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose, t.mediaType, t.id])

  // Drag-down-to-dismiss, scoped to the grab handle so it never fights scroll.
  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientY
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return
    const dy = e.clientY - dragStart.current
    if (dy > 0) setDragY(dy)
  }
  const onHandleUp = () => {
    if (dragStart.current === null) return
    const dy = dragY
    dragStart.current = null
    if (dy > 120) close()
    else setDragY(0)
  }

  const dragging = dragStart.current !== null
  const ty = exiting ? '100%' : entered ? `${dragY}px` : '100%'
  const sheetTransition = dragging ? 'none' : 'transform 0.26s cubic-bezier(0.2,0.7,0.2,1)'
  const backdropOpacity = exiting || !entered ? 0 : Math.max(0, 1 - dragY / 400)

  return (
    <div onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        opacity: backdropOpacity, transition: reduced ? undefined : 'opacity 0.26s',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '88dvh', overflowY: 'auto', outline: 'none',
          borderRadius: '24px 24px 0 0', background: '#15151F', border: '1px solid rgba(255,255,255,0.1)',
          transform: `translateY(${ty})`, transition: sheetTransition, willChange: 'transform' }}>

        {/* Grab handle — the drag-to-dismiss surface */}
        <div onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}
          aria-hidden style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'grab', touchAction: 'none' }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.25)' }} />
        </div>

        {/* Gradient is the base layer, so a missing/broken poster falls back to
            the title's color signature instead of a black void. */}
        <div style={{ height: 150, position: 'relative', background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
          {t.poster && <img src={t.poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
          <button onClick={share} aria-label="Share"
            style={{ position: 'absolute', top: 12, right: 56, width: 36, height: 36, borderRadius: 999, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' } as CSSProperties}>
            <Icon name="share" size={17} />
          </button>
          <button onClick={close} aria-label="Close"
            style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 999, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' } as CSSProperties}>
            <Icon name="x" size={17} />
          </button>
          {copied && <div style={{ position: 'absolute', top: 54, right: 12, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.92)', color: '#06210f' }}>Link copied</div>}
        </div>

        <div style={{ padding: '18px 20px 28px' }}>
          <div id={titleId} style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t.title}</div>
          <div style={{ marginTop: 5, fontSize: 13, opacity: 0.7 }}>{t.year} · {t.mediaType === 'tv' ? 'TV Series' : 'Film'} · ★ {t.rating.toFixed(1)} · {t.genres.join(', ')}</div>
          {reason && (
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }}>
              <Icon name="discover" size={13} /> {reason}
            </div>
          )}
          <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.6, opacity: 0.9 }}>{t.overview}</p>

          {/* Tappable taste tags — each pivots the deck to that entity */}
          {chips.length > 0 && (
            <>
              <div style={{ marginTop: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>More like this</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chips.map(c => (
                  <button key={`${c.type}:${c.id}:${c.name}`} onClick={() => onPivot({ type: c.type, id: c.id, name: c.name })}
                    style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.08)', color: '#fff', border: `1px solid ${tagColor(c.type)}` }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>Where to watch</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {t.providers.map(p => (
              <a key={p} href={watchUrl(t)} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, fontWeight: 700, padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', textDecoration: 'none' }}>
                ▶ {p}
              </a>
            ))}
          </div>

          <button onClick={() => onToggleSave(t)}
            style={{ marginTop: 22, width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer',
              background: saved ? 'rgba(239,68,68,0.14)' : '#22c55e', color: saved ? '#fca5a5' : '#06210f',
              border: saved ? '1px solid rgba(239,68,68,0.4)' : 'none' }}>
            {saved ? 'Remove from watchlist' : '✓ Add to watchlist'}
          </button>
        </div>
      </div>
    </div>
  )
}
