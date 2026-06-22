import type { CSSProperties } from 'react'

export type RexMood = 'idle' | 'happy' | 'shrug' | 'roar'
export type RexVariant = 'outline' | 'flat'

// Pixel palette (brand green).
const C: Record<string, string> = {
  G: '#22c55e', // body
  D: '#16a34a', // shade
  Y: '#a3e635', // belly (lime)
  W: '#ffffff', // eye
  K: '#0b0b12', // pupil / outline
  R: '#ef4444', // tongue (roar)
}

// Cute bipedal T-rex, facing left, authored as a char grid → crisp <rect>
// pixels. Pure SVG, zero deps. Two looks: a bold black keyline ('outline') or
// soft flat shading ('flat').
const ART = [
  '..................',
  '..GGGGGGG.........',
  '..GGGGGGG.........',
  '..GGWWGGG.........',
  '..GGWKGGG.........',
  '..GGGGGGGG........',
  '.GGGGGGGGGG.......',
  '.GGG.GGGGGGGG.....',
  '....GGGGGGGGGGGGG.',
  '...YYGGGGGGGGGGGGG',
  '...YYGGGGGGGGGGD..',
  '..GYGGGGGGGGGGD...',
  '..GGGGGGGGGG......',
  '....GGGGGGGGG.....',
  '....GG..GGGG......',
  '....GG...GGG......',
  '...GGG...GGG......',
  '..GGGG...GGGG.....',
]

const H = ART.length, W = (ART[0] ?? '').length
const at = (x: number, y: number) => (y < 0 || x < 0 || y >= H || x >= W ? '.' : (ART[y][x] ?? '.'))

export default function Rex({ mood = 'idle', size = 96, variant = 'outline', style }: {
  mood?: RexMood
  size?: number
  variant?: RexVariant
  style?: CSSProperties
}) {
  const cls = mood === 'roar' ? 'rex-roar' : mood === 'shrug' ? '' : 'rex-bob'
  const rects: { x: number; y: number; c: string }[] = []

  // Outline pass: any empty cell adjacent (8-neighbour) to the body gets a
  // black pixel. We scan one cell beyond the grid so edge pixels still get a
  // border (the viewBox is padded to match).
  if (variant === 'outline') {
    for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
      if (at(x, y) !== '.') continue
      let touch = false
      for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && at(x + dx, y + dy) !== '.') { touch = true; break }
      }
      if (touch) rects.push({ x, y, c: C.K })
    }
  }

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let ch = at(x, y)
    if (mood === 'roar' && x === 4 && y === 7) ch = 'R' // tongue in the open jaw
    if (ch === '.' || !C[ch]) continue
    rects.push({ x, y, c: C[ch] })
  }

  return (
    <svg className={cls} width={size} height={size} viewBox={`-1 -1 ${W + 2} ${H + 2}`} aria-hidden
      shapeRendering="crispEdges" style={{ display: 'block', ...style }}>
      {rects.map((p, i) => <rect key={i} x={p.x} y={p.y} width={1.02} height={1.02} fill={p.c} />)}
    </svg>
  )
}
