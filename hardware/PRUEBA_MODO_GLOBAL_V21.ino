#include <Arduino.h>

/*
  SimuPLC HMI V21 - Prueba de modo global

  I1 START NO      -> D2, pulsador a GND
  I2 STOP NC       -> D3, contacto NC a GND
  I3 NIVEL ALTO NO -> D4, sensor a GND
  Q1 MOTOR         -> D13, activo en HIGH para probar el LED integrado

  Comandos:
    MODE,HMI
    MODE,PHYSICAL
    MODE,BOTH
    SET,I1,1
    SET,I2,0
    SET,I3,1
    RUN,1
    STOP
    GET_STATE
*/

const uint8_t PIN_I1 = 2;
const uint8_t PIN_I2 = 3;
const uint8_t PIN_I3 = 4;
const uint8_t PIN_Q1 = 13;

const uint8_t MODE_BOTH = 0;
const uint8_t MODE_HMI = 1;
const uint8_t MODE_PHYSICAL = 2;

uint8_t controlMode = MODE_BOTH;
bool controllerRunning = true;

bool physicalInputs[3] = {false, true, false};
bool hmiInputs[3] = {false, true, false};
bool effectiveInputs[3] = {false, true, false};
bool q1 = false;

char rxBuffer[96];
uint8_t rxLength = 0;
unsigned long lastScan = 0;
unsigned long lastState = 0;
bool scanRequested = true;
bool stateRequested = true;

const char* modeName() {
  if (controlMode == MODE_HMI) return "HMI";
  if (controlMode == MODE_PHYSICAL) return "PHYSICAL";
  return "BOTH";
}

bool combineInput(uint8_t index, bool physicalValue) {
  if (controlMode == MODE_HMI) return hmiInputs[index];
  if (controlMode == MODE_PHYSICAL) return physicalValue;

  // I2 es NC: cualquiera puede abrir y detener.
  if (index == 1) return physicalValue && hmiInputs[index];

  // I1 e I3 son NO: cualquiera puede activar.
  return physicalValue || hmiInputs[index];
}

void readInputs() {
  physicalInputs[0] = digitalRead(PIN_I1) == LOW;
  physicalInputs[1] = digitalRead(PIN_I2) == LOW;
  physicalInputs[2] = digitalRead(PIN_I3) == LOW;

  for (uint8_t i = 0; i < 3; i++) {
    effectiveInputs[i] = combineInput(i, physicalInputs[i]);
  }
}

void executeLogic() {
  if (!controllerRunning || !effectiveInputs[1] || effectiveInputs[2]) {
    q1 = false;
  } else if (effectiveInputs[0]) {
    q1 = true;
  }
  digitalWrite(PIN_Q1, q1 ? HIGH : LOW);
}

void sendState() {
  Serial.print("STATE,I1,"); Serial.print(effectiveInputs[0] ? 1 : 0);
  Serial.print(",I1_PHYSICAL,"); Serial.print(physicalInputs[0] ? 1 : 0);
  Serial.print(",I1_HMI,"); Serial.print(hmiInputs[0] ? 1 : 0);
  Serial.print(",I2,"); Serial.print(effectiveInputs[1] ? 1 : 0);
  Serial.print(",I2_PHYSICAL,"); Serial.print(physicalInputs[1] ? 1 : 0);
  Serial.print(",I2_HMI,"); Serial.print(hmiInputs[1] ? 1 : 0);
  Serial.print(",I3,"); Serial.print(effectiveInputs[2] ? 1 : 0);
  Serial.print(",I3_PHYSICAL,"); Serial.print(physicalInputs[2] ? 1 : 0);
  Serial.print(",I3_HMI,"); Serial.print(hmiInputs[2] ? 1 : 0);
  Serial.print(",Q1,"); Serial.print(q1 ? 1 : 0);
  Serial.print(",RUNNING,"); Serial.print(controllerRunning ? 1 : 0);
  Serial.print(",CONTROL_MODE,"); Serial.println(modeName());
  lastState = millis();
  stateRequested = false;
}

int inputIndex(const String& tag) {
  if (tag.equalsIgnoreCase("I1")) return 0;
  if (tag.equalsIgnoreCase("I2")) return 1;
  if (tag.equalsIgnoreCase("I3")) return 2;
  return -1;
}

void processCommand(String command) {
  command.trim();
  if (!command.length()) return;

  if (command.startsWith("HELLO")) {
    Serial.println("OK,SIMUPLC,READY_CODE_V21,1");
    scanRequested = true;
    stateRequested = true;
    return;
  }
  if (command == "PING") {
    Serial.println("PONG");
    return;
  }
  if (command == "GET_STATE") {
    scanRequested = true;
    stateRequested = true;
    return;
  }
  if (command == "RUN" || command == "RUN,1") {
    controllerRunning = true;
    scanRequested = true;
    stateRequested = true;
    return;
  }
  if (command == "STOP" || command == "RUN,0") {
    controllerRunning = false;
    q1 = false;
    digitalWrite(PIN_Q1, LOW);
    stateRequested = true;
    sendState();
    return;
  }
  if (command.startsWith("MODE,")) {
    String value = command.substring(5);
    value.trim();
    value.toUpperCase();
    if (value == "HMI") controlMode = MODE_HMI;
    else if (value == "PHYSICAL" || value == "FISICO") controlMode = MODE_PHYSICAL;
    else controlMode = MODE_BOTH;
    scanRequested = true;
    stateRequested = true;
    return;
  }
  if (command.startsWith("SET,")) {
    int separator = command.indexOf(',', 4);
    if (separator > 4) {
      String tag = command.substring(4, separator);
      int index = inputIndex(tag);
      if (index >= 0) {
        hmiInputs[index] = command.substring(separator + 1).toInt() != 0;
        scanRequested = true;
        stateRequested = true;
      }
    }
  }
}

void readSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n') {
      rxBuffer[rxLength] = '\0';
      if (rxLength) processCommand(String(rxBuffer));
      rxLength = 0;
    } else if (c != '\r' && rxLength < sizeof(rxBuffer) - 1) {
      rxBuffer[rxLength++] = c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_I1, INPUT_PULLUP);
  pinMode(PIN_I2, INPUT_PULLUP);
  pinMode(PIN_I3, INPUT_PULLUP);
  pinMode(PIN_Q1, OUTPUT);
  digitalWrite(PIN_Q1, LOW);
}

void loop() {
  readSerial();

  unsigned long now = millis();
  if (!scanRequested && now - lastScan < 20) return;
  scanRequested = false;
  lastScan = now;

  readInputs();
  executeLogic();

  if (stateRequested || now - lastState >= 250) sendState();
}
