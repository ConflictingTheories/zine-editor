const CACHE_NAME = 'void-press-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/app.js',
    '/editor.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached asset if available
            if (response) {
                return response;
            }
            // Otherwise fetch from network
            return fetch(event.request).then((networkResponse) => {
                // Cache new successful GET requests
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseclone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseclone);
                    });
                }
                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
