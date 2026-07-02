import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Title, WatchedItem } from '../types'
import type { TasteVec, EntityAff } from '../lib/taste'
import type { MatchRecord } from '../lib/storage'
import { encodeTaste } from '../lib/tasteShare'
import Poster from './Poster'
import Icon from './Icon'

const MIN_SEEN = 12 // below this the portrait is too thin to be flattering

type Entity = { id: number; label: string; w: number; n: number }
type Vibe = { name: string; w: number }
type PivotTag = { type: string; id: number; name: string }

const titleKey = (t: Title) => `${t.mediaType}-${t.id}`

export default function Mirror({ taste, affinity, watched, watchlist, seenCount, likes, dislikes, matchHistory, onPivot, onStartMatch, onGoSwipe, onTune, onOpenTitle }: {
  taste: TasteVec
  affinity: EntityAff
  watched: WatchedItem[]
  watchlist: Title[]
  seenCount: number
  likes: string[]
  dislikes: string[]
  matchHistory: MatchRecord[]
  onPivot: (tag: PivotTag) => void
  onStartMatch: () => void
  onGoSwipe: () => void
  onTune: (tag: PivotTag, action: 'more' | 'less' | 'mute') => void
  onOpenTitle: (t: Title) => void
}) {
  const [copied, setCopied] = useState(false)
  // Long-pressed chip → tune sheet (more / less / mute).
  const [tune, setTune] = useState<PivotTag | null>(null)
  const library = useMemo(() => [...watched, ...watchlist], [watched, watchlist])

  const entitiesByType = useMemo(() => {
    const out: Record<string, Entity[]> = { person: [], company: [], keyword: [] }
    for (const [k, v] of Object.entries(affinity)) {
      if (v.w <= 0 || !(v.type in out)) continue
      out[v.type].push({ id: Number(k.split(':')[1]), label: v.label, w: v.w, n: v.n })
    }
    for (const t of Object.keys(out)) out[t].sort((a, b) => b.w - a.w)
    return out
  }, [affinity])

  const vibes: Vibe[] = useMemo(() =>
    Object.entries(taste).filter(([, v]) => v.w > 0).sort((a, b) => b[1].w - a[1].w).map(([name, v]) => ({ name, w: v.w })),
    [taste])

  const bedrock = useMemo(() => watched.filter(w => w.stars >= 4).sort((a, b) => b.stars - a.stars), [watched])

  const people = entitiesByType.person, studios = entitiesByType.company, themes = entitiesByType.keyword

  // Posters that carry a genre / entity, library-first, for the hero collages.
  const collageForGenre = (g: string) => library.filter(t => t.genres.includes(g)).slice(0, 3)
  const collageForEntity = (id: number) => library.filter(t => t.tags?.some(tag => tag.id === id)).slice(0, 3)

  // ── Low-confidence state: don't show a thin chart, show the path to one ──
  if (seenCount < MIN_SEEN) {
    const left = MIN_SEEN - seenCount
    return (
      <div style={{ maxWidth: 520, width: '100%', minWidth: 0, margin: '0 auto', padding: '32px 22px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: '#86efac' }}><Icon name="sparkle" size={40} /></div>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>Your Mirror is developing</div>
        <div style={{ marginTop: 8, fontSize: 14, opacity: 0.7, lineHeight: 1.5 }}>
          Swipe <strong style={{ color: '#fff' }}>{left} more</strong> {left === 1 ? 'title' : 'titles'} and REX will show you a portrait of your taste — your top people, studios, themes and the vibe that ties them together.
        </div>
        <div style={{ margin: '20px auto 0', maxWidth: 220, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${(seenCount / MIN_SEEN) * 100}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s' }} />
        </div>
        <button onClick={onGoSwipe}
          style={{ marginTop: 22, padding: '12px 22px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
          Keep swiping
        </button>
      </div>
    )
  }

  const tasteType = buildTasteType(vibes, studios, people, themes)

  const url = `${location.origin}${location.pathname}`

  // Render the fingerprint to a canvas → share as an image (the growth loop);
  // fall back to text share / clipboard where files aren't supported.
  const shareMirror = async () => {
    const text = `My REX taste type: ${tasteType}`
    try {
      const blob = await renderShareImage(tasteType, people[0]?.label, vibes[0]?.name, studios[0]?.label)
      const file = blob ? new File([blob], 'rex-taste.png', { type: 'image/png' }) : null
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
        return
      }
      if (blob) { triggerDownload(blob, 'rex-taste.png'); return }
      if (navigator.share) await navigator.share({ title: 'My REX taste', text, url })
      else await navigator.clipboard.writeText(`${text} — ${url}`)
    } catch { /* dismissed */ }
  }

  const copyCode = async () => {
    // Carry the name (set in remote Match) so the friend's blend banner and
    // compatibility card say who this is, not "a friend".
    let name: string | undefined
    try { name = localStorage.getItem('rex_name') || undefined } catch { /* private mode */ }
    try {
      await navigator.clipboard.writeText(encodeTaste({ v: 1, name, taste, likes, dislikes }))
      setCopied(true); window.setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div style={{ maxWidth: 520, width: '100%', minWidth: 0, margin: '0 auto', padding: '4px 16px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '8px 2px 14px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Your Mirror</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyCode} aria-label="Copy taste code for blending"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}>
            <Icon name="users" size={14} /> {copied ? 'Copied!' : 'Taste code'}
          </button>
          <button onClick={shareMirror} aria-label="Share my taste"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }}>
            <Icon name="share" size={14} /> Share
          </button>
        </div>
      </div>

      {/* Fingerprint header */}
      <div style={{ borderRadius: 20, padding: '20px 18px', background: 'linear-gradient(150deg, rgba(34,197,94,0.16), rgba(56,189,248,0.10))', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>Your taste type</div>
        <div style={{ marginTop: 8, fontSize: 23, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{tasteType}</div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <HeroChip label="Top person" value={people[0]?.label} collage={people[0] ? collageForEntity(people[0].id) : []}
            onClick={people[0] ? () => onPivot({ type: 'person', id: people[0].id, name: people[0].label }) : undefined} />
          <HeroChip label="Top vibe" value={vibes[0]?.name} collage={vibes[0] ? collageForGenre(vibes[0].name) : []}
            onClick={vibes[0] ? () => onPivot({ type: 'genre', id: 0, name: vibes[0].name }) : undefined} />
          <HeroChip label="Top studio" value={studios[0]?.label} collage={studios[0] ? collageForEntity(studios[0].id) : []}
            onClick={studios[0] ? () => onPivot({ type: 'company', id: studios[0].id, name: studios[0].label }) : undefined} />
        </div>
      </div>

      {/* Match CTA — the social hook */}
      <button onClick={onStartMatch}
        style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '14px', borderRadius: 14, fontSize: 14.5, fontWeight: 800, cursor: 'pointer', background: 'rgba(56,189,248,0.14)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.4)' }}>
        <Icon name="users" size={18} /> Match with someone — what do you both watch?
      </button>

      <Rail title="People" items={people.slice(0, 12)} onPivot={e => onPivot({ type: 'person', id: e.id, name: e.label })}
        onTune={e => setTune({ type: 'person', id: e.id, name: e.label })} maxW={people[0]?.w ?? 1} />
      <Rail title="Studios" items={studios.slice(0, 12)} onPivot={e => onPivot({ type: 'company', id: e.id, name: e.label })}
        onTune={e => setTune({ type: 'company', id: e.id, name: e.label })} maxW={studios[0]?.w ?? 1} />
      <Rail title="Themes" items={themes.slice(0, 12)} onPivot={e => onPivot({ type: 'keyword', id: e.id, name: e.label })}
        onTune={e => setTune({ type: 'keyword', id: e.id, name: e.label })} maxW={themes[0]?.w ?? 1} />
      <VibeRail vibes={vibes.slice(0, 10)} onPivot={v => onPivot({ type: 'genre', id: 0, name: v.name })}
        onTune={v => setTune({ type: 'genre', id: 0, name: v.name })} maxW={vibes[0]?.w ?? 1} />
      {(people.length > 0 || vibes.length > 0) && (
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.45 }}>Tap a chip for its deck · hold it to tune (more / less / mute)</div>
      )}

      {bedrock.length > 0 && (
        <>
          <div style={{ marginTop: 24, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>Films that define you</div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 10 }}>
            {bedrock.slice(0, 12).map(t => (
              <div key={titleKey(t)} style={{ position: 'relative', aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden', background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                <Poster src={t.poster} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 6px 5px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', fontSize: 9.5, fontWeight: 700, lineHeight: 1.1 }}>
                  {'★'.repeat(t.stars)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Social memory — titles you matched on with other people */}
      {matchHistory.length > 0 && (
        <>
          <div style={{ marginTop: 24, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>Matched together</div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 10 }}>
            {matchHistory.slice(0, 8).map(r => (
              <button key={`${r.key}-${r.with}`} onClick={() => onOpenTitle(r.title)} aria-label={`Open ${r.title.title}, matched with ${r.with}`}
                style={{ position: 'relative', aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', background: `linear-gradient(155deg, ${r.title.gradient[0]}, ${r.title.gradient[1]})` }}>
                <Poster src={r.title.poster} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 6px 5px', background: 'linear-gradient(to top, rgba(0,0,0,0.88), transparent)', fontSize: 9.5, fontWeight: 700, lineHeight: 1.15, color: '#86efac', textAlign: 'left' }}>
                  with {r.with}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Tune sheet — long-pressed chip */}
      {tune && (
        <div onClick={() => setTune(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Tune ${tune.name}`}
            style={{ width: '100%', maxWidth: 480, borderRadius: '24px 24px 0 0', background: '#15151F', border: '1px solid rgba(255,255,255,0.1)', padding: '18px 20px calc(22px + env(safe-area-inset-bottom))' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.55 }}>Tune your algorithm</div>
            <div style={{ marginTop: 4, fontSize: 19, fontWeight: 800 }}>{tune.name}</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <TuneBtn color="#22c55e" label="More like this" sub="Boost it in your deck" onClick={() => { onTune(tune, 'more'); setTune(null) }} />
              <TuneBtn color="#f6c244" label="Less of this" sub="Ease off without hiding it" onClick={() => { onTune(tune, 'less'); setTune(null) }} />
              <TuneBtn color="#ef4444" label="Mute" sub={tune.type === 'genre' ? 'Hide this genre from your deck' : 'Stop recommending around this'} onClick={() => { onTune(tune, 'mute'); setTune(null) }} />
            </div>
            <button onClick={() => setTune(null)}
              style={{ marginTop: 12, width: '100%', padding: '11px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.6)', border: 'none' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TuneBtn({ color, label, sub, onClick }: { color: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', padding: '12px 14px', borderRadius: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}55`, color: '#fff' }}>
      <span style={{ fontSize: 14.5, fontWeight: 800, color }}>{label}</span>
      <span style={{ fontSize: 12, opacity: 0.65 }}>{sub}</span>
    </button>
  )
}

function HeroChip({ label, value, collage, onClick }: { label: string; value?: string; collage: Title[]; onClick?: () => void }) {
  const empty = !value
  return (
    <button onClick={onClick} disabled={empty}
      style={{ flex: '1 1 130px', minWidth: 0, textAlign: 'left', borderRadius: 14, overflow: 'hidden', cursor: empty ? 'default' : 'pointer', padding: 0,
        background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.12)', opacity: empty ? 0.5 : 1 }}>
      <div style={{ display: 'flex', height: 48 }}>
        {(collage.length ? collage : [null, null, null]).slice(0, 3).map((t, i) => (
          <div key={i} style={{ flex: 1, position: 'relative', background: t ? `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})` : 'rgba(255,255,255,0.05)' }}>
            {t && <Poster src={t.poster} />}
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.55 }}>{label}</div>
        <div style={{ marginTop: 3, fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ?? 'Keep swiping'}</div>
      </div>
    </button>
  )
}

function Rail({ title, items, onPivot, onTune, maxW }: { title: string; items: Entity[]; onPivot: (e: Entity) => void; onTune: (e: Entity) => void; maxW: number }) {
  if (!items.length) return null
  return (
    <>
      <div style={{ marginTop: 22, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>{title}</div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' } as CSSProperties}>
        {items.map(e => <Chip key={e.id} label={e.label} pct={maxW ? e.w / maxW : 0} color="56,189,248" onClick={() => onPivot(e)} onLongPress={() => onTune(e)} />)}
      </div>
    </>
  )
}

function VibeRail({ vibes, onPivot, onTune, maxW }: { vibes: Vibe[]; onPivot: (v: Vibe) => void; onTune: (v: Vibe) => void; maxW: number }) {
  if (!vibes.length) return null
  return (
    <>
      <div style={{ marginTop: 22, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>Genres</div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' } as CSSProperties}>
        {vibes.map(v => <Chip key={v.name} label={v.name} pct={maxW ? v.w / maxW : 0} color="34,197,94" onClick={() => onPivot(v)} onLongPress={() => onTune(v)} />)}
      </div>
    </>
  )
}

/** Tap → pivot deck; hold ~450ms → tune sheet. The browser cancels the pointer
 *  when a rail scroll takes over, so scrolling never triggers the hold. */
function Chip({ label, pct, color, onClick, onLongPress }: { label: string; pct: number; color: string; onClick: () => void; onLongPress?: () => void }) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const start = () => {
    if (!onLongPress) return
    fired.current = false
    timer.current = window.setTimeout(() => {
      fired.current = true
      if (navigator.vibrate) navigator.vibrate(8)
      onLongPress()
    }, 450)
  }
  const clear = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null } }
  return (
    <button
      onPointerDown={start} onPointerUp={clear} onPointerLeave={clear} onPointerCancel={clear}
      onContextMenu={e => e.preventDefault()}
      onClick={() => { if (fired.current) { fired.current = false; return } onClick() }}
      style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', fontSize: 12.5, fontWeight: 700, padding: '8px 13px', borderRadius: 999, cursor: 'pointer', color: '#fff', background: 'rgba(255,255,255,0.07)', border: `1px solid rgba(${color},0.5)`, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as CSSProperties}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(6, Math.min(100, pct * 100))}%`, background: `rgba(${color},0.18)` }} />
      <span style={{ position: 'relative' }}>{label}</span>
    </button>
  )
}

// Templated "taste type" — evocative, deterministic, no model call.
function buildTasteType(vibes: Vibe[], studios: Entity[], people: Entity[], themes: Entity[]): string {
  const v1 = vibes[0]?.name, v2 = vibes[1]?.name
  const flavor = studios[0]?.label ?? people[0]?.label ?? themes[0]?.label
  let head: string
  if (v1 && v2) head = `${v1}-leaning ${v2.toLowerCase()} fan`
  else if (v1) head = `${v1} devotee`
  else head = 'Eclectic viewer'
  return flavor ? `${head} with a soft spot for ${flavor}` : head
}

// ── Share image (vanilla canvas, no deps) ────────────────────────────────────
function triggerDownload(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u; a.download = name; a.click()
  URL.revokeObjectURL(u)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh }
    else line = test
  }
  if (line) ctx.fillText(line, x, y)
  return y
}

function renderShareImage(tasteType: string, person?: string, vibe?: string, studio?: string): Promise<Blob | null> {
  const W = 1080, H = 1080
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#0d2a1a'); g.addColorStop(1, '#0b0b12')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff'
  ctx.font = '900 64px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('R', 84, 150)
  ctx.fillStyle = '#22c55e'; ctx.fillText('E', 84 + ctx.measureText('R').width, 150)
  ctx.fillStyle = '#fff'; ctx.fillText('X', 84 + ctx.measureText('RE').width, 150)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '700 30px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('MY TASTE TYPE', 84, 360)

  ctx.fillStyle = '#fff'
  ctx.font = '800 78px ui-sans-serif, system-ui, sans-serif'
  const endY = wrap(ctx, tasteType, 84, 450, W - 168, 92)

  const rows: [string, string][] = []
  if (person) rows.push(['TOP PERSON', person])
  if (vibe) rows.push(['TOP VIBE', vibe])
  if (studio) rows.push(['TOP STUDIO', studio])
  let y = Math.max(endY + 120, 760)
  for (const [label, val] of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 26px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(label, 84, y)
    ctx.fillStyle = '#86efac'; ctx.font = '800 44px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(val, 84, y + 48)
    y += 116
  }

  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '600 26px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('made with REX · swipe to find what to watch', 84, H - 70)

  return new Promise(res => c.toBlob(b => res(b), 'image/png'))
}
