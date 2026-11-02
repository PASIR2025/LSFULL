# SimuPLC — Programación directa de Arduino UNO (prueba V1)

Esta copia añade una primera implementación aislada para **Arduino UNO R3 / ATmega328P** sin modificar el repositorio original.

## Flujo
1. SimuPLC genera el `.ino` como ya lo hacía.
2. El botón **⚡ Programar Arduino UNO** envía ese sketch al compilador de SimuPLC.
3. El backend compila con `arduino-cli` para `arduino:avr:uno` y devuelve Intel HEX.
4. El navegador carga el HEX al bootloader del UNO mediante STK500v1 a 115200 baudios por Web Serial o el respaldo WebUSB existente.

## Backend de compilación
Está en `backend/arduino-compiler/` y está preparado como contenedor para Cloud Run u otro servicio Docker.

Después de desplegarlo, configura la URL desde la consola del navegador una sola vez:

```js
SimuPLCArduinoUNO.setCompileEndpoint('https://TU-SERVICIO/compile')
```

También puedes definir antes de cargar el script:

```html
<script>window.SIMUPLC_UNO_COMPILE_ENDPOINT='https://TU-SERVICIO/compile';</script>
```

## Prueba recomendada
- Arduino UNO R3 primero.
- Cable USB de datos; en Android, adaptador OTG.
- Abrir SimuPLC por HTTPS.
- Generar el código Arduino y revisar pines.
- Pulsar **Programar Arduino UNO**.
- Autorizar el dispositivo USB cuando el navegador lo solicite.
- Durante la carga no debe haber otra conexión HMI/monitor serie usando el mismo puerto.

## Alcance de V1
El objetivo es validar el flujo completo UNO: generar → compilar → cargar. No se ha habilitado todavía programación directa para Mega, Nano, Leonardo ni ESP32.
