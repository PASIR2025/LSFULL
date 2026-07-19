/*
  SimuPLC HMI - Ejemplo USB / OTG
  Protocolo: SET / STATE v1

  Ejemplo didáctico:
    I1 = STOP NC (reposo lógico 1)
    I2 = START NO (reposo lógico 0)
    Q1 = MOTOR / RELÉ en D8

  IMPORTANTE:
  - No conectes un motor directamente a Arduino.
  - Usa una interfaz, relé y contactor adecuados.
  - La parada de emergencia física debe actuar por hardware.
*/

#include <Arduino.h>
#include <string.h>
#include <stdio.h>

constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint8_t PIN_STOP = 2;     // contacto NC a GND, INPUT_PULLUP
constexpr uint8_t PIN_START = 3;    // contacto NO a GND, INPUT_PULLUP
constexpr uint8_t PIN_Q1 = 8;       // señal hacia módulo de interfaz
constexpr bool OUTPUT_ACTIVE_LOW = false;
constexpr uint32_t STATE_PERIOD_MS = 250;
constexpr uint32_t HMI_TIMEOUT_MS = 2500;
constexpr bool STOP_ON_HMI_TIMEOUT = true;

bool hmiI1 = true;
bool hmiI2 = false;
bool q1 = false;
bool runEnabled = false;
uint32_t lastMessageMs = 0;
uint32_t lastStateMs = 0;
char lineBuffer[96];
uint8_t lineLength = 0;

bool readContactToGround(uint8_t pin) {
  return digitalRead(pin) == LOW;
}

void writeLogicalOutput(uint8_t pin, bool value) {
  digitalWrite(pin, value ? (OUTPUT_ACTIVE_LOW ? LOW : HIGH)
                          : (OUTPUT_ACTIVE_LOW ? HIGH : LOW));
}

void sendState() {
  const bool physicalStopOk = readContactToGround(PIN_STOP);
  const bool physicalStart = readContactToGround(PIN_START);
  const bool i1 = physicalStopOk && hmiI1;
  const bool i2 = physicalStart || hmiI2;

  Serial.print(F("STATE,I1,")); Serial.print(i1 ? 1 : 0);
  Serial.print(F(",I2,")); Serial.print(i2 ? 1 : 0);
  Serial.print(F(",Q1,")); Serial.print(q1 ? 1 : 0);
  Serial.print(F(",RUNNING,")); Serial.println(runEnabled ? 1 : 0);
}

void processCommand(char* command) {
  while (*command == ' ') command++;
  lastMessageMs = millis();

  if (strcmp(command, "PING") == 0) {
    Serial.println(F("PONG"));
    return;
  }
  if (strcmp(command, "GET_STATE") == 0) {
    sendState();
    return;
  }
  if (strcmp(command, "STOP") == 0 || strcmp(command, "RUN,0") == 0) {
    runEnabled = false;
    q1 = false;
    writeLogicalOutput(PIN_Q1, false);
    sendState();
    return;
  }
  if (strcmp(command, "RUN,1") == 0) {
    runEnabled = true;
    sendState();
    return;
  }
  if (strncmp(command, "HELLO", 5) == 0) {
    Serial.println(F("OK,SIMUPLC,USB,1"));
    sendState();
    return;
  }

  char tag[12] = {0};
  int value = 0;
  if (sscanf(command, "SET,%11[^,],%d", tag, &value) == 2) {
    const bool logical = value != 0;
    if (strcmp(tag, "I1") == 0) hmiI1 = logical;
    else if (strcmp(tag, "I2") == 0) hmiI2 = logical;
    sendState();
    return;
  }

  Serial.println(F("ERROR,COMANDO_NO_RECONOCIDO"));
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n') {
      lineBuffer[lineLength] = '\0';
      if (lineLength > 0) processCommand(lineBuffer);
      lineLength = 0;
    } else if (c != '\r' && lineLength < sizeof(lineBuffer) - 1) {
      lineBuffer[lineLength++] = c;
    }
  }
}

void executePlcLogic() {
  const bool physicalStopOk = readContactToGround(PIN_STOP);
  const bool physicalStart = readContactToGround(PIN_START);
  const bool i1 = physicalStopOk && hmiI1;
  const bool i2 = physicalStart || hmiI2;

  if (!runEnabled || !i1) q1 = false;
  else if (i2) q1 = true;  // enclavamiento de Q1

  writeLogicalOutput(PIN_Q1, q1);
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  pinMode(PIN_STOP, INPUT_PULLUP);
  pinMode(PIN_START, INPUT_PULLUP);
  pinMode(PIN_Q1, OUTPUT);
  writeLogicalOutput(PIN_Q1, false);
  lastMessageMs = millis();
}

void loop() {
  readSerialCommands();

  if (STOP_ON_HMI_TIMEOUT && runEnabled && millis() - lastMessageMs > HMI_TIMEOUT_MS) {
    runEnabled = false;
    q1 = false;
  }

  executePlcLogic();

  if (millis() - lastStateMs >= STATE_PERIOD_MS) {
    lastStateMs = millis();
    sendState();
  }
}
