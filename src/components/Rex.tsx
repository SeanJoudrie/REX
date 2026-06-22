import type { CSSProperties } from 'react'

export type RexMood = 'idle' | 'happy' | 'shrug' | 'roar'

// Pixel palette.
const C: Record<string, string> = {
  G: '#22c55e', // body
  L: '#4ade80', // highlight
  D: '#15803d', // shade
  W: '#ffffff', // eye
  K: '#0b0b12', // pupil / mouth
  R: '#ef4444', // tongue (roar)
}

// 16×16 Rexasaurus Rex, facing right. Space = transparent. Authored as a char
// grid and rendered as crisp <rect> pixels — deliberate pixel art at any size,
// pure SVG, zero deps.
const ART = [
  '                ',
  '          LLGG  ',
  '         LGGGGG ',
  '         GGWKGG ',
  '         GGGGGG ',
  '    GG   GGGGGG ',
  '   GGGG GGGGGGG ',
  '  GGGGGGGGGGGGG ',
  '  GGGGGGGGGGGGG ',
  '  DGGGGGGGGGGG  ',
  '  DGGGGGGGGGG   ',
  '   GGG   GGGG   ',
  '   GG     GGG   ',
  '   GG     GGG   ',
  '  GGG     GGG   ',
  '  G G     G G   ',
]

// Roar overlay: an open mouth + tongue pixels stamped onto the snout.
const ROAR: Record<string, string> = { '3,14': 'K', '4,13': 'K', '4,14': 'R', '5,14': 'K' }

export default function Rex({ mood = 'idle', size = 96, style }: { mood?: RexMood; size?: number; style?: CSSProperties }) {
  const cls = mood === 'roar' ? 'rex-roar' : mood === 'shrug' ? '' : 'rex-bob'
  const cells: { x: number; y: number; c: string }[] = []
  ART.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      let ch = row[x] ?? ' '
      if (mood === 'roar' && ROAR[`${y},${x}`]) ch = ROAR[`${y},${x}`]
      if (ch !== ' ' && C[ch]) cells.push({ x, y, c: C[ch] })
    }
  })
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 16 16" aria-hidden
      shapeRendering="crispEdges" style={{ display: 'block', ...style }}>
      {cells.map((p, i) => <rect key={i} x={p.x} y={p.y} width={1.02} height={1.02} fill={p.c} />)}
    </svg>
  )
}
