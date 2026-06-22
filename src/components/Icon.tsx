import type { CSSProperties } from 'react'

type Name =
  | 'discover' | 'bookmark' | 'eye' | 'info' | 'x' | 'check' | 'ticket'
  | 'search' | 'sliders' | 'film' | 'warning' | 'star' | 'list' | 'grid' | 'undo'
  | 'gear' | 'download' | 'upload' | 'share'
  | 'sparkle' | 'users' | 'heart' | 'plus' | 'minus'

const PATHS: Record<Name, string> = {
  // lucide-style 24x24 paths
  discover: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  bookmark: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z',
  info: 'M12 16v-4 M12 8h.01',
  x: 'M18 6 6 18 M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  ticket: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z M13 5v14',
  search: 'M21 21l-4.3-4.3 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  film: 'M3 4h18v16H3z M7 4v16 M17 4v16 M3 8h4 M3 12h4 M3 16h4 M17 8h4 M17 12h4 M17 16h4',
  warning: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z M12 9v4 M12 17h.01',
  star: 'M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  undo: 'M9 14 4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-1',
  gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  upload: 'M12 21V9 M7 14l5-5 5 5 M5 3h14',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13',
  sparkle: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
}

export default function Icon({ name, size = 20, fill = false, style }: {
  name: Name
  size?: number
  fill?: boolean
  style?: CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
      fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      {name === 'eye' && <circle cx="12" cy="12" r="3" />}
      {name === 'info' && <circle cx="12" cy="12" r="10" />}
      {name === 'search' && null}
      {PATHS[name].split(' M').map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : 'M' + seg)} />
      ))}
    </svg>
  )
}
