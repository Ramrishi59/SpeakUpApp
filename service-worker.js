const CACHE_NAME = 'speakupapp-cache-v9';

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './units/manifest.json',
  './Images/Unit1/icon.png',
  './Images/Unit1/icon-512x512.png',
  './Images/Unit1/newicon.png',
  './Images/Unit1/m.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // activate updated SW immediately
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const failures = [];

    for (const url of urlsToCache) {
      try {
        await cache.add(url);
      } catch (err) {
        failures.push(url);
        console.warn(`Skipping cache for ${url}:`, err);
      }
    }

    if (failures.length === 0) {
      console.log('Opened cache');
    } else {
      console.warn('Cache populated with some skips:', failures);
    }
  })());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => {
            if (!cacheWhitelist.includes(name)) {
              return caches.delete(name);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
