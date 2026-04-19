const CACHE_NAME = 'speakupapp-cache-v22';
const APP_SHELL_CACHE = `${CACHE_NAME}-shell`;
const MEDIA_CACHE = `${CACHE_NAME}-media`;
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;

const APP_SHELL_URLS = [
  './',
  './index.html',
  './dashboard.html',
  './style.css',
  './auth-mock.js',
  './script.js',
  './manifest.json',
  './units/manifest.json',
  './Images/Unit1/manku-icon-192.png',
  './Images/Unit1/manku-icon-512.png',
  './Images/Unit1/manku.webp'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    const failures = [];

    for (const url of APP_SHELL_URLS) {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
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

self.addEventListener('activate', event => {
  const cacheWhitelist = [APP_SHELL_CACHE, MEDIA_CACHE, RUNTIME_CACHE];
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

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (isMediaRequest(request, url)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  if (isFreshContentRequest(request, url)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isMediaRequest(request, url) {
  return (
    request.destination === 'image' ||
    request.destination === 'audio' ||
    request.destination === 'video' ||
    /\.(?:webp|png|jpe?g|gif|svg|ico|mp3|mp4|wav|ogg)$/i.test(url.pathname)
  );
}

function isFreshContentRequest(request, url) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    /\.(?:html|js|css|json)$/i.test(url.pathname)
  );
}

async function networkOnly(request) {
  return fetch(request);
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      const fallback = await caches.match('./dashboard.html');
      if (fallback) {
        return fallback;
      }
    }

    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (isCacheable(response)) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (isCacheable(response)) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cachedResponse || fetchPromise;
}

function isCacheable(response) {
  return response && response.ok && response.type === 'basic';
}
