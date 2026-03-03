/* Offline-first Service Worker for LogicSim (GitHub Pages friendly) */
const CACHE = "logicsim-offline-v4";
const PRECACHE = [
  "./",
  "./INDEX_PWA.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Navegación: devolver la app desde caché
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./INDEX_PWA.html").then((cached) => cached || fetch(req).catch(() => cached))
    );
    return;
  }

  // Cache-first + runtime caching
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
