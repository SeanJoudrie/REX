import type { CSSProperties } from 'react'
import Icon from './Icon'

function Row({ color, icon, dir, title, sub }: { color: string; icon: 'check' | 'x' | 'eye'; dir: string; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' }}>
      <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 999, border: `1.5px solid ${color}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)' }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>
          {title} <span style={{ color, fontWeight: 700 }}>{dir}</span>
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(8,8,14,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ width: '100%', maxWidth: 380, borderRadius: 24, background: '#15151F', border: '1px solid rgba(255,255,255,0.1)', padding: '26px 22px 20px' } as CSSProperties}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: '0.14em' }}>R<span style={{ color: '#22c55e' }}>E</span>X</div>
          <div style={{ fontSize: 13.5, opacity: 0.7, marginTop: 6 }}>Swipe to discover what to watch. Three moves:</div>
        </div>

        <div style={{ margin: '12px 0 4px' }}>
          <Row color="#22c55e" icon="check" dir="→ Right" title="Like it" sub="Adds to your Watchlist — and more like it." />
          <Row color="#ef4444" icon="x" dir="← Left" title="Pass" sub="Not interested — REX shows you less of this." />
          <Row color="#38bdf8" icon="eye" dir="↑ Up" title="Seen it" sub="Mark watched, then rate 1–5 stars." />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <span style={{ color: '#22c55e', marginTop: 1 }}><Icon name="sliders" size={18} /></span>
          <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            <strong>Build your own algorithm.</strong> Every swipe and rating tunes your deck — and you can set what you’re into (or not) anytime under <strong>Watched → Your taste</strong>.
          </div>
        </div>

        <button onClick={onDone}
          style={{ marginTop: 18, width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
          Start swiping
        </button>
      </div>
    </div>
  )
}
