const CACHE = 'ten-v10';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/words.json', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const requestUrl = new URL(e.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  if (!isSameOrigin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const fresh = await fetch(e.request);
      if (fresh && fresh.ok) {
        cache.put(e.request, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      throw new Error('Network and cache both failed.');
    }
  })());
});
