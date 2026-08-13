# Conexión externa de SimuPLC HMI

## Modos disponibles

1. **Simulación:** Ladder/FBD se ejecuta en el navegador.
2. **USB / OTG:** SimuPLC usa Web Serial para comunicarse con Arduino.
3. **Wi-Fi / Internet:** SimuPLC usa WebSocket para comunicarse con ESP32 o con un servidor/gateway.

Todos usan el mismo protocolo:

```text
SET,I2,1
SET,I2,0
RUN,1
STOP
GET_STATE
STATE,I1,1,I2,0,Q1,1
```

## USB desde computadora

1. Carga `Arduino_USB_OTG/SimuPLC_HMI_USB_OTG.ino` en Arduino.
2. Abre SimuPLC desde HTTPS o localhost.
3. En HMI selecciona `USB / OTG`. En Windows puedes ejecutar `INICIAR_SIMUPLC_LOCAL.bat` para abrir la app desde localhost.
4. Pulsa `Conectar` y elige el puerto.
5. Entra en Operación y pulsa Iniciar.

## USB desde Android con OTG

1. Usa un teléfono/tablet Android compatible con USB Host/OTG.
2. Conecta el adaptador OTG y el cable de datos del Arduino.
3. Abre SimuPLC mediante HTTPS en un Chrome compatible con Web Serial.
4. Autoriza el dispositivo al tocar `Conectar`.

No abras la app como `file://index.html` para Web Serial: debe servirse mediante HTTPS o localhost.

## Wi-Fi con ESP32

1. Instala la librería `WebSockets` en Arduino IDE.
2. Carga `ESP32_WebSocket/SimuPLC_ESP32_WebSocket.ino`.
3. Conéctate a la red `SIMUPLC-HMI`, clave `simuplc123`.
4. En SimuPLC selecciona `Wi-Fi / Internet`.
5. Usa `ws://192.168.4.1:81/` y pulsa Conectar.

Para una conexión por internet, utiliza un endpoint `wss://` seguro mediante un servidor/gateway. No expongas directamente un ESP32 sin autenticación a internet.

## Seguridad eléctrica

Arduino o ESP32 solo entregan señales lógicas. Para activar cargas reales usa:

```text
Arduino/ESP32 -> optoacoplador o driver -> relé/contactor -> motor o bomba
```

La parada de emergencia física y las protecciones deben funcionar independientemente del navegador, Wi-Fi o microcontrolador.

## Generador integrado V12

Para un circuito creado en Ladder o FBD ya no necesitas cargar primero el ejemplo USB. Abre **CÓDIGO ARDUINO**, selecciona la comunicación HMI y descarga el único `.ino` generado. Ese archivo contiene la lógica del circuito y el protocolo de comunicación.

El ejemplo de esta carpeta se mantiene solamente para comprobar rápidamente el cable OTG y el protocolo.
