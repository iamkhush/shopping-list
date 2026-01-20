// Service Worker for offline-first caching strategy
const CACHE_NAME = 'shopping-list-v1';
const API_CACHE_NAME = 'shopping-list-api-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/shopping-list/',
  '/shopping-list/index.html',
  '/shopping-list/static/app.js',
  '/shopping-list/static/styles.css'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // API requests: network-first strategy (try server, fallback to cache)
  if (url.pathname.includes('/shopping-list/api')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache when offline
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('Service Worker: Serving from cache (offline):', url.pathname);
              return cachedResponse;
            }
            // If no cache, return offline error response
            return new Response(JSON.stringify({ error: 'Offline - no cached data' }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
  } else {
    // Static assets: cache-first strategy
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          // Cache new assets
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});
