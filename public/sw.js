/* iPhoneRepasse Pro — Service Worker
 * Optimized for iOS 26 / iPadOS 26 Safari (and Chromium-based browsers).
 *
 * Strategies:
 *   - Navigations (HTML)          → network-first w/ 3s timeout, fallback /offline.html
 *   - Hashed assets (/assets/*)   → cache-first (immutable)
 *   - /brand/* (icons, logos)     → stale-while-revalidate
 *   - Google Fonts (gstatic)      → cache-first w/ 30d expiry
 *   - Supabase Storage objects    → cache-first w/ LRU (50 items)
 *   - Supabase REST GETs          → stale-while-revalidate (auth headers vary)
 *   - Other GETs                  → network-first
 *   - Non-GET                     → bypass (never cache mutations)
 *
 * Update flow: install() precaches and waits. activate() cleans old caches and
 * calls clients.claim(). A `SKIP_WAITING` postMessage triggers immediate
 * activation (used by the UpdateBanner in the app shell).
 */

const VERSION = 'v1.0.2';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;
const FONT_CACHE = `fonts-${VERSION}`;
const API_CACHE = `api-${VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/offline/index.html',
  '/app.webmanifest',
  '/site.webmanifest',
  '/crm.webmanifest',
  '/crmplus.webmanifest',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/apple-touch-icon.png',
  '/brand/favicon-32.png',
  '/brand/favicon-16.png',
];

const IMAGE_CACHE_MAX_ENTRIES = 80;
const API_CACHE_MAX_ENTRIES = 60;
const NAV_NETWORK_TIMEOUT_MS = 3000;
const CRM_HOSTNAME = 'crm.iphonerepasse.com.br';

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Use individual add() so a single 404 doesn't abort the whole install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] precache failed for', url, err);
          })
        )
      );
    })()
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const expected = new Set([
        STATIC_CACHE,
        RUNTIME_CACHE,
        IMAGE_CACHE,
        FONT_CACHE,
        API_CACHE,
      ]);
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (expected.has(k) ? null : caches.delete(k))));
      // Enable navigation preload (Chromium) — speeds up first navigation after SW activation.
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (_) { /* no-op on iOS Safari */ }
      }
      await self.clients.claim();
    })()
  );
});

// ─── Messages ─────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      })()
    );
  }
});

// ─── Routing helpers ─────────────────────────────────────────────────────────

const SUPABASE_HOST_RE = /\.supabase\.(co|in|net)$/i;
const HASHED_ASSET_RE = /\/assets\/.+\.[a-f0-9]{6,}\.(?:js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|avif|gif)$/i;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isSupabase(url) {
  return SUPABASE_HOST_RE.test(url.hostname);
}

function isSupabaseStorage(url) {
  return isSupabase(url) && url.pathname.includes('/storage/v1/object/');
}

function isSupabaseRest(url) {
  return isSupabase(url) && (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/rpc/v1/'));
}

function hasSensitiveRequestHeaders(req) {
  return req.headers.has('authorization');
}

function isGoogleFontsAsset(url) {
  return url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
}

function isBrandAsset(url) {
  return isSameOrigin(url) && url.pathname.startsWith('/brand/');
}

function isHashedBuildAsset(url) {
  return isSameOrigin(url) && HASHED_ASSET_RE.test(url.pathname);
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET; let everything else hit the network directly.
  if (req.method !== 'GET') return;

  // Ignore non-http(s) (e.g. chrome-extension://, data:).
  const url = new URL(req.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Navigation requests → app shell with offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(event));
    return;
  }

  // Authenticated requests can contain private business/user data. Never serve
  // them from a persistent SW cache, especially on shared iOS devices.
  if (hasSensitiveRequestHeaders(req)) {
    event.respondWith(networkOnly(req));
    return;
  }

  // Hashed assets are immutable — cache-first forever.
  if (isHashedBuildAsset(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Brand assets — SWR (allows updating logos without bumping cache version).
  if (isBrandAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }

  // Google Fonts.
  if (isGoogleFontsAsset(url)) {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  // Supabase Storage (images, receipts, audio).
  if (isSupabaseStorage(url)) {
    event.respondWith(cacheFirstLRU(req, IMAGE_CACHE, IMAGE_CACHE_MAX_ENTRIES));
    return;
  }

  // Supabase REST/RPC GETs are user-scoped operational data. Keep them network
  // only so logout/account switching cannot replay another session's rows.
  if (isSupabaseRest(url)) {
    event.respondWith(networkOnly(req));
    return;
  }

  // Same-origin (manifest, public assets) — SWR.
  if (isSameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // Cross-origin GETs — network-first (no caching by default).
  event.respondWith(fetch(req).catch(() => Response.error()));
});

// ─── Strategies ──────────────────────────────────────────────────────────────

async function handleNavigate(event) {
  const req = event.request;
  try {
    // Use navigation preload when available.
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    if (preload) {
      cacheNavResponse(preload.clone());
      return preload;
    }
    const network = await timeoutFetch(req, NAV_NETWORK_TIMEOUT_MS);
    cacheNavResponse(network.clone());
    return network;
  } catch (_) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = (await cache.match(req)) || (await cache.match('/'));
    if (cached) return cached;
    const offlinePath = self.location.hostname === CRM_HOSTNAME ? '/offline/index.html' : '/offline.html';
    const offline = (await cache.match(offlinePath)) || (await cache.match('/offline.html'));
    if (offline) return offline;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheNavResponse(response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(STATIC_CACHE);
  await cache.put('/', response);
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response.ok) cache.put(req, response.clone());
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkOnly(req) {
  return fetch(req);
}

async function cacheFirstLRU(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response.ok) {
      await cache.put(req, response.clone());
      trimCache(cacheName, maxEntries);
    }
    return response;
  } catch (_) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((response) => {
      if (response && response.ok) cache.put(req, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function staleWhileRevalidateLRU(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((response) => {
      if (response && response.ok) {
        cache.put(req, response.clone()).then(() => trimCache(cacheName, maxEntries)).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
  } catch (_) { /* ignore */ }
}

function timeoutFetch(req, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(req).then((res) => { clearTimeout(t); resolve(res); }, (err) => { clearTimeout(t); reject(err); });
  });
}

// ─── Web Push placeholders (wired in PR 2) ────────────────────────────────────
// The handlers below are intentionally minimal so the SW can already receive
// push events once VAPID + subscriptions are in place.

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = {}; }
  const title = payload.title || 'iPhoneRepasse Pro';
  const body = payload.body || '';
  const url = payload.url || '/';
  const tag = payload.tag || 'irp-default';
  const options = {
    body,
    tag,
    data: { url },
    icon: payload.icon || '/brand/icon-192.png',
    badge: payload.badge || '/brand/icon-192.png',
    silent: false,
    requireInteraction: !!payload.requireInteraction,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetUrl = new URL(url, self.location.origin);
    const isCrmPlusTarget = targetUrl.hash === '#/crmplus' || targetUrl.hash.startsWith('#/crmplus/');
    const target = isCrmPlusTarget
      ? all.find((c) => {
          try {
            const clientUrl = new URL(c.url);
            return clientUrl.origin === self.location.origin &&
              (clientUrl.hash === '#/crmplus' || clientUrl.hash.startsWith('#/crmplus/'));
          } catch (_) {
            return false;
          }
        }) || all.find((c) => c.url.includes(self.location.origin))
      : all.find((c) => c.url.includes(self.location.origin));
    if (target) {
      await target.focus();
      target.postMessage({ type: 'NAVIGATE', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
