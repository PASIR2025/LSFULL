const CACHE_NAME = 'simuplc-lab-pwa-v11-stable';

const APP_SHELL = [
  './',
  './index.html',
  './ladder_mobile_compact.html',
  './manifest.json',
  './instalarpc.html',
  './privacy.html',
  './terms.html',
  './arduino512.jpg',
  './assets/css/app.css',
  './assets/js/main.js',
  './icons/cursos.png',
  './icons/miscursos.png',
  './icons/tutorial_logicsoft.png',
  './icons/icon-clean-sim.png',
  './icons/icon-fbd.png',
  './icons/icon-ladder.png',
  './icons/tiktok.png',
  './icons/youtube.png',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => key === CACHE_NAME ? Promise.resolve() : caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, {cache: 'no-store'});
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_error) {
    return (await caches.match(request)) || (await caches.match('./index.html'));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request, {cache: 'no-store'}));
    return;
  }

  const isNavigation =
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.html');

  event.respondWith(isNavigation ? networkFirst(request) : cacheFirst(request));
});
