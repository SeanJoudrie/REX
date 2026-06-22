// Cloud backup client — talks to the `backup` Edge Function. Only available when
// the proxy base (VITE_TMDB_PROXY) is configured (i.e. the deployed app).
const PROXY = import.meta.env.VITE_TMDB_PROXY as string | undefined

export const CLOUD_ENABLED = !!PROXY

export async function cloudSave(data: unknown, code?: string): Promise<string> {
  if (!PROXY) throw new Error('cloud not configured')
  const res = await fetch(`${PROXY}/backup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save', data, code }),
  })
  if (!res.ok) throw new Error(`backup failed (${res.status})`)
  return (await res.json()).code as string
}

export async function cloudRestore(code: string): Promise<unknown> {
  if (!PROXY) throw new Error('cloud not configured')
  const res = await fetch(`${PROXY}/backup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restore', code: code.trim().toUpperCase() }),
  })
  if (res.status === 404) throw new Error('No backup found for that code.')
  if (!res.ok) throw new Error(`restore failed (${res.status})`)
  return (await res.json()).data
}
