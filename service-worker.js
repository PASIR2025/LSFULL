const CACHE_NAME = 'simuplc-1-2-plc-global-v16-hmi-edge-drag-v24-5';

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
  './assets/js/billing-config.js',
  './diagnostico_usb_android.html',
  './assets/js/webusb-serial-v21.js',
  './assets/js/hmi-global-control-v23.js',
  './hardware/Arduino_USB_OTG/SimuPLC_HMI_USB_OTG.ino',
  './hardware/ESP32_WebSocket/SimuPLC_ESP32_WebSocket.ino',
  './hardware/GUIA_CONEXION_HMI.md',
  './assets/js/core/app-config.js',
  './assets/js/core/storage-safe.js',
  './assets/js/core/project-schema.js',
  './assets/js/core/plc-profile.js',
  './assets/js/core/plc-profile-ui.js',
  './assets/js/core/editor-frame-bridge.js',
  './assets/js/core/editor-service.js',
  './assets/js/fbd/fbd-simulation-engine.js',
  './assets/js/fbd/fbd-simulation-view.js',
  './assets/js/fbd/fbd-simulation-service.js',
  './assets/js/fbd/fbd-selection-service.js',
  './assets/js/fbd/fbd-wire-geometry.js',
  './assets/js/fbd/fbd-wiring-service.js',
  './assets/js/fbd/fbd-movement-service.js',
  './assets/js/fbd/fbd-component-service.js',
  './assets/js/shared/analog-block-catalog.js',
  './assets/js/fbd/fbd-analog-service.js',
  './assets/js/shared/text-palette.js',
  './assets/js/fbd/fbd-documentation-service.js',
  './assets/js/codegen/esp32-codegen.js',
  './assets/js/codegen/mcu-codegen-controller.js',
  './assets/js/codegen/variable-manager.js',
  './assets/js/ladder/ladder-documentation-service.js',
  './assets/js/ladder/ladder-plc-profile.js',
  './assets/js/ladder/ladder-analog-input-service.js',
  './assets/js/ladder/ladder-analog-processing-service.js',
  './assets/js/ladder/ladder-wiring-service.js',
  './assets/js/core/project-repository.js',
  './assets/js/core/project-io.js',
  './assets/js/core/phase1-bootstrap.js',
  './assets/js/core/recovery-manager.js',
  './assets/js/core/action-controller.js',
  './assets/js/core/ladder-foundation.js',
  './assets/js/core/ladder-host-bridge.js',
  './assets/js/core/ladder-recovery-bridge.js',
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
  './assets/js/pid/pid-fbd-extension.js',
  './assets/js/pid/pid-ladder-extension.js'
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
