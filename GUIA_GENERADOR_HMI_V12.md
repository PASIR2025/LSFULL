# Generador Arduino/ESP32 listo para HMI — V12

## Objetivo

El generador produce un único archivo `.ino` que contiene:

- La lógica creada en Ladder/KOP o FBD.
- Lectura de entradas físicas.
- Escritura de salidas físicas.
- Comunicación con el HMI.
- Comandos `SET`, `RUN`, `STOP`, `PING` y `GET_STATE`.
- Respuesta `STATE` con todas las entradas y salidas utilizadas.
- Detención por pérdida de comunicación, cuando está habilitada.

El archivo de ejemplo `hardware/Arduino_USB_OTG/SimuPLC_HMI_USB_OTG.ino` ya no es obligatorio para los circuitos nuevos. Se conserva como demostración.

## Cómo generar para Arduino USB/OTG

1. Crea el circuito en Ladder o FBD.
2. Asigna las mismas variables en el HMI, por ejemplo `I1`, `I2` y `Q1`.
3. Pulsa **CÓDIGO ARDUINO**.
4. Selecciona Arduino UNO, Nano, Mega o Leonardo.
5. En **Comunicación HMI integrada**, selecciona **USB / OTG**.
6. Asigna los pines físicos.
7. Configura el origen de cada entrada:
   - Solo física.
   - Solo HMI.
   - Física O HMI.
   - Física Y HMI.
8. Descarga el `.ino` y cárgalo en Arduino IDE.
9. Conecta el celular mediante OTG o la computadora mediante USB.
10. En el HMI selecciona USB/OTG, conecta y pulsa Iniciar.

## Cómo generar para ESP32/ESP8266

Selecciona ESP32 o ESP8266 y elige:

- Red propia: el controlador crea su Wi-Fi y un servidor WebSocket.
- Router local: el controlador se conecta a tu router y muestra su IP por Serial.
- Internet: el controlador se conecta como cliente a un relay WebSocket remoto.

Para ESP32/ESP8266 instala la librería **WebSockets by Markus Sattler (Links2004)** desde el Library Manager de Arduino IDE.

## Seguridad

Arduino o ESP32 no deben alimentar motores, contactores o electroválvulas directamente. Utiliza una etapa de interfaz, protección eléctrica y un paro de emergencia físico independiente del software.
