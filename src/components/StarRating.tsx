import type { CSSProperties } from 'react'

/** Tappable 1–5 star control. value 0 = unrated. */
export default function StarRating({ value, onChange, size = 24 }: {
  value: number
  onChange: (n: number) => void
  size?: number
}) {
  return (
    <div role="group" aria-label="Your rating" style={{ display: 'flex', gap: size > 20 ? 6 : 3 }}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= value
        return (
          <button key={n} onClick={e => { e.stopPropagation(); onChange(n === value ? 0 : n) }}
            aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={filled}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1,
              fontSize: size, color: filled ? '#f6c244' : 'rgba(255,255,255,0.3)',
              filter: filled ? 'drop-shadow(0 1px 4px rgba(246,194,68,0.5))' : 'none',
              transition: 'color 0.12s, transform 0.08s',
            } as CSSProperties}>★</button>
        )
      })}
    </div>
  )
}
