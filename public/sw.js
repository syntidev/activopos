// Service Worker — ActivoPOS PWA
// Estrategia: Network First con fallback a cache

const CACHE_NAME = 'activopos-v2'
const OFFLINE_URL = '/offline.html'

const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = { title: 'ActivoPOS', body: 'Tienes una notificación nueva' }
  try { data = event.data.json() } catch { /* use defaults */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data:  data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const raw = event.notification.data?.url ?? '/'
      // Only allow relative paths — reject protocol-relative and external URLs
      const url = (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) ? raw : '/'
      const existing = list.find(c => c.url.includes(url) && 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return
  if (event.request.url.includes('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() =>
        caches.match(event.request).then(cached => cached ?? caches.match(OFFLINE_URL))
      )
  )
})
