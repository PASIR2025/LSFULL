# LOGICSOFT PWA

Proyecto organizado y listo para móvil/tablet (vertical y horizontal).

## Estructura
- `index.html` — Tu app principal (incluye botón "Nuevo").
- `manifest.json` — Config PWA (ajusta `name`, `short_name`, `theme_color` si gustas).
- `service-worker.js` — Cache-first básico con versión `logicsoft-cache-v1`.
- `icons/` — Coloca aquí tus íconos (`icon-192.png`, `icon-512.png`, y maskable si tienes).
- `assets/css/app.css` — Estilos base responsive.
- `assets/js/main.js` — Recalcula layout al rotar/cambiar viewport.
- `assets/js/core/*` y `assets/js/ui/*` — (Opcional) mueve aquí tus módulos si separas tu código.
- `data/` — Presets o ejemplos de circuitos.
- `docs/` — Notas/changelog.

## Instalación local
1. Sirve la carpeta con un servidor estático (por ejemplo):
   - `python -m http.server 8080` (Python 3)
   - o cualquier plugin de Live Server.
2. Abre `http://localhost:8080`.
3. Acepta instalar como PWA desde el navegador (o "Añadir a pantalla de inicio").

## Producción
- Sube todo el contenido al hosting (Netlify, GitHub Pages*, Vercel, Firebase, etc.).
- *Si usas GitHub Pages, coloca los paths desde la raíz del repo y evita rutas absolutas.

## Cambios en caché
- Cada vez que actualices assets, incrementa `CACHE_NAME` en `service-worker.js` (p.ej. `logicsoft-cache-v2`).

## Iconos
- Ubica tus iconos en `./icons/` y asegúrate que los nombres coincidan con `manifest.json`.