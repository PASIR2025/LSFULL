/*
  SimuPLC HMI V43 - Prueba de generador corregido
  Arduino Uno / Nano

  Circuito Ladder:
    I1 (D2) ---- Q1 (D13)

  Modo global predeterminado: SOLO HMI
  Polaridad Q1: activa en LOW
    I1 = 1 -> Q1 = 1 -> LED 13 apagado
    I1 = 0 -> Q1 = 0 -> LED 13 encendido

  Correcciones que valida:
  - El PLC empieza a ejecutar al recibir HELLO o el primer SET.
  - STOP se mantiene hasta recibir RUN nuevamente.
  - SET,I1,1 y SET,I1,0 ejecutan el scan inmediatamente.
  - El pin físico D2 se supervisa, pero no interviene en modo SOLO HMI.
*/

#include <Arduino.h>

const uint32_t HMI_BAUD_RATE = 115200UL;
const uint8_t PIN_I1 = 2;
const uint8_t PIN_Q1 = 13;
const bool OUTPUT_ACTIVE_LOW = true;

bool I1 = false;
bool Q1 = false;
bool i1Hmi = false;
bool i1Physical = false;
bool controllerRunning = false;
bool explicitStop = false;

char rxBuffer[128];
uint8_t rxLength = 0;
uint32_t lastStateMs = 0;
bool stateRequested = true;

void writeOutputs() {
  digitalWrite(PIN_Q1,
    Q1 ? (OUTPUT_ACTIVE_LOW ? LOW : HIGH)
       : (OUTPUT_ACTIVE_LOW ? HIGH : LOW));
}

void executeScan() {
  i1Physical = (digitalRead(PIN_I1) == LOW);
  I1 = i1Hmi; // SOLO HMI
  Q1 = controllerRunning && I1;
  writeOutputs();
}

void sendState() {
  Serial.print(F("STATE,I1,"));
  Serial.print(I1 ? '1' : '0');
  Serial.print(F(",I1_PHYSICAL,"));
  Serial.print(i1Physical ? '1' : '0');
  Serial.print(F(",I1_HMI,"));
  Serial.print(i1Hmi ? '1' : '0');
  Serial.print(F(",Q1,"));
  Serial.print(Q1 ? '1' : '0');
  Serial.print(F(",RUNNING,"));
  Serial.print(controllerRunning ? '1' : '0');
  Serial.println(F(",CONTROL_MODE,HMI"));
  lastStateMs = millis();
  stateRequested = false;
}

void startUnlessStopped() {
  if (!explicitStop) controllerRunning = true;
}

void processCommand(char* command) {
  while (*command == ' ' || *command == '\t') command++;
  size_t length = strlen(command);
  while (length && (command[length - 1] == ' ' || command[length - 1] == '\t')) {
    command[--length] = '\0';
  }
  if (!length) return;

  if (!strcmp(command, "PING")) {
    Serial.println(F("PONG"));
    return;
  }

  if (!strncmp(command, "HELLO", 5)) {
    startUnlessStopped();
    executeScan();
    Serial.println(F("OK,SIMUPLC,READY_CODE_V23,1"));
    sendState();
    return;
  }

  if (!strcmp(command, "GET_STATE")) {
    executeScan();
    sendState();
    return;
  }

  if (!strcmp(command, "RUN") || !strcmp(command, "RUN,1")) {
    explicitStop = false;
    controllerRunning = true;
    executeScan();
    sendState();
    return;
  }

  if (!strcmp(command, "STOP") || !strcmp(command, "RUN,0")) {
    explicitStop = true;
    controllerRunning = false;
    executeScan();
    sendState();
    return;
  }

  if (!strcmp(command, "MODE,HMI")) {
    startUnlessStopped();
    executeScan();
    sendState();
    return;
  }

  if (!strncmp(command, "SET,I1,", 7)) {
    i1Hmi = atoi(command + 7) != 0;
    startUnlessStopped();
    executeScan();
    sendState();
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
  pinMode(PIN_I1, INPUT_PULLUP);
  pinMode(PIN_Q1, OUTPUT);
  Q1 = false;
  writeOutputs();
  Serial.begin(HMI_BAUD_RATE);
}

void loop() {
  readSerial();
  executeScan();
  const uint32_t now = millis();
  if (stateRequested || (uint32_t)(now - lastStateMs) >= 1000UL) sendState();
  delay(5);
}
