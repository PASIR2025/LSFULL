# Pruebas de la Fase 1

Ejecutar desde la carpeta principal:

```bash
node tools/tests/static-checks.mjs
node tools/tests/pwa-shell-check.mjs
python3 tools/tests/browser-smoke.py
```

Las pruebas cubren:

- sintaxis JavaScript interna y externa;
- existencia de recursos locales;
- caché PWA de los módulos nuevos;
- carga FBD;
- corrección de numeración al guardar y abrir;
- creación y validación del proyecto canónico;
- carga del iframe Ladder y disponibilidad de su API.

## Paso 2

También se comprueba:

- controlador único enlazado a todos los botones;
- un clic en Guardar produce un solo diálogo y un solo registro;
- Guardar distingue correctamente FBD y Ladder;
- Nuevo reinicia una sola vez el editor activo;
- Exportar crea una sola descarga;
- Importar abre una sola vez el selector y ejecuta un solo cargador;
- abrir, renombrar y eliminar circuitos guardados;
- ausencia de errores JavaScript durante las pruebas.

## Paso 3 — Autoguardado y recuperación

Ejecutar:

```bash
node tools/tests/static-checks.mjs
python tools/tests/browser-smoke.py
python tools/tests/integration-recovery.py
```

Resultados esperados:

- Todas las pruebas terminan con código 0.
- No aparecen errores JavaScript.
- La importación dañada conserva el circuito abierto.
- El historial se limita a ocho respaldos.
- El trabajo pendiente se recupera después de reiniciar.

## Paso 4 — Repositorio y servicio de proyectos

Ejecutar:

```bash
node tools/tests/static-checks.mjs
python3 tools/tests/browser-smoke.py
python3 tools/tests/integration-recovery.py
python3 tools/tests/project-modules.py
```

También se comprueba:

- que el controlador ya no contenga las funciones de almacenamiento retiradas;
- que los módulos nuevos estén incluidos en `index.html` y en la caché PWA;
- operaciones CRUD de “Mis circuitos”;
- apertura de un circuito FBD a través del controlador;
- captura, migración y validación de proyectos;
- diagnósticos correctos de repositorio y servicio de proyectos.

## Paso 5 — Puente y servicio común de editores

Ejecutar:

```bash
node tools/tests/static-checks.mjs
node tools/tests/pwa-shell-check.mjs
python3 tools/tests/editor-bridge.py
python3 tools/tests/browser-smoke.py
python3 tools/tests/integration-recovery.py
python3 tools/tests/project-modules.py
```

También se comprueba:

- que el controlador inline antiguo FBD/Ladder ya no esté activo;
- que los tres módulos nuevos se carguen y formen parte de la caché PWA;
- disponibilidad del protocolo `simuplc-editor-bridge-v1`;
- lectura, carga y reinicio de Ladder mediante el puente;
- etiquetas y código Arduino Ladder mediante la API común;
- eventos de cambios Ladder;
- cero solicitudes pendientes y cero tiempos de espera en la prueba integral;
- continuidad de Guardar, Importar, Exportar, autoguardado y recuperación.

## Paso 6
- Pruebas estáticas de módulos FBD.
- Creación, selección, arrastre y eliminación.
- Regresión de guardado, recuperación y Ladder.

## Paso 7
- Crear conexión tocando salida y entrada.
- Crear conexión comenzando por la entrada.
- Rechazar conexión duplicada.
- Rechazar conexión dentro del mismo bloque.
- Añadir y mover nodo intermedio.
- Convertir cable a etiquetas.
- Eliminar cable sin elementos SVG fantasma.
- Mover bloques conectados y actualizar el recorrido.

## Paso 8 — Motor modular de simulación FBD

Ejecutar:

```bash
node tools/tests/static-checks.mjs
node tools/tests/pwa-shell-check.mjs
node tools/tests/fbd-simulation-engine.mjs
python3 tools/tests/fbd-simulation.py
python3 tools/tests/browser-smoke.py
python3 tools/tests/integration-recovery.py
python3 tools/tests/project-modules.py
python3 tools/tests/editor-bridge.py
```

También se comprueba:

- todas las compuertas digitales;
- inversión de entradas;
- memoria SR;
- TON y TOFF con tiempo controlado;
- contador ascendente, descendente y reset;
- propagación hacia salidas en el mismo escaneo;
- limpieza total al detener;
- conservación de guardado, recuperación y Ladder;
- ausencia del algoritmo antiguo dentro de `index.html`.

## Fase 2 — Paso 3: sistema analógico FBD

- Entrada AI: RAW, escalamiento y unidad de ingeniería.
- Cadena AI → comparador → salida digital.
- Cadena AI → SCALE → comparador → salida digital.
- Comparadores `>`, `<`, `=`, `>=` y `<=`.
- Igualdad con tolerancia.
- Histéresis con retención entre umbrales.
- Guardado y restauración de parámetros analógicos.
- Numeración AI después de cargar un proyecto.
- Inserción táctil desde la biblioteca.
- Modal de configuración dentro del viewport móvil.
- Regresión de AND, SR, TON, TOFF y contador.
- PWA con el módulo analógico precargado.
