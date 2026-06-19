const APP_VERSION = 'v2';
const STATIC_CACHE = `freshtable-static-${APP_VERSION}`;
const API_CACHE = `freshtable-api-${APP_VERSION}`;
const IMAGE_CACHE = `freshtable-images-${APP_VERSION}`;
const CORE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, API_CACHE, IMAGE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls.filter((url) => typeof url === 'string' && url.startsWith('/'));
    event.waitUntil(
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(urls)).catch(() => undefined)
    );
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(STATIC_CACHE);
          if (response && response.ok) {
            cache.put('/', response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match(request)) || (await cache.match('/')) || (await cache.match('/offline.html'));
        })
    );
    return;
  }

  if (!isSameOrigin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(request, API_CACHE).catch(
        () => new Response(JSON.stringify({ offline: true, message: '오프라인 상태입니다.' }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          status: 503
        })
      )
    );
    return;
  }

  if (url.pathname.startsWith('/icons/') || /\.(?:png|jpg|jpeg|svg|webp|gif)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    /\.(?:css|js|json|woff2?)$/i.test(url.pathname) ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
