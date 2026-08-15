const CACHE = 'svrn-reader-v1';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/']))));
self.addEventListener('fetch', event => { if (event.request.method !== 'GET') return; event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { if (response.ok && new URL(event.request.url).origin === location.origin) caches.open(CACHE).then(cache => cache.put(event.request, response.clone())); return response; }))); });
