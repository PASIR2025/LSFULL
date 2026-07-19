/*
  SimuPLC V42 - Prueba directa USB Android
  Arduino Uno / Nano compatible

  Comandos admitidos:
    HELLO,SIMUPLC,1
    PING
    SET,I1,1
    SET,I1,0
    GET_STATE
    1
    0

  La salida Q1 usa el LED integrado del pin 13 con lógica activa en LOW:
    I1 = 1 -> LED 13 apagado
    I1 = 0 -> LED 13 encendido
*/

#include <Arduino.h>

const uint32_t SERIAL_BAUD = 115200;
const uint8_t PIN_Q1 = 13;
const bool OUTPUT_ACTIVE_LOW = true;

char rxBuffer[96];
uint8_t rxLength = 0;
bool i1Hmi = false;
bool q1 = false;

void applyOutput() {
  q1 = i1Hmi;
  digitalWrite(PIN_Q1,
    q1 ? (OUTPUT_ACTIVE_LOW ? LOW : HIGH)
       : (OUTPUT_ACTIVE_LOW ? HIGH : LOW));
}

void sendState() {
  Serial.print(F("STATE,I1,"));
  Serial.print(i1Hmi ? '1' : '0');
  Serial.print(F(",I1_PHYSICAL,0,I1_HMI,"));
  Serial.print(i1Hmi ? '1' : '0');
  Serial.print(F(",Q1,"));
  Serial.print(q1 ? '1' : '0');
  Serial.println(F(",RUNNING,1,CONTROL_MODE,HMI"));
}

void setI1(bool value) {
  i1Hmi = value;
  applyOutput();
  Serial.print(F("ACK,I1,"));
  Serial.println(i1Hmi ? '1' : '0');
  sendState();
}

void processCommand(char *command) {
  while (*command == ' ' || *command == '\t') command++;
  size_t n = strlen(command);
  while (n > 0 && (command[n-1] == ' ' || command[n-1] == '\t')) {
    command[--n] = '\0';
  }

  if (!strcmp(command, "1")) { setI1(true); return; }
  if (!strcmp(command, "0")) { setI1(false); return; }
  if (!strcmp(command, "PING")) { Serial.println(F("PONG")); return; }
  if (!strcmp(command, "GET_STATE")) { sendState(); return; }
  if (!strncmp(command, "HELLO", 5)) {
    Serial.println(F("OK,SIMUPLC,READY_V42,1"));
    sendState();
    return;
  }
  if (!strcmp(command, "RUN") || !strcmp(command, "RUN,1")) {
    Serial.println(F("ACK,RUN,1"));
    sendState();
    return;
  }
  if (!strcmp(command, "STOP") || !strcmp(command, "RUN,0")) {
    setI1(false);
    return;
  }
  if (!strncmp(command, "SET,I1,", 7)) {
    setI1(atoi(command + 7) != 0);
    return;
  }
  Serial.println(F("ERROR,COMANDO_NO_RECONOCIDO"));
}

void readSerial() {
  while (Serial.available() > 0) {
    const char c = (char)Serial.read();
    if (c == '\n') {
      rxBuffer[rxLength] = '\0';
      if (rxLength) processCommand(rxBuffer);
      rxLength = 0;
    } else if (c != '\r') {
      if (rxLength < sizeof(rxBuffer) - 1) rxBuffer[rxLength++] = c;
      else rxLength = 0;
    }
  }
}

void setup() {
  pinMode(PIN_Q1, OUTPUT);
  i1Hmi = false;
  applyOutput();

  // Señal visual de que el firmware V42 está cargado.
  for (uint8_t i = 0; i < 3; i++) {
    digitalWrite(PIN_Q1, OUTPUT_ACTIVE_LOW ? LOW : HIGH);
    delay(120);
    digitalWrite(PIN_Q1, OUTPUT_ACTIVE_LOW ? HIGH : LOW);
    delay(120);
  }

  Serial.begin(SERIAL_BAUD);
}

void loop() {
  readSerial();
}
