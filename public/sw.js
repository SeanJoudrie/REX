/* REX service worker — app-shell + asset + poster caching so the installed PWA
   boots offline instead of showing blank cards on a flaky connection. */
const SHELL = 'rex-shell-v1'
const ASSETS = 'rex-assets-v1'
const IMAGES = 'rex-img-v1'
const KEEP = new Set([SHELL, ASSETS, IMAGES])

const scope = self.registration.scope // e.g. https://host/REX/
const INDEX = scope + 'index.html'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(SHELL).then((c) =>
      c.addAll([scope, INDEX, scope + 'manifest.webmanifest', scope + 'icon.png']).catch(() => {}),
    ),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n)))
    await self.clients.claim()
  })())
})

async function trim(cache, max) {
  const keys = await cache.keys()
  if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await cache.delete(k)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // never touch the POST proxy/backup calls
  const url = new URL(req.url)

  // Navigations: network-first, fall back to the cached shell (offline boot).
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const c = await caches.open(SHELL)
        c.put(INDEX, fresh.clone())
        return fresh
      } catch {
        return (await caches.match(INDEX)) || (await caches.match(req)) || Response.error()
      }
    })())
    return
  }

  // Hashed build assets: stale-while-revalidate.
  if (url.origin === self.location.origin && url.pathname.includes('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS)
      const cached = await cache.match(req)
      const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res }).catch(() => cached)
      return cached || network
    })())
    return
  }

  // TMDB posters: cache-first with a soft cap so they show offline.
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGES)
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        if (res.ok) { cache.put(req, res.clone()); trim(cache, 150) }
        return res
      } catch { return cached || Response.error() }
    })())
  }
})
