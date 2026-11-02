/*
  SimuPLC Lab 1.6.2-phase3-mcu-fix - ESP32 desde LADDER PRO
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
const uint8_t PIN_PWM1 = 23;

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

void setup(){
  analogReadResolution(12);
  setupPWMOutput(PIN_PWM1,0,1000,8);
}

void readInputs(){
  AI1_raw = analogRead(PIN_AI1);
  AI1 = mapFloat(AI1_raw,0.0f,4095.0f,0.0f,100.0f,true);
  AI2_raw = analogRead(PIN_AI2);
  AI2 = mapFloat(AI2_raw,0.0f,4095.0f,0.0f,100.0f,true);
}

void plcScan(){
  uint32_t now = millis();
  PID1 = runPID(PID1_state.integral,PID1_state.prevError,PID1_state.lastAt,PID1_state.output,AI1,AI2,2.0f,0.05f,0.05f,100UL,0.0f,100.0f,false,false,0.0f,now);
  PWM1 = mapFloat(PID1,0.0f,100.0f,0.0f,100.0f,true);
}

void writeOutputs(){
  writePWMOutput(PIN_PWM1,0,PWM1,8);
}

void loop(){
  uint32_t now=millis(); if((uint32_t)(now-lastScan)<20)return; lastScan=now;
  readInputs();
  plcScan();
  writeOutputs();
}