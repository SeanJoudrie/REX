import type { Title } from '../types'

// Deep-link the watch handoff (UX teardown §3.2): tapping a provider jumps
// straight to the title. Real per-provider deep links come from the JustWatch
// data on the TMDB detail response; until that's wired we hand off to a
// JustWatch title search, which still collapses "I want this" to one tap.
function watchUrl(t: Title): string {
  return `https://www.justwatch.com/us/search?q=${encodeURIComponent(t.title)}`
}

export default function Detail({ t, saved, onClose, onToggleSave }: {
  t: Title
  saved: boolean
  onClose: () => void
  onToggleSave: (t: Title) => void
}) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', borderRadius: '24px 24px 0 0', background: '#15151F', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ height: 170, background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})`, position: 'relative' }}>
          <button onClick={onClose} aria-label="Close"
            style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 999, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px 28px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t.title}</div>
          <div style={{ marginTop: 5, fontSize: 13, opacity: 0.7 }}>{t.year} · {t.mediaType === 'tv' ? 'TV Series' : 'Film'} · ★ {t.rating.toFixed(1)} · {t.genres.join(', ')}</div>
          <p style={{ marginTop: 14, fontSize: 14.5, lineHeight: 1.6, opacity: 0.9 }}>{t.overview}</p>

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
