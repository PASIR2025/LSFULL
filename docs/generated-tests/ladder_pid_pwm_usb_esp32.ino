/*
  SimuPLC Lab 1.6.3-usb-analog - ESP32 desde LADDER PRO
  Serie/paralelo calculado desde proWires.
  CONST/AI/SCALE transportan float; comparadores entregan bool.
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

const uint8_t PIN_AI1 = 36;
const uint8_t PIN_AI2 = 39;
const uint8_t PIN_PWM1 = 22;

const uint8_t N_DIGITAL_INPUTS = 0;
const uint8_t N_ANALOG_INPUTS = 2;
const uint8_t N_OUTPUTS = 0;
const uint8_t N_PWM_OUTPUTS = 1;
const uint8_t N_ANALOG_OUTPUTS = 0;
const uint8_t N_PID_VALUES = 1;
const uint8_t SAFE_DIGITAL_INPUTS = 1;
const uint8_t SAFE_ANALOG_INPUTS = 2;
const uint8_t SAFE_OUTPUTS = 1;
const uint8_t SAFE_PWM_OUTPUTS = 1;
const uint8_t SAFE_ANALOG_OUTPUTS = 1;
const uint8_t SAFE_PID_VALUES = 1;
const uint32_t SIMUPLC_SERIAL_BAUD = 115200UL;
const uint16_t SIMUPLC_STATE_PERIOD_MS = 250;
const bool digitalInputIsNc[SAFE_DIGITAL_INPUTS] = { false };
const char* const digitalInputTags[SAFE_DIGITAL_INPUTS] = { "" };
const char* const analogInputTags[SAFE_ANALOG_INPUTS] = { "AI1", "AI2" };
const char* const outputTags[SAFE_OUTPUTS] = { "" };
const char* const pwmOutputTags[SAFE_PWM_OUTPUTS] = { "PWM1" };
const char* const analogOutputTags[SAFE_ANALOG_OUTPUTS] = { "" };
const char* const pidTags[SAFE_PID_VALUES] = { "PID1" };

typedef struct PIDState{float integral;float prevError;uint32_t lastAt;float output;} PIDState;
float runPID(float &integral,float &prevError,uint32_t &lastAt,float &output,float pv,float sp,float kp,float ki,float kd,uint32_t sampleMs,float outMin,float outMax,bool cooling,bool manualMode,float manualOutput,uint32_t now);
int AI1_raw = 0;
float AI1 = 0.0f;
int AI2_raw = 0;
float AI2 = 0.0f;
float PID1 = 0.0f;
PIDState PID1_state = {0.0f,0.0f,0,0.0f};
float PWM1 = 0.0f;
const bool OUTPUT_ACTIVE_LOW[1] = { false };
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

float clampFloat(float value,float a,float b){float lo=min(a,b),hi=max(a,b);return max(lo,min(hi,value));}
float mapFloat(float value,float inMin,float inMax,float outMin,float outMax,bool limit){if(inMax==inMin)return outMin;if(limit)value=clampFloat(value,inMin,inMax);return outMin+((value-inMin)/(inMax-inMin))*(outMax-outMin);}
float runPID(float &integral,float &prevError,uint32_t &lastAt,float &output,float pv,float sp,float kp,float ki,float kd,uint32_t sampleMs,float outMin,float outMax,bool cooling,bool manualMode,float manualOutput,uint32_t now){if(manualMode){output=clampFloat(manualOutput,outMin,outMax);return output;}sampleMs=max((uint32_t)20,sampleMs);if(lastAt&&now-lastAt<sampleMs)return output;float dt=max((float)sampleMs,(float)(lastAt?now-lastAt:sampleMs))/1000.0f;float error=(sp-pv)*(cooling?-1.0f:1.0f);float derivative=(error-prevError)/max(dt,0.001f);float candidate=integral+error*dt;float raw=kp*error+ki*candidate+kd*derivative;float limited=clampFloat(raw,outMin,outMax);if(raw==limited||((error>0)!=(raw-limited>0)))integral=candidate;prevError=error;lastAt=now;output=limited;return limited;}

void setupPWMOutput(uint8_t pin,uint8_t channel,uint32_t frequency,uint8_t resolution){
#if defined(ARDUINO_ARCH_ESP32)
  #if SIMUPLC_ESP_CORE3
    ledcAttach(pin,frequency,resolution);
  #else
    ledcSetup(channel,frequency,resolution);ledcAttachPin(pin,channel);
  #endif
#else
  (void)channel;(void)frequency;(void)resolution;pinMode(pin,OUTPUT);
#endif
}
void writePWMOutput(uint8_t pin,uint8_t channel,float percent,uint8_t resolution){
  percent=clampFloat(percent,0.0f,100.0f);
#if defined(ARDUINO_ARCH_ESP32)
  uint8_t bits=min((uint8_t)16,max((uint8_t)1,resolution));uint32_t maxDuty=(1UL<<bits)-1UL;uint32_t duty=(uint32_t)roundf(percent*maxDuty/100.0f);
  #if SIMUPLC_ESP_CORE3
    ledcWrite(pin,duty);
  #else
    ledcWrite(channel,duty);
  #endif
#else
  (void)channel;(void)resolution;analogWrite(pin,(int)roundf(percent*255.0f/100.0f));
#endif
}
void writeAnalogOutput(uint8_t pin,float volts,float minV,float maxV){
#if defined(ARDUINO_ARCH_ESP32)
  float ratio=(volts-minV)/(maxV-minV==0?1:(maxV-minV));ratio=clampFloat(ratio,0.0f,1.0f);dacWrite(pin,(uint8_t)roundf(ratio*255.0f));
#else
  (void)pin;(void)volts;(void)minV;(void)maxV;
#endif
}
int findTagIndex(const char* tag,const char* const* tags,uint8_t count){for(uint8_t i=0;i<count;i++)if(strcmp(tag,tags[i])==0)return i;return -1;}
bool effectiveDigitalInput(uint8_t ix){if(ix>=N_DIGITAL_INPUTS)return false;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalDigitalInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):hmiDigitalInputs[ix];return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):(physicalDigitalInputs[ix]||hmiDigitalInputs[ix]);}
float effectiveAnalogInput(uint8_t ix){if(ix>=N_ANALOG_INPUTS)return 0.0f;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalAnalogInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:0.0f;return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:physicalAnalogInputs[ix];}
const char* simuplcModeName(){return simuplcControlMode==SIMUPLC_HMI?"HMI":(simuplcControlMode==SIMUPLC_PHYSICAL?"PHYSICAL":"BOTH");}

void setup(){
  Serial.begin(SIMUPLC_SERIAL_BAUD);
  analogReadResolution(12);
  setupPWMOutput(PIN_PWM1,0,1000,8);
}

void readInputs(){
  AI1_raw = analogRead(PIN_AI1);
  physicalAnalogInputs[0] = mapFloat(AI1_raw,0.0f,4095.0f,0.0f,100.0f,true); AI1 = effectiveAnalogInput(0);
  AI2_raw = analogRead(PIN_AI2);
  physicalAnalogInputs[1] = mapFloat(AI2_raw,0.0f,4095.0f,0.0f,100.0f,true); AI2 = effectiveAnalogInput(1);
}

void plcScan(){
  uint32_t now = millis();
  PID1 = runPID(PID1_state.integral,PID1_state.prevError,PID1_state.lastAt,PID1_state.output,AI1,AI2,2.0f,0.05f,0.05f,100UL,0.0f,100.0f,false,false,0.0f,now);
  PWM1 = mapFloat(PID1,0.0f,100.0f,0.0f,100.0f,true);
}

void writeOutputs(){
  writePWMOutput(PIN_PWM1,0,PWM1,8);
}
void forceOutputsOff(){
  PWM1 = 0.0f;
  writeOutputs();
}
void controllerScan(uint32_t now){(void)now;readInputs();if(simuplcRunning){plcScan();writeOutputs();}else forceOutputsOff();}

void printBoolPair(const char* tag,bool value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value?1:0);}
void printFloatPair(const char* tag,float value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value,3);}
void sendSimuPLCState(){
  Serial.print(F("STATE"));
  printFloatPair(analogInputTags[0],AI1);Serial.print(char(44));Serial.print(analogInputTags[0]);Serial.print(F("_PHYSICAL,"));Serial.print(physicalAnalogInputs[0],3);Serial.print(char(44));Serial.print(analogInputTags[0]);Serial.print(F("_HMI,"));Serial.print(hmiAnalogInputs[0],3);
  printFloatPair(analogInputTags[1],AI2);Serial.print(char(44));Serial.print(analogInputTags[1]);Serial.print(F("_PHYSICAL,"));Serial.print(physicalAnalogInputs[1],3);Serial.print(char(44));Serial.print(analogInputTags[1]);Serial.print(F("_HMI,"));Serial.print(hmiAnalogInputs[1],3);
  printFloatPair(pwmOutputTags[0],PWM1);
  printFloatPair(pidTags[0],PID1);
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

void loop(){
  pollSimuPLCSerial();
  uint32_t now=millis();if(simuplcScanRequested||(uint32_t)(now-lastScan)>=20){simuplcScanRequested=false;lastScan=now;controllerScan(now);}
  if(simuplcProtocolActive&&(simuplcStateRequested||(uint32_t)(now-simuplcLastStateAt)>=SIMUPLC_STATE_PERIOD_MS))sendSimuPLCState();
}