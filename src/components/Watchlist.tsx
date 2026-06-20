import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Title } from '../types'

export default function Watchlist({ items, onOpen }: { items: Title[]; onOpen: (t: Title) => void }) {
  const [provider, setProvider] = useState<string | null>(null)
  const providers = [...new Set(items.flatMap(t => t.providers))].sort()
  const shown = provider ? items.filter(t => t.providers.includes(provider)) : items

  if (!items.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', opacity: 0.7 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Your watchlist is empty</div>
        <div style={{ marginTop: 6, fontSize: 13.5, opacity: 0.7 }}>Swipe right on anything you want to watch and it lands here.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 16px 24px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '8px 2px 14px' }}>
        Watchlist <span style={{ opacity: 0.5, fontSize: 16 }}>{items.length}</span>
      </div>

      {providers.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          <Chip active={provider === null} onClick={() => setProvider(null)}>All</Chip>
          {providers.map(p => <Chip key={p} active={provider === p} onClick={() => setProvider(p)}>{p}</Chip>)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {shown.map(t => (
          <button key={`${t.mediaType}-${t.id}`} onClick={() => onOpen(t)}
            style={{ textAlign: 'left', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: '#15151F', padding: 0 }}>
            <div style={{ height: 150, background: `linear-gradient(155deg, ${t.gradient[0]}, ${t.gradient[1]})`, position: 'relative' }}>
              <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, background: 'rgba(0,0,0,0.5)' }}>★ {t.rating.toFixed(1)}</span>
            </div>
            <div style={{ padding: '10px 11px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div style={{ marginTop: 3, fontSize: 11, opacity: 0.6 }}>{t.year} · {t.providers[0] ?? '—'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
        background: active ? '#fff' : 'rgba(255,255,255,0.08)', color: active ? '#0B0B12' : '#fff',
        border: '1px solid rgba(255,255,255,0.16)' }}>{children}</button>
  )
}
