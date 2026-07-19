# SimuPLC V19 — USB/OTG Android

## Qué se corrigió

V19 incorpora controladores WebUSB reales para:

- USB CDC-ACM
- CH340 / CH341
- CP210x
- FTDI

En Android, la opción **USB / OTG — Automático** selecciona WebUSB directamente. En PC continúa utilizando Web Serial.

## Conexión

1. Cierra completamente ArduinoDroid y cualquier monitor serial.
2. Desconecta el Arduino del OTG.
3. Cierra las pestañas anteriores de SimuPLC.
4. Borra los datos del sitio o desinstala la PWA anterior.
5. Conecta el adaptador OTG y luego el Arduino.
6. Abre SimuPLC mediante HTTPS.
7. Selecciona **USB / OTG — Automático (PC/Android)**.
8. Pulsa **Conectar** y selecciona la placa en el cuadro de Android.
9. Verifica que el panel muestre producto, driver y VID/PID.

## Diagnóstico independiente

Abre `diagnostico_usb_android.html` desde la misma dirección de GitHub Pages.

La página permite:

- comprobar HTTPS y WebUSB;
- seleccionar la placa;
- identificar el chip USB;
- abrir el puerto a 115200 baudios;
- enviar `HELLO` y `GET_STATE`.

## Código Arduino

El protocolo no cambió. El código Arduino HMI V17 permanece compatible.
