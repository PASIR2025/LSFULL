/*
  SimuPLC Lab 1.6.3-usb-analog - Arduino UNO R3 desde FBD
  Placa objetivo: Arduino UNO R3
  Entradas digitales: INPUT_PULLUP (LOW = contacto cerrado a GND).
  Entradas analógicas: ADC de 10 bits (0..1023).
*/

#if defined(ARDUINO_ARCH_ESP32)
  #if __has_include(<esp_arduino_version.h>)
    #include <esp_arduino_version.h>
  #endif
#endif
#if defined(ARDUINO_ARCH_ESP32) && defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  #define SIMUPLC_ESP_CORE3 1
#else
  #define SIMUPLC_ESP_CORE3 0
#endif

// [0] AI1
// [1] AI2
// [2] PID1
// [3] PWM1
// [4] I1
// [5] Q2

const bool INPUT_ACTIVE_LOW = true;
const uint16_t SCAN_MS = 20;
const uint16_t N_NODES = 6;
const uint16_t N_CONNS = 4;
const uint8_t N_DIGITAL_INPUTS = 1;
const uint8_t N_ANALOG_INPUTS = 2;
const uint8_t N_OUTPUTS = 1;
const uint8_t N_PWM_OUTPUTS = 1;
const uint8_t N_ANALOG_OUTPUTS = 0;
const uint16_t SAFE_NODES = 6;
const uint16_t SAFE_CONNS = 4;
const uint8_t SAFE_DIGITAL_INPUTS = 1;
const uint8_t SAFE_ANALOG_INPUTS = 2;
const uint8_t SAFE_OUTPUTS = 1;
const uint8_t SAFE_PWM_OUTPUTS = 1;
const uint8_t SAFE_ANALOG_OUTPUTS = 1;
const uint8_t N_PID_NODES = 1;
const uint8_t SAFE_PID_NODES = 1;
const uint32_t SIMUPLC_SERIAL_BAUD = 115200UL;
const uint16_t SIMUPLC_STATE_PERIOD_MS = 250;

// Asignación física de variables PLC
const uint8_t PIN_I1 = 2;
const uint8_t PIN_AI1 = A0;
const uint8_t PIN_AI2 = A1;
const uint8_t PIN_Q2 = 11;
const uint8_t PIN_PWM1 = 10;
const uint8_t digitalInputPins[SAFE_DIGITAL_INPUTS] = { 2 };
const uint8_t analogInputPins[SAFE_ANALOG_INPUTS] = { A0, A1 };
const uint8_t outputPins[SAFE_OUTPUTS] = { 11 };
const uint8_t pwmOutputPins[SAFE_PWM_OUTPUTS] = { 10 };
const uint8_t analogOutputPins[SAFE_ANALOG_OUTPUTS] = { 25 };
const bool outputActiveLow[SAFE_OUTPUTS] = { true };
const bool digitalInputIsNc[SAFE_DIGITAL_INPUTS] = { false };
const char* const digitalInputTags[SAFE_DIGITAL_INPUTS] = { "I1" };
const char* const analogInputTags[SAFE_ANALOG_INPUTS] = { "AI1", "AI2" };
const char* const outputTags[SAFE_OUTPUTS] = { "Q2" };
const char* const pwmOutputTags[SAFE_PWM_OUTPUTS] = { "PWM1" };
const char* const analogOutputTags[SAFE_ANALOG_OUTPUTS] = { "" };
const uint16_t pidNodeIndices[SAFE_PID_NODES] = { 2 };
const char* const pidTags[SAFE_PID_NODES] = { "PID1" };

enum NodeType : uint8_t {
  T_NONE=0,T_INPUT=1,T_OUTPUT=2,T_M=3,
  T_AND=10,T_OR=11,T_NOT=12,T_NAND=13,T_NOR=14,T_XOR=15,T_XNOR=16,
  T_SR=20,T_TON=21,T_TOFF=22,T_CNT=30,
  T_AI=40,T_SCALE=41,T_GT=42,T_LT=43,T_EQ=44,T_GTE=45,T_LTE=46,T_HYST=47,T_PWM=48,T_AO=49,T_CONST=50,T_PID=51
};

const uint8_t nodeType[SAFE_NODES] = { 40, 40, 51, 48, 1, 2 };
const uint8_t nodePins[SAFE_NODES] = { 0, 0, 2, 1, 0, 0 };
const uint8_t nodeDigitalInputIndex[SAFE_NODES] = { 255, 255, 255, 255, 0, 255 };
const uint8_t nodeAnalogInputIndex[SAFE_NODES] = { 0, 1, 255, 255, 255, 255 };
const uint8_t nodeOutputIndex[SAFE_NODES] = { 255, 255, 255, 255, 255, 0 };
const uint8_t nodePWMOutputIndex[SAFE_NODES] = { 255, 255, 255, 0, 255, 255 };
const uint8_t nodeAnalogOutputIndex[SAFE_NODES] = { 255, 255, 255, 255, 255, 255 };
const float nodeP1[SAFE_NODES] = { 0.0f, 0.0f, 2.0f, 0.0f, 0.0f, 0.0f };
const float nodeP2[SAFE_NODES] = { 1023.0f, 1023.0f, 0.05f, 100.0f, 0.0f, 0.0f };
const float nodeP3[SAFE_NODES] = { 0.0f, 0.0f, 0.05f, 1000.0f, 0.0f, 0.0f };
const float nodeP4[SAFE_NODES] = { 100.0f, 100.0f, 0.0f, 8.0f, 0.0f, 0.0f };
const float nodeP5[SAFE_NODES] = { 0.0f, 0.0f, 100.0f, 0.0f, 0.0f, 0.0f };
const uint32_t nodePidSample[SAFE_NODES] = { 0, 0, 100, 0, 0, 0 };
const float nodePidManual[SAFE_NODES] = { 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f };
const uint8_t nodePidFlags[SAFE_NODES] = { 0, 0, 0, 0, 0, 0 };
const uint8_t nodeClamp[SAFE_NODES] = { 1, 1, 0, 1, 0, 0 };

const uint16_t connSrc[SAFE_CONNS] = { 0, 1, 2, 4 };
const uint16_t connDst[SAFE_CONNS] = { 2, 2, 3, 5 };
const uint8_t connPin[SAFE_CONNS] = { 0, 1, 0, 0 };
const uint8_t connInv[SAFE_CONNS] = { 0, 0, 0, 0 };
const uint8_t connSignal[SAFE_CONNS] = { 1, 1, 1, 0 }; // 0=digital,1=analogica

bool bValue[SAFE_NODES] = {false};
float aValue[SAFE_NODES] = {0};
int analogRaw[SAFE_NODES] = {0};
bool srState[SAFE_NODES] = {false};
bool hystState[SAFE_NODES] = {false};
float pidIntegral[SAFE_NODES]={0}; float pidPrevError[SAFE_NODES]={0}; float pidOutput[SAFE_NODES]={0}; uint32_t pidLastAt[SAFE_NODES]={0};
uint32_t tonStart[SAFE_NODES];
uint32_t toffStart[SAFE_NODES];
bool toffSeenHigh[SAFE_NODES] = {false};
long counterValue[SAFE_NODES] = {0};
bool counterPrev[SAFE_NODES] = {false};
uint32_t lastScan = 0;
enum SimuPLCControlMode : uint8_t { SIMUPLC_BOTH=0, SIMUPLC_HMI=1, SIMUPLC_PHYSICAL=2 };
uint8_t simuplcControlMode = 0;
bool simuplcRunning = true;
bool simuplcProtocolActive = false;
bool simuplcScanRequested = true;
bool simuplcStateRequested = false;
bool physicalDigitalInputs[SAFE_DIGITAL_INPUTS] = {false};
bool hmiDigitalInputs[SAFE_DIGITAL_INPUTS] = {false};
float physicalAnalogInputs[SAFE_ANALOG_INPUTS] = {0};
float hmiAnalogInputs[SAFE_ANALOG_INPUTS] = {0};
bool hmiAnalogValid[SAFE_ANALOG_INPUTS] = {false};
char simuplcRxLine[128];
uint8_t simuplcRxLength = 0;
uint32_t simuplcLastStateAt = 0;

float clampFloat(float value,float a,float b){ float lo=min(a,b),hi=max(a,b); return max(lo,min(hi,value)); }
bool invalidFloat(float value){ return value != value; }
float runPidNode(uint16_t n,float pv,float sp,uint32_t now){bool manual=nodePidFlags[n]&1,cooling=nodePidFlags[n]&2;if(manual){pidOutput[n]=clampFloat(nodePidManual[n],nodeP4[n],nodeP5[n]);return pidOutput[n];}uint32_t sample=max((uint32_t)20,nodePidSample[n]);if(pidLastAt[n]&&now-pidLastAt[n]<sample)return pidOutput[n];float dt=max((float)sample,(float)(pidLastAt[n]?now-pidLastAt[n]:sample))/1000.0f;float error=(sp-pv)*(cooling?-1.0f:1.0f);float derivative=(error-pidPrevError[n])/max(dt,0.001f);float candidate=pidIntegral[n]+error*dt;float raw=nodeP1[n]*error+nodeP2[n]*candidate+nodeP3[n]*derivative;float limited=clampFloat(raw,nodeP4[n],nodeP5[n]);if(raw==limited||((error>0)!=(raw-limited>0)))pidIntegral[n]=candidate;pidPrevError[n]=error;pidLastAt[n]=now;pidOutput[n]=limited;return limited;}
float mapFloat(float value,float inMin,float inMax,float outMin,float outMax,bool limit){
  if(inMax==inMin) return outMin;
  if(limit) value=clampFloat(value,inMin,inMax);
  return outMin + ((value-inMin)/(inMax-inMin))*(outMax-outMin);
}

void setupPWMOutput(uint8_t pin,uint8_t channel,uint32_t frequency,uint8_t resolution){
#if defined(ARDUINO_ARCH_ESP32)
  #if SIMUPLC_ESP_CORE3
    ledcAttach(pin,frequency,resolution);
  #else
    ledcSetup(channel,frequency,resolution); ledcAttachPin(pin,channel);
  #endif
#else
  (void)channel; (void)frequency; (void)resolution; pinMode(pin,OUTPUT);
#endif
}
void writePWMOutput(uint8_t pin,uint8_t channel,float percent,uint8_t resolution){
  percent=clampFloat(percent,0.0f,100.0f);
#if defined(ARDUINO_ARCH_ESP32)
  uint8_t bits=min((uint8_t)16,max((uint8_t)1,resolution)); uint32_t maxDuty=(1UL<<bits)-1UL; uint32_t duty=(uint32_t)roundf(percent*maxDuty/100.0f);
  #if SIMUPLC_ESP_CORE3
    ledcWrite(pin,duty);
  #else
    ledcWrite(channel,duty);
  #endif
#else
  (void)channel; (void)resolution; analogWrite(pin,(int)roundf(percent*255.0f/100.0f));
#endif
}
void writeAnalogOutput(uint8_t pin,float volts,float minV,float maxV){
#if defined(ARDUINO_ARCH_ESP32)
  float ratio=(volts-minV)/(maxV-minV==0?1:(maxV-minV)); ratio=clampFloat(ratio,0.0f,1.0f); dacWrite(pin,(uint8_t)roundf(ratio*255.0f));
#else
  (void)pin;(void)volts;(void)minV;(void)maxV;
#endif
}

bool pinConnected(uint16_t node,uint8_t pin,uint8_t signal){
  for(uint16_t k=0;k<N_CONNS;k++) if(connDst[k]==node && connPin[k]==pin && connSignal[k]==signal) return true;
  return false;
}
bool readBoolPin(uint16_t node,uint8_t pin){
  bool value=false;
  for(uint16_t k=0;k<N_CONNS;k++){
    if(connDst[k]!=node || connPin[k]!=pin || connSignal[k]!=0) continue;
    bool part=bValue[connSrc[k]]; if(connInv[k]) part=!part; value=value||part;
  }
  return value;
}
float readAnalogPin(uint16_t node,uint8_t pin){
  for(uint16_t k=0;k<N_CONNS;k++) if(connDst[k]==node && connPin[k]==pin && connSignal[k]==1) return aValue[connSrc[k]];
  return NAN;
}
int findTagIndex(const char* tag,const char* const* tags,uint8_t count){for(uint8_t i=0;i<count;i++)if(strcmp(tag,tags[i])==0)return i;return -1;}
bool effectiveDigitalInput(uint8_t ix){if(ix>=N_DIGITAL_INPUTS)return false;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalDigitalInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):hmiDigitalInputs[ix];return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):(physicalDigitalInputs[ix]||hmiDigitalInputs[ix]);}
float effectiveAnalogInput(uint8_t ix){if(ix>=N_ANALOG_INPUTS)return 0.0f;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalAnalogInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:0.0f;return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:physicalAnalogInputs[ix];}
const char* simuplcModeName(){return simuplcControlMode==SIMUPLC_HMI?"HMI":(simuplcControlMode==SIMUPLC_PHYSICAL?"PHYSICAL":"BOTH");}

void readHardwareInputs(){
  for(uint16_t n=0;n<N_NODES;n++){
    if(nodeType[n]==T_INPUT){ uint8_t ix=nodeDigitalInputIndex[n]; bool physical=(ix<N_DIGITAL_INPUTS)?(digitalRead(digitalInputPins[ix])==(INPUT_ACTIVE_LOW?LOW:HIGH)):false; if(ix<N_DIGITAL_INPUTS)physicalDigitalInputs[ix]=physical; bValue[n]=(ix<N_DIGITAL_INPUTS)?effectiveDigitalInput(ix):false; }
    else if(nodeType[n]==T_CONST){ aValue[n]=nodeP1[n]; }
    else if(nodeType[n]==T_AI){
      uint8_t ix=nodeAnalogInputIndex[n]; int raw=(ix<N_ANALOG_INPUTS)?analogRead(analogInputPins[ix]):0; analogRaw[n]=raw;
      float physical=mapFloat(raw,nodeP1[n],nodeP2[n],nodeP3[n],nodeP4[n],nodeClamp[n]); if(ix<N_ANALOG_INPUTS)physicalAnalogInputs[ix]=physical; aValue[n]=(ix<N_ANALOG_INPUTS)?effectiveAnalogInput(ix):physical;
    }
  }
}

bool gateValue(uint8_t type,uint16_t node){
  bool any=false,all=true; uint8_t connected=0,sum=0;
  for(uint8_t p=0;p<nodePins[node];p++){ if(!pinConnected(node,p,0)) continue; bool v=readBoolPin(node,p); connected++; any=any||v; all=all&&v; if(v) sum++; }
  if(type==T_NOT) return connected? !readBoolPin(node,0):true;
  if(type==T_AND) return connected?all:true; if(type==T_OR) return any;
  if(type==T_NAND) return !(connected?all:true); if(type==T_NOR) return !any;
  if(type==T_XOR) return (sum%2)==1; if(type==T_XNOR) return (sum%2)==0; return any;
}

void propagateCombinational(){
  for(uint8_t pass=0;pass<8;pass++){
    bool changed=false;
    for(uint16_t n=0;n<N_NODES;n++){
      uint8_t t=nodeType[n]; if(t==T_INPUT||t==T_AI||t==T_CONST||t==T_SR||t==T_TON||t==T_TOFF||t==T_CNT||t==T_HYST||t==T_PID) continue;
      bool oldB=bValue[n]; float oldA=aValue[n];
      if(t==T_OUTPUT||t==T_M) bValue[n]=readBoolPin(n,0);
      else if(t>=T_AND && t<=T_XNOR) bValue[n]=gateValue(t,n);
      else if(t==T_SCALE){ float input=readAnalogPin(n,0); aValue[n]=invalidFloat(input)?nodeP3[n]:mapFloat(input,nodeP1[n],nodeP2[n],nodeP3[n],nodeP4[n],nodeClamp[n]); }
      else if(t==T_PWM){ float input=readAnalogPin(n,0); aValue[n]=invalidFloat(input)?0.0f:mapFloat(input,nodeP1[n],nodeP2[n],0.0f,100.0f,nodeClamp[n]); }
      else if(t==T_AO){ float input=readAnalogPin(n,0); aValue[n]=invalidFloat(input)?nodeP3[n]:mapFloat(input,nodeP1[n],nodeP2[n],nodeP3[n],nodeP4[n],nodeClamp[n]); }
      else if(t>=T_GT && t<=T_LTE){ float input=readAnalogPin(n,0);
        if(invalidFloat(input)) bValue[n]=false; else if(t==T_GT)bValue[n]=input>nodeP1[n]; else if(t==T_LT)bValue[n]=input<nodeP1[n]; else if(t==T_EQ)bValue[n]=fabs(input-nodeP1[n])<=fabs(nodeP2[n]); else if(t==T_GTE)bValue[n]=input>=nodeP1[n]; else bValue[n]=input<=nodeP1[n];
      }
      if(oldB!=bValue[n] || fabs(oldA-aValue[n])>0.0001f) changed=true;
    }
    if(!changed) break;
  }
}

void evaluateStateful(uint32_t now){
  for(uint16_t n=0;n<N_NODES;n++){
    uint8_t t=nodeType[n];
    if(t==T_PID){float pv=readAnalogPin(n,0),sp=readAnalogPin(n,1);aValue[n]=(invalidFloat(pv)||invalidFloat(sp))?pidOutput[n]:runPidNode(n,pv,sp,now);}
    else if(t==T_SR){ bool S=readBoolPin(n,0),R=readBoolPin(n,1); if(R)srState[n]=false; else if(S)srState[n]=true; bValue[n]=srState[n]; }
    else if(t==T_TON){ bool input=readBoolPin(n,0); uint32_t delayMs=(uint32_t)max(0.0f,nodeP1[n]); if(input){ if(tonStart[n]==0xFFFFFFFFUL)tonStart[n]=now; bValue[n]=(uint32_t)(now-tonStart[n])>=delayMs; }else{ tonStart[n]=0xFFFFFFFFUL;bValue[n]=false; } }
    else if(t==T_TOFF){ bool input=readBoolPin(n,0); uint32_t delayMs=(uint32_t)max(0.0f,nodeP1[n]); if(input){toffSeenHigh[n]=true;toffStart[n]=0xFFFFFFFFUL;bValue[n]=true;}else if(!toffSeenHigh[n])bValue[n]=false;else{if(toffStart[n]==0xFFFFFFFFUL)toffStart[n]=now;bValue[n]=(uint32_t)(now-toffStart[n])<delayMs;} }
    else if(t==T_CNT){ bool reset=readBoolPin(n,0),pulse=readBoolPin(n,1),down=readBoolPin(n,2); if(reset){counterValue[n]=0;bValue[n]=false;counterPrev[n]=false;}else{if(pulse&&!counterPrev[n]){if(down){if(counterValue[n]>0)counterValue[n]--;}else counterValue[n]++;}counterPrev[n]=pulse;if(counterValue[n]>=(long)nodeP1[n])bValue[n]=true;else if(counterValue[n]<(long)nodeP2[n])bValue[n]=false;} }
    else if(t==T_HYST){ float input=readAnalogPin(n,0); if(!invalidFloat(input)){if(input>=nodeP2[n])hystState[n]=true;else if(input<=nodeP1[n])hystState[n]=false;} bValue[n]=hystState[n]; }
  }
}

void writeHardwareOutputs(){
  for(uint16_t n=0;n<N_NODES;n++) if(nodeType[n]==T_OUTPUT){ uint8_t ix=nodeOutputIndex[n]; if(ix<N_OUTPUTS) digitalWrite(outputPins[ix],bValue[n]?(outputActiveLow[ix]?LOW:HIGH):(outputActiveLow[ix]?HIGH:LOW)); }
  for(uint16_t n=0;n<N_NODES;n++){ if(nodeType[n]==T_PWM){uint8_t ix=nodePWMOutputIndex[n];if(ix<N_PWM_OUTPUTS)writePWMOutput(pwmOutputPins[ix],ix,aValue[n],(uint8_t)nodeP4[n]);} else if(nodeType[n]==T_AO){uint8_t ix=nodeAnalogOutputIndex[n];if(ix<N_ANALOG_OUTPUTS)writeAnalogOutput(analogOutputPins[ix],aValue[n],nodeP3[n],nodeP4[n]);} }
}
void forceHardwareOutputsOff(){for(uint16_t n=0;n<N_NODES;n++){if(nodeType[n]==T_OUTPUT)bValue[n]=false;else if(nodeType[n]==T_PWM||nodeType[n]==T_AO)aValue[n]=0.0f;}writeHardwareOutputs();}
void controllerScan(uint32_t now){readHardwareInputs();if(simuplcRunning){propagateCombinational();evaluateStateful(now);propagateCombinational();writeHardwareOutputs();}else forceHardwareOutputsOff();}

void printBoolPair(const char* tag,bool value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value?1:0);}
void printFloatPair(const char* tag,float value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value,3);}
void sendSimuPLCState(){
  Serial.print(F("STATE"));
  for(uint8_t i=0;i<N_DIGITAL_INPUTS;i++){printBoolPair(digitalInputTags[i],effectiveDigitalInput(i));Serial.print(char(44));Serial.print(digitalInputTags[i]);Serial.print(F("_PHYSICAL,"));Serial.print(physicalDigitalInputs[i]?1:0);Serial.print(char(44));Serial.print(digitalInputTags[i]);Serial.print(F("_HMI,"));Serial.print(hmiDigitalInputs[i]?1:0);}
  for(uint8_t i=0;i<N_ANALOG_INPUTS;i++){printFloatPair(analogInputTags[i],effectiveAnalogInput(i));Serial.print(char(44));Serial.print(analogInputTags[i]);Serial.print(F("_PHYSICAL,"));Serial.print(physicalAnalogInputs[i],3);Serial.print(char(44));Serial.print(analogInputTags[i]);Serial.print(F("_HMI,"));Serial.print(hmiAnalogInputs[i],3);}
  for(uint16_t n=0;n<N_NODES;n++){if(nodeType[n]==T_OUTPUT){uint8_t ix=nodeOutputIndex[n];if(ix<N_OUTPUTS)printBoolPair(outputTags[ix],bValue[n]);}else if(nodeType[n]==T_PWM){uint8_t ix=nodePWMOutputIndex[n];if(ix<N_PWM_OUTPUTS)printFloatPair(pwmOutputTags[ix],aValue[n]);}else if(nodeType[n]==T_AO){uint8_t ix=nodeAnalogOutputIndex[n];if(ix<N_ANALOG_OUTPUTS)printFloatPair(analogOutputTags[ix],aValue[n]);}}
  for(uint8_t i=0;i<N_PID_NODES;i++)printFloatPair(pidTags[i],aValue[pidNodeIndices[i]]);
  Serial.print(F(",RUNNING,"));Serial.print(simuplcRunning?1:0);Serial.print(F(",CONTROL_MODE,"));Serial.println(simuplcModeName());
  simuplcLastStateAt=millis();simuplcStateRequested=false;
}
void processSimuPLCCommand(char* line){
  for(char* p=line;*p;p++)if(*p>='a'&&*p<='z')*p=(char)(*p-32);
  char* save=nullptr;char* cmd=strtok_r(line,",",&save);if(!cmd)return;simuplcProtocolActive=true;
  if(strcmp(cmd,"HELLO")==0){Serial.println(F("OK,SIMUPLC,READY_ANALOG_V1,1"));simuplcScanRequested=true;simuplcStateRequested=true;return;}
  if(strcmp(cmd,"PING")==0){Serial.println(F("PONG"));return;}
  if(strcmp(cmd,"GET_STATE")==0){simuplcScanRequested=true;simuplcStateRequested=true;return;}
  if(strcmp(cmd,"RUN")==0){char* value=strtok_r(nullptr,",",&save);simuplcRunning=!(value&&strcmp(value,"0")==0);simuplcScanRequested=true;simuplcStateRequested=true;return;}
  if(strcmp(cmd,"STOP")==0){simuplcRunning=false;simuplcScanRequested=true;simuplcStateRequested=true;return;}
  if(strcmp(cmd,"MODE")==0){char* value=strtok_r(nullptr,",",&save);if(value){if(strcmp(value,"HMI")==0)simuplcControlMode=SIMUPLC_HMI;else if(strcmp(value,"PHYSICAL")==0||strcmp(value,"FISICO")==0)simuplcControlMode=SIMUPLC_PHYSICAL;else simuplcControlMode=SIMUPLC_BOTH;}simuplcScanRequested=true;simuplcStateRequested=true;return;}
  if(strcmp(cmd,"SET")==0||strcmp(cmd,"SETA")==0){char* tag=strtok_r(nullptr,",",&save);char* value=strtok_r(nullptr,",",&save);if(!tag||!value)return;int dix=findTagIndex(tag,digitalInputTags,N_DIGITAL_INPUTS);if(dix>=0){hmiDigitalInputs[dix]=atoi(value)!=0;simuplcScanRequested=true;simuplcStateRequested=true;return;}int aix=findTagIndex(tag,analogInputTags,N_ANALOG_INPUTS);if(aix>=0){hmiAnalogInputs[aix]=(float)atof(value);hmiAnalogValid[aix]=true;simuplcScanRequested=true;simuplcStateRequested=true;return;}Serial.println(F("ERROR,TAG_NO_ENCONTRADO"));return;}
  if(strcmp(cmd,"RELEASE")==0){char* tag=strtok_r(nullptr,",",&save);if(tag){int aix=findTagIndex(tag,analogInputTags,N_ANALOG_INPUTS);if(aix>=0){hmiAnalogValid[aix]=false;simuplcScanRequested=true;simuplcStateRequested=true;return;}}return;}
  Serial.println(F("ERROR,COMANDO_NO_RECONOCIDO"));
}
void pollSimuPLCSerial(){while(Serial.available()>0){char c=(char)Serial.read();if(c=='\n'||c=='\r'){if(simuplcRxLength){simuplcRxLine[simuplcRxLength]=0;processSimuPLCCommand(simuplcRxLine);simuplcRxLength=0;}}else if(c>=32&&c<=126){if(simuplcRxLength<sizeof(simuplcRxLine)-1)simuplcRxLine[simuplcRxLength++]=c;else simuplcRxLength=0;}}}

void setup(){
  Serial.begin(SIMUPLC_SERIAL_BAUD);
  for(uint8_t i=0;i<N_DIGITAL_INPUTS;i++) pinMode(digitalInputPins[i],INPUT_PULLUP);
  for(uint8_t i=0;i<N_OUTPUTS;i++){ pinMode(outputPins[i],OUTPUT); digitalWrite(outputPins[i],outputActiveLow[i]?HIGH:LOW); }
  for(uint16_t n=0;n<N_NODES;n++) if(nodeType[n]==T_PWM){uint8_t ix=nodePWMOutputIndex[n];if(ix<N_PWM_OUTPUTS)setupPWMOutput(pwmOutputPins[ix],ix,(uint32_t)nodeP3[n],(uint8_t)nodeP4[n]);}
  for(uint16_t n=0;n<N_NODES;n++){tonStart[n]=0xFFFFFFFFUL;toffStart[n]=0xFFFFFFFFUL;}
}

void loop(){
  pollSimuPLCSerial();
  uint32_t now=millis();if(simuplcScanRequested||(uint32_t)(now-lastScan)>=SCAN_MS){simuplcScanRequested=false;lastScan=now;controllerScan(now);}
  if(simuplcProtocolActive&&(simuplcStateRequested||(uint32_t)(now-simuplcLastStateAt)>=SIMUPLC_STATE_PERIOD_MS))sendSimuPLCState();
}