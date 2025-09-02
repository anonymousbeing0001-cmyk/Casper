
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('corememory-cache').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/ai-visual.js',
        '/manifest.json',
        '/icon.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return resp || fetch(event.request);
    })
  );
});
