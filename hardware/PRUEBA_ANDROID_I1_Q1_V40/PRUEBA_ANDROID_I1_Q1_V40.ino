#include <Arduino.h>
/*
  SimuPLC Lab - Arduino desde LADDER PRO
  FIX REAL: genera serie/paralelo desde el grafo de cables proWires.
  Serie = && | Paralelo = || | INPUT_PULLUP: cerrado = LOW = logico 1.
*/

const byte PIN_I1 = 2;
const byte PIN_I2 = 3;
const byte PIN_Q1 = 13;
const byte PIN_Q2 = 12;

bool I1 = false;
bool I2 = false;
bool Q1 = false;
bool Q2 = false;


// ===== SIMUPLC HMI READY CODE V17 =====
const uint32_t HMI_BAUD_RATE=115200UL;
const uint32_t HMI_STATE_PERIOD_MS=50UL;
const uint32_t HMI_TIMEOUT_MS=3000UL;
const bool HMI_STOP_ON_TIMEOUT=false;
const bool HMI_START_ON_BOOT=true;
const uint8_t HMI_INPUT_COUNT=2;
const uint8_t HMI_OUTPUT_COUNT=2;
const uint8_t HMI_SAFE_INPUT_COUNT=2;
const uint8_t HMI_SAFE_OUTPUT_COUNT=2;
const char* HMI_INPUT_TAGS[HMI_SAFE_INPUT_COUNT]={"I1", "I2"};
const char* HMI_OUTPUT_TAGS[HMI_SAFE_OUTPUT_COUNT]={"Q1", "Q2"};
bool hmiInputValues[HMI_SAFE_INPUT_COUNT]={false, false};
bool hmiPhysicalValues[HMI_SAFE_INPUT_COUNT]={false};
const uint8_t hmiInputSource[HMI_SAFE_INPUT_COUNT]={2, 2}; // 0 fisica, 1 HMI, 2 OR/cualquiera, 3 AND/ambos obligatorios
// I1: contacto NO -> FISICO O HMI (cualquiera activa)
// I2: contacto NO -> FISICO O HMI (cualquiera activa)
bool hmiControllerRunning=HMI_START_ON_BOOT;
uint32_t hmiLastMessageMs=0,hmiLastStateMs=0;




char hmiRxBuffer[160];
uint16_t hmiRxLength=0;

bool hmiCombineInput(uint8_t ix,bool physicalValue){if(ix>=HMI_INPUT_COUNT)return physicalValue;hmiPhysicalValues[ix]=physicalValue;switch(hmiInputSource[ix]){case 1:return hmiInputValues[ix];case 2:return physicalValue||hmiInputValues[ix];case 3:return physicalValue&&hmiInputValues[ix];default:return physicalValue;}}
int hmiFindInput(const String& tag){for(uint8_t i=0;i<HMI_INPUT_COUNT;i++)if(tag.equalsIgnoreCase(HMI_INPUT_TAGS[i]))return i;return -1;}
void writeOutputs();
bool hmiLogicalInput(uint8_t ix){switch(ix){case 0:return I1;case 1:return I2;default:return false;}}
bool hmiLogicalOutput(uint8_t ox){switch(ox){case 0:return Q1;case 1:return Q2;default:return false;}}
void hmiForceOutputsOff(){Q1=false;Q2=false;writeOutputs();}

void hmiTransportSend(const String& line);
void hmiTransportBegin();
void hmiTransportLoop();
String hmiBuildState(){String s="STATE";for(uint8_t i=0;i<HMI_INPUT_COUNT;i++){s+=',';s+=HMI_INPUT_TAGS[i];s+=',';s+=(hmiLogicalInput(i)?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_PHYSICAL,";s+=(hmiPhysicalValues[i]?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_HMI,";s+=(hmiInputValues[i]?'1':'0');}for(uint8_t i=0;i<HMI_OUTPUT_COUNT;i++){s+=',';s+=HMI_OUTPUT_TAGS[i];s+=',';s+=(hmiLogicalOutput(i)?'1':'0');}s+=",RUNNING,";s+=(hmiControllerRunning?'1':'0');return s;}
void hmiSendState();
void hmiProcessCommand(String command){command.trim();if(!command.length())return;hmiLastMessageMs=millis();if(command=="PING"){hmiTransportSend("PONG");return;}if(command=="GET_STATE"){hmiSendState();return;}if(command=="RUN,1"||command=="RUN"){hmiControllerRunning=true;hmiSendState();return;}if(command=="STOP"||command=="RUN,0"){hmiControllerRunning=false;hmiForceOutputsOff();hmiSendState();return;}if(command.startsWith("HELLO")){hmiTransportSend("OK,SIMUPLC,READY_CODE_V17,1");hmiSendState();return;}if(command.startsWith("SET,")){int p=command.indexOf(',',4);if(p>4){String tag=command.substring(4,p);int ix=hmiFindInput(tag);if(ix>=0)hmiInputValues[ix]=command.substring(p+1).toInt()!=0;}return;}hmiTransportSend("ERROR,COMANDO_NO_RECONOCIDO");}
void hmiSendState(){hmiTransportSend(hmiBuildState());}

void hmiTransportSend(const String& line){ Serial.println(line); }
void hmiTransportBegin(){ Serial.begin(HMI_BAUD_RATE); }
void hmiTransportLoop(){
  while(Serial.available()>0){
    char c=(char)Serial.read();
    if(c=='\n'){
      hmiRxBuffer[hmiRxLength]='\0';
      if(hmiRxLength) hmiProcessCommand(String(hmiRxBuffer));
      hmiRxLength=0;
    }else if(c!='\r' && hmiRxLength<sizeof(hmiRxBuffer)-1){ hmiRxBuffer[hmiRxLength++]=c; }
  }
}
void hmiBegin(){hmiLastMessageMs=millis();hmiTransportBegin();hmiSendState();}
void hmiLoop(){hmiTransportLoop();if(HMI_STOP_ON_TIMEOUT&&hmiControllerRunning&&(uint32_t)(millis()-hmiLastMessageMs)>HMI_TIMEOUT_MS){hmiControllerRunning=false;hmiForceOutputsOff();}}
void hmiMaybeSendState(){uint32_t now=millis();if((uint32_t)(now-hmiLastStateMs)>=HMI_STATE_PERIOD_MS){hmiLastStateMs=now;hmiSendState();}}
// ===== FIN SIMUPLC HMI READY CODE V17 =====

void setup(){
  pinMode(PIN_I1, INPUT_PULLUP);
  pinMode(PIN_I2, INPUT_PULLUP);
  pinMode(PIN_Q1, OUTPUT);
  pinMode(PIN_Q2, OUTPUT);
  digitalWrite(PIN_Q1, HIGH);
  digitalWrite(PIN_Q2, HIGH);
  hmiBegin();
}

void readInputs(){
  I1 = hmiCombineInput(0, (digitalRead(PIN_I1) == LOW));
  I2 = hmiCombineInput(1, (digitalRead(PIN_I2) == LOW));
}

void plcScan(){
  unsigned long now = millis();
  // Ladder PRO: calculado por grafo real de cables
  Q1 = ((true && I1));
  Q2 = ((true && I2));
}

void writeOutputs(){
  digitalWrite(PIN_Q1, Q1 ? LOW : HIGH);
  digitalWrite(PIN_Q2, Q2 ? LOW : HIGH);
}

void loop(){
  hmiLoop();
  readInputs();
  if(!hmiControllerRunning){hmiForceOutputsOff();hmiMaybeSendState();delay(10);return;}
  plcScan();
  writeOutputs();
  hmiMaybeSendState();
  delay(10);
}
