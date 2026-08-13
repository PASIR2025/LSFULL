/*
  SimuPLC V39 - Prueba estable Android / OTG
  I1 HMI o pulsador físico en D2 -> Q1 LED integrado D13
  Protocolo: HELLO, GET_STATE, PING, RUN, STOP, SET, MODE
*/
#include <Arduino.h>

const uint32_t SERIAL_BAUD = 115200;
const uint8_t PIN_I1 = 2;
const uint8_t PIN_Q1 = 13;
const uint16_t DEBOUNCE_MS = 20;
const uint32_t STATE_HEARTBEAT_MS = 500;

enum ControlMode : uint8_t { MODE_BOTH=0, MODE_HMI=1, MODE_PHYSICAL=2 };
ControlMode controlMode = MODE_BOTH;
bool hmiI1 = false;
bool physicalI1 = false;
bool logicalI1 = false;
bool q1 = false;
bool running = false;
bool lastRaw = false;
bool lastReportedI1 = false;
bool lastReportedPhysical = false;
bool lastReportedHmi = false;
bool lastReportedQ1 = false;
bool lastReportedRunning = false;
ControlMode lastReportedMode = (ControlMode)255;
uint32_t rawChangedAt = 0;
uint32_t lastStateAt = 0;
String rxLine;

const char* modeName(){ return controlMode==MODE_HMI?"HMI":controlMode==MODE_PHYSICAL?"PHYSICAL":"BOTH"; }

void sendState(){
  Serial.print(F("STATE,I1,")); Serial.print(logicalI1?1:0);
  Serial.print(F(",I1_PHYSICAL,")); Serial.print(physicalI1?1:0);
  Serial.print(F(",I1_HMI,")); Serial.print(hmiI1?1:0);
  Serial.print(F(",Q1,")); Serial.print(q1?1:0);
  Serial.print(F(",RUNNING,")); Serial.print(running?1:0);
  Serial.print(F(",CONTROL_MODE,")); Serial.println(modeName());
  lastStateAt=millis();
  lastReportedI1=logicalI1; lastReportedPhysical=physicalI1; lastReportedHmi=hmiI1;
  lastReportedQ1=q1; lastReportedRunning=running; lastReportedMode=controlMode;
}

void updatePhysical(){
  bool raw = digitalRead(PIN_I1)==LOW;
  uint32_t now=millis();
  if(raw!=lastRaw){ lastRaw=raw; rawChangedAt=now; }
  if((uint32_t)(now-rawChangedAt)>=DEBOUNCE_MS) physicalI1=raw;
}

void executeLogic(){
  if(controlMode==MODE_HMI) logicalI1=hmiI1;
  else if(controlMode==MODE_PHYSICAL) logicalI1=physicalI1;
  else logicalI1=physicalI1||hmiI1;
  q1=running&&logicalI1;
  digitalWrite(PIN_Q1,q1?HIGH:LOW);
}

void processCommand(String cmd){
  cmd.trim(); if(!cmd.length()) return;
  if(cmd=="PING"){ Serial.println(F("PONG")); return; }
  if(cmd=="GET_STATE"){ updatePhysical(); executeLogic(); sendState(); return; }
  if(cmd.startsWith("HELLO")){ Serial.println(F("OK,SIMUPLC,READY_V39,1")); updatePhysical(); executeLogic(); sendState(); return; }
  if(cmd=="RUN"||cmd=="RUN,1"){ running=true; executeLogic(); sendState(); return; }
  if(cmd=="STOP"||cmd=="RUN,0"){ running=false; executeLogic(); sendState(); return; }
  if(cmd.startsWith("MODE,")){
    String v=cmd.substring(5); v.trim(); v.toUpperCase();
    if(v=="HMI") controlMode=MODE_HMI;
    else if(v=="PHYSICAL"||v=="FISICO") controlMode=MODE_PHYSICAL;
    else controlMode=MODE_BOTH;
    executeLogic(); sendState(); return;
  }
  if(cmd.startsWith("SET,")){
    int p=cmd.indexOf(',',4);
    if(p>4){
      String tag=cmd.substring(4,p); tag.trim(); tag.toUpperCase();
      if(tag=="I1") hmiI1=cmd.substring(p+1).toInt()!=0;
      executeLogic(); sendState(); return;
    }
  }
  Serial.println(F("ERROR,COMANDO_NO_RECONOCIDO"));
}

void readCommands(){
  while(Serial.available()){
    char c=(char)Serial.read();
    if(c=='\n'){ processCommand(rxLine); rxLine=""; }
    else if(c!='\r'&&rxLine.length()<96) rxLine+=c;
  }
}

void setup(){
  pinMode(PIN_I1,INPUT_PULLUP); pinMode(PIN_Q1,OUTPUT); digitalWrite(PIN_Q1,LOW);
  Serial.begin(SERIAL_BAUD); rxLine.reserve(96); rawChangedAt=millis();
}

void loop(){
  readCommands(); updatePhysical(); executeLogic();
  bool changed=logicalI1!=lastReportedI1||physicalI1!=lastReportedPhysical||hmiI1!=lastReportedHmi||q1!=lastReportedQ1||running!=lastReportedRunning||controlMode!=lastReportedMode;
  if(changed||(uint32_t)(millis()-lastStateAt)>=STATE_HEARTBEAT_MS) sendState();
}
