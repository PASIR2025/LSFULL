/*
  SimuPLC HMI V14 - prueba directa USB/OTG
  I1 fisica: D2, activa conectando D2 a GND
  I1 HMI: SET,I1,0/1
  Q1: D13, activa en HIGH para el LED integrado
*/

const uint32_t HMI_BAUD_RATE = 115200;
const uint8_t PIN_I1 = 2;
const uint8_t PIN_Q1 = 13;

bool i1Hmi = false;
bool i1Fisica = false;
bool I1 = false;
bool Q1 = false;
bool running = true;

char rxBuffer[96];
uint8_t rxLength = 0;
uint32_t lastStateMs = 0;

void sendState() {
  Serial.print("STATE,I1,");
  Serial.print(I1 ? 1 : 0);
  Serial.print(",Q1,");
  Serial.print(Q1 ? 1 : 0);
  Serial.print(",RUNNING,");
  Serial.println(running ? 1 : 0);
}

void processCommand(char* command) {
  if (strcmp(command, "PING") == 0) {
    Serial.println("PONG");
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
    Q1 = false;
    digitalWrite(PIN_Q1, LOW);
    sendState();
    return;
  }
  if (strncmp(command, "HELLO", 5) == 0) {
    Serial.println("OK,SIMUPLC,READY_CODE_V14,1");
    sendState();
    return;
  }

  char tag[8];
  int value = 0;
  if (sscanf(command, "SET,%7[^,],%d", tag, &value) == 2) {
    if (strcmp(tag, "I1") == 0) i1Hmi = value != 0;
    sendState();
  }
}

void readSerialHmi() {
  while (Serial.available() > 0) {
    char c = static_cast<char>(Serial.read());
    if (c == '\n') {
      rxBuffer[rxLength] = '\0';
      if (rxLength > 0) processCommand(rxBuffer);
      rxLength = 0;
    } else if (c != '\r' && rxLength < sizeof(rxBuffer) - 1) {
      rxBuffer[rxLength++] = c;
    }
  }
}

void setup() {
  Serial.begin(HMI_BAUD_RATE);
  pinMode(PIN_I1, INPUT_PULLUP);
  pinMode(PIN_Q1, OUTPUT);
  digitalWrite(PIN_Q1, LOW);
}

void loop() {
  readSerialHmi();

  i1Fisica = digitalRead(PIN_I1) == LOW;
  I1 = i1Fisica || i1Hmi;
  Q1 = running && I1;
  digitalWrite(PIN_Q1, Q1 ? HIGH : LOW);

  if (millis() - lastStateMs >= 120) {
    lastStateMs = millis();
    sendState();
  }
}
