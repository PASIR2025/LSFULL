# SimuPLC V18 — conexión USB/OTG en Android

## Modos disponibles

- **USB / OTG — Automático:** en laptop usa Web Serial; en Android anterior a Chrome 148 prioriza WebUSB.
- **USB / OTG — Web Serial:** recomendado para Chrome 148 o superior y computadoras.
- **USB / OTG — WebUSB Android:** respaldo para placas que exponen interfaces USB CDC-ACM.

## Orden de conexión

1. Cierra ArduinoDroid y cualquier monitor serial.
2. Conecta el adaptador OTG.
3. Conecta la placa Arduino con cable de datos.
4. Abre SimuPLC mediante HTTPS.
5. Abre la configuración de comunicación.
6. Selecciona **Automático** y pulsa **Conectar**.
7. Si Chrome indica que no encontró puertos, pulsa **Probar WebUSB Android**.
8. Selecciona la placa y acepta el permiso USB.

## Diagnóstico

El panel muestra:

- Android: sí/no
- versión de Chrome
- disponibilidad de Web Serial
- disponibilidad de WebUSB
- contexto HTTPS

## Compatibilidad

El respaldo WebUSB integrado está preparado para USB CDC-ACM, utilizado por muchas placas Arduino oficiales. Algunos clones con CH340, CP210x o FTDI no exponen CDC estándar. En esos casos usa Web Serial de Chrome actualizado o ESP32 por WebSocket Wi-Fi.
