/*
  SimuPLC HMI V17 - Prueba funcional START NO independiente

  I1 física: D2 con INPUT_PULLUP, pulsador NO entre D2 y GND.
  I1 HMI: comandos SET,I1,1 y SET,I1,0.
  Combinación: I1 = I1_FISICA || I1_HMI.

  Resultado:
  - Pulsador físico solo: activa Q1.
  - Pulsador HMI solo: activa Q1.
  - No es necesario pulsar ambos.

  Q1: LED integrado D13, activo en HIGH.
*/

const byte PIN_I1 = 2;
const byte PIN_Q1 = 13;
const unsigned long STATE_PERIOD_MS = 120;

bool I1_FISICA = false;
bool I1_HMI = false;
bool I1 = false;
bool Q1 = false;
bool RUNNING = true;

String rxLine;
unsigned long lastStateMs = 0;

void updateLogic() {
  I1_FISICA = digitalRead(PIN_I1) == LOW;
  I1 = I1_FISICA || I1_HMI;  // NO: cualquiera de las dos fuentes activa.
  Q1 = RUNNING && I1;
  digitalWrite(PIN_Q1, Q1 ? HIGH : LOW);
}

void sendState() {
  Serial.print(F("STATE,I1,"));
  Serial.print(I1 ? 1 : 0);
  Serial.print(F(",I1_PHYSICAL,"));
  Serial.print(I1_FISICA ? 1 : 0);
  Serial.print(F(",I1_HMI,"));
  Serial.print(I1_HMI ? 1 : 0);
  Serial.print(F(",Q1,"));
  Serial.print(Q1 ? 1 : 0);
  Serial.print(F(",RUNNING,"));
  Serial.println(RUNNING ? 1 : 0);
}

void processCommand(String command) {
  command.trim();
  if (!command.length()) return;

  if (command.startsWith("HELLO")) {
    Serial.println(F("OK,SIMUPLC,READY_CODE_V17,1"));
    updateLogic();
    sendState();
    return;
  }
  if (command == "PING") {
    Serial.println(F("PONG"));
    return;
  }
  if (command == "GET_STATE") {
    updateLogic();
    sendState();
    return;
  }
  if (command == "RUN" || command == "RUN,1") {
    RUNNING = true;
    updateLogic();
    sendState();
    return;
  }
  if (command == "STOP" || command == "RUN,0") {
    RUNNING = false;
    updateLogic();
    sendState();
    return;
  }
  if (command.startsWith("SET,I1,")) {
    I1_HMI = command.substring(7).toInt() != 0;
    updateLogic();
    sendState();
  }
}

void readSerial() {
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c == '\n') {
      processCommand(rxLine);
      rxLine = "";
    } else if (c != '\r' && rxLine.length() < 80) {
      rxLine += c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_I1, INPUT_PULLUP);
  pinMode(PIN_Q1, OUTPUT);
  updateLogic();
}

void loop() {
  readSerial();
  updateLogic();

  const unsigned long now = millis();
  if (now - lastStateMs >= STATE_PERIOD_MS) {
    lastStateMs = now;
    sendState();
  }
}
