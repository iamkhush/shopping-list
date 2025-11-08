const CACHE_NAME = 'shopping-list-v1';
const urlsToCache = [
  '/shopping-list/',
  '/shopping-list/index.html',
  '/shopping-list/static/styles.css',
  '/shopping-list/static/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});