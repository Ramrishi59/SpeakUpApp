const CACHE_NAME_PREFIX = 'speakupapp-cache-';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(clearSpeakUpCaches());
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    clearSpeakUpCaches(),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function clearSpeakUpCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith(CACHE_NAME_PREFIX))
      .map(name => caches.delete(name))
  );
}
