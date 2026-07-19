# Relay WebSocket para conexión por Internet

Esta carpeta es una base para la futura conexión remota entre el HMI y un ESP32/ESP8266.

1. Instala Node.js.
2. Ejecuta `npm install`.
3. Ejecuta `npm start`.
4. En una red local usa `ws://IP_DEL_SERVIDOR:8080/simuplc`.
5. Para Internet debes publicar el servicio detrás de HTTPS y usar `wss://`.

El relay incluido es didáctico. Antes de usarlo en producción agrega autenticación, identificación por equipo, cifrado TLS y control de permisos.
