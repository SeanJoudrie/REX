import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { Title } from '../types'

const pill: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
  padding: '5px 10px', borderRadius: 999,
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.16)', color: '#fff',
}
const badge: CSSProperties = {
  fontSize: 11, fontWeight: 700,
  padding: '4px 9px', borderRadius: 8,
  background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff',
}

/** Poster-first card: thin, decision-relevant info only (per the UX teardown).
 *  Real synopsis lives in the detail view. */
function MovieCard({ t, dimmed }: { t: Title; dimmed?: boolean }) {
  return (
    <div className="no-select" style={{
      position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden',
      background: t.poster ? '#111' : `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})`,
      boxShadow: '0 24px 60px -22px rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {t.poster && (
        <img src={t.poster} alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 75% at 50% 0%, rgba(255,255,255,0.10), transparent 55%)' }} />

      <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between' }}>
        <span style={pill}>{t.mediaType === 'tv' ? 'TV' : 'Film'}</span>
        <span style={pill}>★ {t.rating.toFixed(1)}</span>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '64px 18px 20px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.55) 46%, transparent)',
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.02em' }}>{t.title}</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.82 }}>{t.year} · {t.genres.join(' · ')}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {t.providers.map(p => <span key={p} style={badge}>{p}</span>)}
        </div>
      </div>

      {dimmed && <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,11,18,0.4)' }} />}
    </div>
  )
}

export default memo(MovieCard)
