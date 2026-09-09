/*
 * SimuPLC Service Worker - Offline v15
 *
 * Objetivos de esta version:
 *  - Permitir que los recursos versionados con ?v=... se resuelvan desde cache.
 *  - Precargar FBD, Ladder, Control y HMI para uso sin Internet.
 *  - Mantener network-first para paginas HTML y cache-first para recursos estaticos.
 *  - No modificar la logica de Google Play Billing ni de licencias.
 */

const CACHE_NAME = 'simuplc-1-2-offline-v15';

const APP_SHELL = [
  './',
  './index.html',
  './control.html',
  './hmi.html',
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
  './assets/js/control/control-host.js',
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

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Se cachean todos los archivos criticos. Si falta alguno, es preferible
    // conservar el Service Worker anterior antes que instalar una cache parcial.
    await cache.addAll(APP_SHELL);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

/**
 * Busca una solicitud en cache ignorando parametros de version como ?v=16.
 * De esta forma "plc-profile.js?v=16" puede usar "plc-profile.js" precacheado.
 */
async function matchCached(request) {
  return caches.match(request, { ignoreSearch: true });
}

/**
 * Devuelve el HTML apropiado para una navegacion offline.
 * Evita que control.html/hmi.html reciban index.html por error.
 */
async function navigationFallback(url) {
  const path = url.pathname.toLowerCase();

  if (path.endsWith('/control.html') || path.endsWith('control.html')) {
    return matchCached(new Request(new URL('./control.html', self.location.href)));
  }

  if (path.endsWith('/hmi.html') || path.endsWith('hmi.html')) {
    return matchCached(new Request(new URL('./hmi.html', self.location.href)));
  }

  if (path.endsWith('/ladder_mobile_compact.html') || path.endsWith('ladder_mobile_compact.html')) {
    return matchCached(new Request(new URL('./ladder_mobile_compact.html', self.location.href)));
  }

  return matchCached(new Request(new URL('./index.html', self.location.href)));
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });

    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    }

    // Si el servidor responde con error, intentamos conservar una copia local valida.
    return (await matchCached(request)) || fresh;
  } catch (_error) {
    const cached = await matchCached(request);
    if (cached) return cached;

    const url = new URL(request.url);
    const fallback = await navigationFallback(url);
    if (fallback) return fallback;

    return new Response('SimuPLC no pudo cargar esta pagina sin conexion.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function cacheFirst(request) {
  const cached = await matchCached(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (_error) {
    // La solicitud no estaba en cache y no existe red. Evitamos una promesa rechazada.
    return new Response('', {
      status: 503,
      statusText: 'Offline'
    });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // No interceptamos recursos externos. Google Play Billing, Apps Script y otros
  // servicios conservan exactamente su comportamiento de red original.
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.html');

  event.respondWith(
    isNavigation ? networkFirst(request) : cacheFirst(request)
  );
});
