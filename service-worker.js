const CACHE_NAME = 'simuplc-hmi-v34-usb-v30-restored-20260718';

const APP_SHELL = [
  './',
  './index.html',
  './ladder_mobile_compact.html',
  './manifest.json',
  './instalarpc.html',
  './privacy.html',
  './terms.html',
  './diagnostico_usb_android.html',
  './arduino512.jpg',
  './assets/css/app.css',
  './assets/js/main.js',
  './assets/js/hmi-codegen-v17.js',
  './assets/js/webusb-serial-v19.js',
  './assets/js/hmi-global-control-v22.js',
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
  './icons/icon-512.png',
  './hardware/Arduino_USB_OTG/SimuPLC_HMI_USB_OTG.ino',
  './hardware/ESP32_WebSocket/SimuPLC_ESP32_WebSocket.ino',
  './hardware/GUIA_CONEXION_HMI.md',
  './hardware/PROTOCOLO_SIMUPLC_IO_V1.md',
  './GUIA_GENERADOR_HMI_V12.md',
  './GUIA_USB_ANDROID_V19.md',
  './GUIA_MODO_GLOBAL_V21.md',
  './GUIA_PROCESO_NEUMATICO_V22.md',
  './CAMBIOS_V34.txt',
  './README_SUBIR_A_GITHUB_V34.txt'
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
    const fresh = await fetch(request, { cache: 'no-store' });
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
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  const isNavigation = request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const isCriticalCode = url.pathname.endsWith('/service-worker.js') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/ladder_mobile_compact.html') || url.pathname.includes('/assets/js/');
  event.respondWith((isNavigation || isCriticalCode) ? networkFirst(request) : cacheFirst(request));
});
