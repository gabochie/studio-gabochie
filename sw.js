/* Studio Gabochie service worker — PWA phase 1 (shell + catalog offline). */

const VERSION = 'gabochie-v10';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
/* Cloudflare Pages serves clean URLs: /offline.html 308-redirects to /offline,
   so the redirect target is the only reliable precache key. */
const OFFLINE_URL = '/offline';

/* Precache the app shell only. Everything here is same-origin, small, and
   version-broken by VERSION, so a new deploy never serves a stale shell. */
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/nav.js',
  '/assets/js/main.js',
  '/assets/css/main.css',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
];

/* Public, idempotent catalog GETs — safe to serve stale-while-revalidate.
   Auth-scoped and mutating routes are deliberately absent. */
const RUNTIME_GET_PREFIXES = [
  '/api/programs',
  '/api/books',
  '/api/campaigns',
  '/api/testimonials',
  '/api/gallery',
  '/api/impact',
  '/api/tiers',
  '/api/subscription/plans',
  '/api/membership/plans',
  '/api/classifieds',
  '/api/careers',
];

/* Never cache. Auth, enrollments, payments and any URL carrying a token. */
const NETWORK_ONLY = [
  '/api/auth/',
  '/api/enroll/',
  '/api/membership/',
  '/api/payments/',
  '/api/gateways/',
  '/api/subscribe',
  '/api/survey/',
  '/api/contact',
  '/api/onboard',
  '/api/referral/',
  '/api/waitlist',
  '/api/admin/',
  '/api/agents/',
  '/api/db/',
  '/api/whatsapp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('gabochie-') && !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (fonts, Tabler icons CDN, checkout SDKs) and non-http(s) stay on the network.
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (NETWORK_ONLY.some((p) => path.startsWith(p))) return;
  if (url.searchParams.has('token')) return;

  // Navigations: prefer shell, fall back to cached page, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Static same-origin assets: cache-first, they are versioned by filename or precache.
  if (
    path.startsWith('/assets/') ||
    path === '/nav.js' ||
    path === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Catalog API: stale-while-revalidate.
  if (RUNTIME_GET_PREFIXES.some((p) => path.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (_err) {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || new Response('Offline', { status: 503 });
}