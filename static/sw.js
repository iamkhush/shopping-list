// Service Worker for offline-first caching strategy
const CACHE_NAME = 'shopping-list-v2';
const API_CACHE_NAME = 'shopping-list-api-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/shopping-list/',
  '/static/shopping-list/app.js',
  '/static/shopping-list/styles.css',
  '/static/shopping-list/offline-db.js',
  '/shopping-list/sw.js'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS)
        .catch((error) => {
          // Log the specific error to identify which request failed
          console.error('Failed to add resources to cache:', error);
          // You might choose to rethrow the error if installation should fail
          // or handle it gracefully, perhaps by falling back to a network-first strategy
          throw error; // Re-throwing ensures the install event fails
        });
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

  // Handle navigation requests (page reloads, direct visits)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the HTML page if successful
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached index.html if offline
          return caches.match('/shopping-list/');
        })
    );
    return;
  }

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
    return;
  }

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
});
