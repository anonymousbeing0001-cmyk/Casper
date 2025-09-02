// Service Worker for Casper PWA

// Install event
self.addEventListener('install', event => {
    console.log('Service Worker installed');
    // Pre-cache files if needed
    event.waitUntil(
        caches.open('casper-cache-v1').then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                '/ai-visual.js',
                '/manifest.json',
                '/sw.js',
                '/icon.png'
            ]);
        })
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('Service Worker activated');
    // Clean up old caches if needed
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== 'casper-cache-v1')
                    .map(key => caches.delete(key))
            )
        )
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});