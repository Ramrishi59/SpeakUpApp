// Bump CACHE_VERSION whenever you deploy lesson content changes
// that should invalidate cached audio/images for all users.
const CACHE_VERSION = 'v1';
const CACHE_LESSONS = `speakup-lessons-${CACHE_VERSION}`;
const CACHE_SHELL   = `speakup-shell-${CACHE_VERSION}`;
const CACHE_CDN     = `speakup-cdn-${CACHE_VERSION}`;
const OWN_CACHES    = [CACHE_LESSONS, CACHE_SHELL, CACHE_CDN];

// Requests to these hosts are never intercepted — let the browser handle them directly.
const BYPASS_HOSTS = [
  'checkout.razorpay.com',
  'api.razorpay.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebase.googleapis.com',
];

self.addEventListener('install', event => {
  // Take control immediately — no pre-caching; everything is cache-on-visit.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            // Remove stale versioned speakup caches
            (key.startsWith('speakup-') && !OWN_CACHES.includes(key)) ||
            // Remove the old speakupapp-cache-* caches from the previous service worker
            key.startsWith('speakupapp-cache-')
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle http/https — skip chrome-extension://, data: etc.
  if (!url.protocol.startsWith('http')) return;

  // Never intercept payment or Firebase auth/database API requests.
  if (BYPASS_HOSTS.includes(url.hostname)) return;

  const path = url.pathname;

  // ── Lesson audio — cache-first (files are immutable once published) ──────
  if (path.includes('/Audio/')) {
    event.respondWith(cacheFirst(req, CACHE_LESSONS));
    return;
  }

  // ── Lesson images — cache-first ──────────────────────────────────────────
  if (path.includes('/Images/')) {
    event.respondWith(cacheFirst(req, CACHE_LESSONS));
    return;
  }

  // ── Lesson and manifest JSON — network-first so updates land when online ──
  if (path.includes('/units/') && path.endsWith('.json')) {
    event.respondWith(networkFirst(req, CACHE_LESSONS));
    return;
  }

  // ── Firebase JS SDK (versioned CDN URLs — immutable) ─────────────────────
  if (url.hostname.endsWith('gstatic.com')) {
    event.respondWith(cacheFirst(req, CACHE_CDN));
    return;
  }

  // ── Google Fonts and third-party CDN assets ───────────────────────────────
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  ) {
    event.respondWith(cacheFirst(req, CACHE_CDN));
    return;
  }

  // ── Same-origin app shell (HTML, CSS, JS) — network-first ─────────────────
  // Ensures deployed updates are picked up immediately when online,
  // while offline users can still load pages they have visited before.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, CACHE_SHELL));
    return;
  }

  // Everything else — browser handles it without service worker involvement.
});

/**
 * Cache-first: serve from cache immediately if available; fetch, cache,
 * and serve on a miss. Best for immutable assets (images, audio, CDN JS).
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()); // intentionally not awaited — fire and forget
    }
    return response;
  } catch {
    // Offline and not yet cached — return a plain error response so the
    // browser shows a broken-image placeholder or silent audio rather than
    // crashing. The lesson player handles missing assets gracefully.
    return new Response('Not available offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Network-first: always try the network and update the cache on success.
 * Falls back to the cached copy when offline. Best for JSON data and HTML
 * where we want fresh content when online.
 *
 * If there is no network and nothing in cache, the returned promise rejects
 * so the calling page receives a normal fetch error it can handle itself.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()); // fire and forget
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Nothing cached and no network — let the error surface to the page.
    throw new Error(`offline-not-cached:${request.url}`);
  }
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
