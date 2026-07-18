# SimuPLC V33 — USB/OTG Android (motor WebUSB V20)

La aplicación incluye conexión WebUSB para:

- Arduino CDC-ACM.
- CH340 / CH341 / CH343 / CH9102.
- CP210x.
- FTDI.
- Otras placas que expongan canales USB bulk compatibles.

## Conexión recomendada

1. Usa un cable OTG que permita transferencia de datos.
2. Cierra ArduinoDroid, Serial USB Terminal y cualquier app que use el Arduino.
3. Conecta la placa al celular o tablet.
4. Abre SimuPLC mediante HTTPS.
5. Entra al HMI y pulsa **Conectar**.
6. En Android selecciona la placa USB y acepta el permiso.
7. La app probará automáticamente 115200, 9600, 57600 y 230400 baudios.

En Android el selector muestra todos los USB conectados para evitar que algunos Arduino compatibles queden ocultos por los filtros del navegador.

## Cuando la PWA o APK no muestra WebUSB

Algunos contenedores instalados pueden no exponer `navigator.usb`. En ese caso la ventana de conexión mostrará **Abrir en Chrome**. Usa ese botón y conecta desde Chrome con la misma dirección de SimuPLC.

## Diagnóstico

Abre `diagnostico_usb_android.html` para comprobar:

- HTTPS;
- WebUSB;
- versión del motor USB;
- placa seleccionada;
- driver detectado;
- apertura del puerto a 115200 baudios.
