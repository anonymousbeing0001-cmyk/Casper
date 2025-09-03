const CACHE_NAME = 'casper-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/ai-visual.js',
  '/manifest.json',
  '/icon.png',
  '/ai_memory.json',
  '/seed_urls.json',
  '/web-learner.js',
  '/sw.js'
];

// Install event: cache all essential files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching all assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate event: clean up old caches if needed
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
});

// Fetch event: serve cached assets if offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    }).catch(() => {
      // Optional: fallback page if needed
      return caches.match('/index.html');
    })
  );
});