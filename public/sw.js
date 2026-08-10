const CACHE_NAME = 'svrn-publishing-v3'
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon.svg',
    '/fonts/fonts.css',
    '/assets/textures/old-paper.svg',
    '/assets/textures/dark-matter.svg'
]

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)))
    self.skipWaiting()
})

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return
    const url = new URL(event.request.url)
    if (url.pathname.startsWith('/api/')) return

    // A publication must remain readable after it has been opened once. This
    // caches local fonts, bundled art, and author-supplied media (including
    // cross-origin opaque image responses) without caching API responses.
    event.respondWith(
        caches.match(event.request).then(hit => hit || fetch(event.request)
            .then(response => {
                if (response && (response.ok || response.type === 'opaque')) {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()))
                }
                return response
            })
            .catch(() => event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))
    )
})
