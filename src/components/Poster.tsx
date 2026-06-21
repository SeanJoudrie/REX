import { useState } from 'react'

/** Cover image that disappears (revealing the gradient behind it) if the source
 *  fails to load — no broken-image icon. */
export default function Poster({ src }: { src?: string }) {
  const [ok, setOk] = useState(true)
  if (!src || !ok) return null
  return (
    <img src={src} alt="" draggable={false} onError={() => setOk(false)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
  )
}
