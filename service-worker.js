/*
  SimuPLC Lab PWA Service Worker
  PWA real + Premium seguro:
  - Network First para HTML/navegación.
  - No devuelve index.html viejo si hay internet.
  - No interfiere con Apps Script ni APIs externas.
  - Limpia cachés antiguas.
*/

const CACHE_NAME = 'simuplc-lab-pwa-v5-fullscreen';
const STATIC_CACHE = [
  './manifest.json',
  './ladder_mobile_compact.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE).catch(() => Promise.resolve());
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('./index.html');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  // Apps Script / APIs externas: siempre red, sin cache.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // HTML y navegación: red primero.
  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets: cache primero.
  event.respondWith(cacheFirst(request));
});
