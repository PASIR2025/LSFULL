/*
  SimuPLC HMI V15 - Prueba de lazo cerrado

  I1 = STOP NC             -> D2, contacto físico a GND (cerrado en reposo)
  I2 = START NO            -> D3, pulsador físico a GND
  I3 = NIVEL ALTO          -> D4, electronivel físico a GND
  Q1 = MOTOR / BOMBA       -> D13, activo en HIGH para probar con LED integrado

  Origen de entradas:
  I1 = físico Y HMI
  I2 = físico O HMI
  I3 = físico O HMI

  Protocolo:
  SET,I2,1
  SET,I3,1
  STATE,I3,1,I3_PHYSICAL,0,I3_HMI,1,Q1,0,RUNNING,1
*/

#include <Arduino.h>

const byte PIN_I1 = 2;
const byte PIN_I2 = 3;
const byte PIN_I3 = 4;
const byte PIN_Q1 = 13;

const unsigned long SCAN_MS = 20;
const unsigned long STATE_MS = 100;
const unsigned long COMM_TIMEOUT_MS = 3000;

bool hmiI1 = true;
bool hmiI2 = false;
bool hmiI3 = false;

bool physicalI1 = false;
bool physicalI2 = false;
bool physicalI3 = false;

bool I1 = false;
bool I2 = false;
bool I3 = false;
bool Q1 = false;
bool running = false;

unsigned long lastScan = 0;
unsigned long lastState = 0;
unsigned long lastMessage = 0;
char rxLine[96];
byte rxIndex = 0;

void writeOutputs() {
  digitalWrite(PIN_Q1, Q1 ? HIGH : LOW);
}

void forceStop() {
  Q1 = false;
  writeOutputs();
}

void sendState() {
  Serial.print(F("STATE,I1,")); Serial.print(I1 ? 1 : 0);
  Serial.print(F(",I1_PHYSICAL,")); Serial.print(physicalI1 ? 1 : 0);
  Serial.print(F(",I1_HMI,")); Serial.print(hmiI1 ? 1 : 0);

  Serial.print(F(",I2,")); Serial.print(I2 ? 1 : 0);
  Serial.print(F(",I2_PHYSICAL,")); Serial.print(physicalI2 ? 1 : 0);
  Serial.print(F(",I2_HMI,")); Serial.print(hmiI2 ? 1 : 0);

  Serial.print(F(",I3,")); Serial.print(I3 ? 1 : 0);
  Serial.print(F(",I3_PHYSICAL,")); Serial.print(physicalI3 ? 1 : 0);
  Serial.print(F(",I3_HMI,")); Serial.print(hmiI3 ? 1 : 0);

  Serial.print(F(",Q1,")); Serial.print(Q1 ? 1 : 0);
  Serial.print(F(",RUNNING,")); Serial.println(running ? 1 : 0);
}

void setHmiInput(const char* tag, bool value) {
  if (strcmp(tag, "I1") == 0) hmiI1 = value;
  else if (strcmp(tag, "I2") == 0) hmiI2 = value;
  else if (strcmp(tag, "I3") == 0) hmiI3 = value;
}

void processCommand(char* command) {
  lastMessage = millis();

  if (strcmp(command, "PING") == 0) {
    Serial.println(F("PONG"));
    return;
  }
  if (strcmp(command, "GET_STATE") == 0) {
    sendState();
    return;
  }
  if (strcmp(command, "RUN") == 0 || strcmp(command, "RUN,1") == 0) {
    running = true;
    sendState();
    return;
  }
  if (strcmp(command, "STOP") == 0 || strcmp(command, "RUN,0") == 0) {
    running = false;
    forceStop();
    sendState();
    return;
  }
  if (strncmp(command, "HELLO", 5) == 0) {
    Serial.println(F("OK,SIMUPLC,READY_CODE_V15,1"));
    sendState();
    return;
  }

  char tag[10];
  int value = 0;
  if (sscanf(command, "SET,%9[^,],%d", tag, &value) == 2) {
    setHmiInput(tag, value != 0);
    sendState();
  }
}

void readCommands() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n') {
      rxLine[rxIndex] = '\0';
      if (rxIndex > 0) processCommand(rxLine);
      rxIndex = 0;
    } else if (c != '\r' && rxIndex < sizeof(rxLine) - 1) {
      rxLine[rxIndex++] = c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_I1, INPUT_PULLUP);
  pinMode(PIN_I2, INPUT_PULLUP);
  pinMode(PIN_I3, INPUT_PULLUP);
  pinMode(PIN_Q1, OUTPUT);
  forceStop();
  lastMessage = millis();
}

void loop() {
  readCommands();
  const unsigned long now = millis();

  if (now - lastScan >= SCAN_MS) {
    lastScan = now;

    // Con INPUT_PULLUP: señal física activa cuando el contacto conecta el pin a GND.
    physicalI1 = digitalRead(PIN_I1) == LOW;
    physicalI2 = digitalRead(PIN_I2) == LOW;
    physicalI3 = digitalRead(PIN_I3) == LOW;

    // Ambos obligatorios para STOP; cualquiera de los dos para START y NIVEL ALTO.
    I1 = physicalI1 && hmiI1;
    I2 = physicalI2 || hmiI2;
    I3 = physicalI3 || hmiI3;

    if (!running || !I1 || I3) {
      Q1 = false;
    } else if (I2 || Q1) {
      Q1 = true;
    }

    writeOutputs();
  }

  if (running && now - lastMessage > COMM_TIMEOUT_MS) {
    running = false;
    forceStop();
  }

  if (now - lastState >= STATE_MS) {
    lastState = now;
    sendState();
  }
}
