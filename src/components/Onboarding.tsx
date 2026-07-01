import { useState } from 'react'
import type { CSSProperties } from 'react'
import Icon from './Icon'

// Onboarding genre menu — mirrors the deck's GENRES list (App.tsx) so a pick
// maps 1:1 onto the discover query and the taste vector.
const PICKS = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']

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

/** Two steps: the three swipes, then a quick taste pick that seeds the
 *  algorithm so the very first deck is already personal (cold-start fix). */
export default function Onboarding({ onDone }: { onDone: (picks: string[]) => void }) {
  const [step, setStep] = useState<0 | 1>(0)
  const [picks, setPicks] = useState<string[]>([])

  const toggle = (g: string) =>
    setPicks(p => (p.includes(g) ? p.filter(x => x !== g) : [...p, g]))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(8,8,14,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ width: '100%', maxWidth: 380, borderRadius: 24, background: '#15151F', border: '1px solid rgba(255,255,255,0.1)', padding: '26px 22px 20px' } as CSSProperties}>
        {step === 0 ? (
          <>
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

            <button onClick={() => setStep(1)}
              style={{ marginTop: 18, width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
              Next
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>What are you into?</div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6, lineHeight: 1.45 }}>
                Pick a few and your very first deck is already yours. Skip if you’d rather teach REX by swiping.
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '16px 0 4px' }}>
              {PICKS.map(g => {
                const on = picks.includes(g)
                return (
                  <button key={g} onClick={() => toggle(g)} aria-pressed={on}
                    style={{ fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                      background: on ? '#22c55e' : 'rgba(255,255,255,0.08)', color: on ? '#06210f' : '#fff',
                      border: `1px solid ${on ? '#22c55e' : 'rgba(255,255,255,0.16)'}` }}>
                    {g}
                  </button>
                )
              })}
            </div>

            <button onClick={() => onDone(picks)}
              style={{ marginTop: 18, width: '100%', padding: '14px', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
              {picks.length ? `Start swiping — ${picks.length} picked` : 'Start swiping'}
            </button>
            {picks.length > 0 && (
              <button onClick={() => onDone([])}
                style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.55)', border: 'none' }}>
                Skip — just show me everything
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
