/*
  SimuPLC HMI - Plantilla ESP32 por Wi-Fi / WebSocket

  Librería requerida desde Arduino Library Manager:
    WebSockets by Markus Sattler (Links2004)

  El ESP32 crea la red:
    SSID: SIMUPLC-HMI
    Clave: simuplc123
    WebSocket: ws://192.168.4.1:81/

  Protocolo compatible con la conexión USB de SimuPLC.
*/

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <string.h>
#include <stdio.h>

const char* AP_SSID = "SIMUPLC-HMI";
const char* AP_PASSWORD = "simuplc123";
constexpr uint8_t PIN_Q1 = 18;
constexpr bool OUTPUT_ACTIVE_LOW = false;
constexpr uint32_t STATE_PERIOD_MS = 120;

WebSocketsServer webSocket(81);
bool i1 = true;   // STOP NC virtual
bool i2 = false;  // START NO virtual
bool q1 = false;
bool runEnabled = false;
uint32_t lastStateMs = 0;

void writeQ1() {
  digitalWrite(PIN_Q1, q1 ? (OUTPUT_ACTIVE_LOW ? LOW : HIGH)
                          : (OUTPUT_ACTIVE_LOW ? HIGH : LOW));
}

String stateLine() {
  return String("STATE,I1,") + (i1 ? "1" : "0") +
         ",I2," + (i2 ? "1" : "0") +
         ",Q1," + (q1 ? "1" : "0") +
         ",RUNNING," + (runEnabled ? "1" : "0") + "\n";
}

void broadcastState() {
  webSocket.broadcastTXT(stateLine());
}

void processCommand(uint8_t client, String command) {
  command.trim();
  if (command == "PING") { webSocket.sendTXT(client, "PONG\n"); return; }
  if (command == "GET_STATE") { webSocket.sendTXT(client, stateLine()); return; }
  if (command == "RUN,1") { runEnabled = true; broadcastState(); return; }
  if (command == "RUN,0" || command == "STOP") {
    runEnabled = false; q1 = false; writeQ1(); broadcastState(); return;
  }
  if (command.startsWith("HELLO")) {
    webSocket.sendTXT(client, "OK,SIMUPLC,ESP32,1\n");
    webSocket.sendTXT(client, stateLine());
    return;
  }

  char tag[12] = {0};
  int value = 0;
  if (sscanf(command.c_str(), "SET,%11[^,],%d", tag, &value) == 2) {
    if (strcmp(tag, "I1") == 0) i1 = value != 0;
    else if (strcmp(tag, "I2") == 0) i2 = value != 0;
    broadcastState();
  }
}

void webSocketEvent(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_TEXT) {
    String message;
    message.reserve(length);
    for (size_t i = 0; i < length; i++) message += static_cast<char>(payload[i]);
    int start = 0;
    while (start < message.length()) {
      int end = message.indexOf('\n', start);
      if (end < 0) end = message.length();
      String line = message.substring(start, end);
      if (line.length()) processCommand(client, line);
      start = end + 1;
    }
  } else if (type == WStype_CONNECTED) {
    webSocket.sendTXT(client, stateLine());
  }
}

void executePlcLogic() {
  if (!runEnabled || !i1) q1 = false;
  else if (i2) q1 = true;
  writeQ1();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_Q1, OUTPUT);
  writeQ1();

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  Serial.print("Red: "); Serial.println(AP_SSID);
  Serial.print("IP: "); Serial.println(WiFi.softAPIP());
}

void loop() {
  webSocket.loop();
  executePlcLogic();
  if (millis() - lastStateMs >= STATE_PERIOD_MS) {
    lastStateMs = millis();
    broadcastState();
  }
}
