// Bump CACHE_VERSION whenever you deploy lesson content changes
// that should invalidate cached audio/images for all users.
const CACHE_VERSION = 'v50';
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

  // ── Same-origin app shell (HTML, CSS, JS) — stale-while-revalidate ─────────
  // Serves from cache immediately so repeat visits paint fast, while always
  // fetching a fresh copy in the background to keep the cache current.
  // Falls back to the cached copy if offline; shows the offline page for
  // navigation requests that have never been cached.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, CACHE_SHELL));
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
 * For page navigations that have no cached entry the function returns a
 * friendly in-app offline page so the browser never shows "This site can't
 * be reached". For non-navigation requests (JSON, images, etc.) the promise
 * rejects so the calling page can handle the error itself.
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
    // Exact URL match (includes query string)
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      // Query-string-ignoring match: Trial.html?unitId=unit3 is served by the
      // cached Trial.html?unitId=unit1. Trial.js reads unitId from
      // location.search (the real browser URL), tries to load unit3.json,
      // fails, and shows showOfflineUnavailable() — the correct in-app message.
      const fuzzy = await caches.match(request, { ignoreSearch: true });
      if (fuzzy) return fuzzy;

      // Nothing cached at all — return a self-contained offline page so the
      // browser never shows its native network-error screen.
      return offlineNavigationResponse();
    }

    // Non-navigation (JSON, etc.) — surface the error to the page.
    throw new Error(`offline-not-cached:${request.url}`);
  }
}

/**
 * Stale-while-revalidate: return a cached copy immediately (fast repeat
 * visits) and always fetch a fresh copy in the background so the cache
 * stays current. Best for app shell files (HTML, CSS, JS) where we want
 * instant loads AND background updates.
 *
 * First visit (nothing cached): waits for the network like networkFirst.
 * Offline with cache: returns the cached copy; background fetch is a no-op.
 * Offline with no cache: returns the offline page for navigations, throws
 * for sub-resources (so the page can handle it).
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Always kick off a background revalidation — never awaited when cache hit.
  const revalidate = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null); // network failure during background update is silent

  if (cached) {
    // Serve the stale copy right away; cache update happens in background.
    return cached;
  }

  // No cached copy (first visit) — must wait for the network.
  const fresh = await revalidate;
  if (fresh) return fresh;

  // No cache and no network — show offline page for navigations, throw for
  // sub-resources (scripts, CSS) so the browser handles missing assets.
  if (request.mode === 'navigate') {
    const fuzzy = await caches.match(request, { ignoreSearch: true });
    if (fuzzy) return fuzzy;
    return offlineNavigationResponse();
  }
  throw new Error(`offline-not-cached:${request.url}`);
}

function offlineNavigationResponse() {
  const dashboardUrl = `${self.registration.scope}dashboard.html`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Not Available Offline – Speak Up</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;font-family:Fredoka,Nunito,system-ui,sans-serif;
       background:#fff7ed;min-height:100svh;display:grid;
       place-items:center;padding:24px;text-align:center;color:#312015}
  .card{width:min(420px,100%);background:#fff;border:2px solid #f4c18f;
        border-radius:18px;padding:32px 28px;
        box-shadow:0 16px 40px rgba(92,52,18,.14)}
  .icon{font-size:3rem;margin-bottom:16px}
  h1{margin:0 0 12px;font-size:clamp(22px,6vw,32px);color:#5c4a3a}
  p{margin:0 0 28px;font-size:1.05rem;line-height:1.6;color:#5a4a38}
  a{display:inline-flex;align-items:center;justify-content:center;
    min-height:48px;padding:0 28px;border-radius:999px;
    background:#ff7a59;color:#fff;text-decoration:none;
    font-size:1rem;font-weight:700;box-shadow:0 4px 0 #c94e1c}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">&#x1F4F6;</div>
    <h1>Not available offline</h1>
    <p>Open this lesson once while connected to the internet. After that, it will work without a connection.</p>
    <a href="${dashboardUrl}">Back to Lessons</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
