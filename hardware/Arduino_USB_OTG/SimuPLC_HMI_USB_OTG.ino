#include <Arduino.h>

/*
  SimuPLC V42 - prueba I1/Q1

  I1 físico: D2 con INPUT_PULLUP, pulsador entre D2 y GND.
  Q1: D13, salida activa en LOW.

  Modos en tiempo real:
    MODE,HMI
    MODE,PHYSICAL
    MODE,BOTH

  Comandos:
    HELLO,SIMUPLC,1
    RUN,1
    STOP
    SET,I1,1
    SET,I1,0
    GET_STATE
    PING
*/

const uint8_t PIN_I1 = 2;
const uint8_t PIN_Q1 = 13;
const uint32_t BAUD_RATE = 115200UL;
const uint32_t STATE_PERIOD_MS = 1000UL;

const uint8_t MODE_BOTH = 0;
const uint8_t MODE_HMI = 1;
const uint8_t MODE_PHYSICAL = 2;

uint8_t controlMode = MODE_HMI;
bool running = false;
bool hmiI1 = false;
bool physicalI1 = false;
bool logicalI1 = false;
bool q1 = false;

bool lastPhysicalI1 = false;
bool lastHmiI1 = false;
bool lastLogicalI1 = false;
bool lastQ1 = false;
bool lastRunning = false;
uint8_t lastMode = 255;
uint32_t lastStateMs = 0;

char rxBuffer[96];
uint8_t rxLength = 0;

const char* modeName() {
  if (controlMode == MODE_HMI) return "HMI";
  if (controlMode == MODE_PHYSICAL) return "PHYSICAL";
  return "BOTH";
}

void writeOutput() {
  // Q1 lógico 1 = D13 LOW = LED integrado apagado.
  digitalWrite(PIN_Q1, q1 ? LOW : HIGH);
}

void scanLogic() {
  physicalI1 = digitalRead(PIN_I1) == LOW;

  if (controlMode == MODE_HMI) logicalI1 = hmiI1;
  else if (controlMode == MODE_PHYSICAL) logicalI1 = physicalI1;
  else logicalI1 = physicalI1 || hmiI1;

  q1 = running && logicalI1;
  writeOutput();
}

void sendState() {
  Serial.print(F("STATE,I1,"));
  Serial.print(logicalI1 ? 1 : 0);
  Serial.print(F(",I1_PHYSICAL,"));
  Serial.print(physicalI1 ? 1 : 0);
  Serial.print(F(",I1_HMI,"));
  Serial.print(hmiI1 ? 1 : 0);
  Serial.print(F(",Q1,"));
  Serial.print(q1 ? 1 : 0);
  Serial.print(F(",RUNNING,"));
  Serial.print(running ? 1 : 0);
  Serial.print(F(",CONTROL_MODE,"));
  Serial.println(modeName());
  lastStateMs = millis();
}

void sendAck(const char* subject, const char* value) {
  Serial.print(F("ACK,"));
  Serial.print(subject);
  Serial.print(',');
  Serial.println(value);
}

bool stateChanged() {
  const bool changed =
    physicalI1 != lastPhysicalI1 ||
    hmiI1 != lastHmiI1 ||
    logicalI1 != lastLogicalI1 ||
    q1 != lastQ1 ||
    running != lastRunning ||
    controlMode != lastMode;

  lastPhysicalI1 = physicalI1;
  lastHmiI1 = hmiI1;
  lastLogicalI1 = logicalI1;
  lastQ1 = q1;
  lastRunning = running;
  lastMode = controlMode;
  return changed;
}

void processCommand(char* command) {
  while (*command == ' ') command++;
  if (*command == '\0') return;

  if (strcmp(command, "PING") == 0) {
    Serial.println(F("PONG"));
    return;
  }

  if (strcmp(command, "GET_STATE") == 0) {
    scanLogic();
    sendState();
    return;
  }

  if (strncmp(command, "HELLO", 5) == 0) {
    Serial.println(F("OK,SIMUPLC,READY_CODE_V42,1"));
    scanLogic();
    sendState();
    return;
  }

  if (strcmp(command, "RUN") == 0 || strcmp(command, "RUN,1") == 0) {
    running = true;
    sendAck("RUN", "1");
    scanLogic();
    sendState();
    return;
  }

  if (strcmp(command, "STOP") == 0 || strcmp(command, "RUN,0") == 0) {
    running = false;
    sendAck("RUN", "0");
    scanLogic();
    sendState();
    return;
  }

  if (strcmp(command, "MODE,HMI") == 0) {
    controlMode = MODE_HMI;
    sendAck("MODE", "HMI");
    scanLogic();
    sendState();
    return;
  }

  if (strcmp(command, "MODE,PHYSICAL") == 0 || strcmp(command, "MODE,FISICO") == 0) {
    controlMode = MODE_PHYSICAL;
    sendAck("MODE", "PHYSICAL");
    scanLogic();
    sendState();
    return;
  }

  if (strcmp(command, "MODE,BOTH") == 0 || strcmp(command, "MODE,AMBOS") == 0) {
    controlMode = MODE_BOTH;
    sendAck("MODE", "BOTH");
    scanLogic();
    sendState();
    return;
  }

  if (strncmp(command, "SET,I1,", 7) == 0) {
    hmiI1 = atoi(command + 7) != 0;
    sendAck("I1", hmiI1 ? "1" : "0");
    scanLogic();
    sendState();
    return;
  }

  Serial.println(F("ERROR,COMANDO_NO_RECONOCIDO"));
}

void readCommands() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n') {
      rxBuffer[rxLength] = '\0';
      if (rxLength > 0) processCommand(rxBuffer);
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
  writeOutput();
  Serial.begin(BAUD_RATE);
}

void loop() {
  readCommands();
  scanLogic();

  if (stateChanged() || millis() - lastStateMs >= STATE_PERIOD_MS) {
    sendState();
  }

  delay(2);
}
