(function(){
  'use strict';

  const VERSION='V21';
  const MODE_KEY='simuplc_global_control_mode_v21';
  const CFG_KEY='simuplc_codegen_hmi_v12';
  const VALID_MODES=['both','hmi','physical'];
  let generatorPatched=false;
  let observersStarted=false;
  let regenTimer=0;
  let decorateTimer=0;
  let modeSyncTimer=0;

  function cleanTag(value){return String(value||'').trim().toUpperCase();}
  function own(obj,key){return !!obj&&Object.prototype.hasOwnProperty.call(obj,key);}
  function readJson(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:fallback;}catch(_){return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}}
  function getMode(){const mode=String(localStorage.getItem(MODE_KEY)||'both').toLowerCase();return VALID_MODES.includes(mode)?mode:'both';}
  function modeCommand(mode){return mode==='hmi'?'HMI':mode==='physical'?'PHYSICAL':'BOTH';}
  function modeLabel(mode){return mode==='hmi'?'Solo HMI':mode==='physical'?'Solo físico':'Físico + HMI';}
  function modeDescription(mode){
    if(mode==='hmi')return 'Todas las entradas se controlan desde el HMI. Los pines físicos se siguen supervisando, pero no intervienen en la lógica.';
    if(mode==='physical')return 'Todas las entradas se controlan desde el Arduino. El HMI queda como visualización y sus mandos no envían órdenes.';
    return 'Comportamiento V19: los contactos NO trabajan por OR y los NC por AND; cualquiera de los dos medios puede actuar según su tipo.';
  }

  function getProject(){try{return window.SimuPLCHMI&&window.SimuPLCHMI.getProject?window.SimuPLCHMI.getProject():null;}catch(_){return null;}}
  function projectElements(){const p=getProject();return p&&Array.isArray(p.elements)?p.elements:[];}
  function findElement(tag){
    const key=cleanTag(tag);
    return projectElements().find(function(el){
      return el&&[el.tag,el.tag2].map(cleanTag).includes(key)&&['pushbutton','sensor','estop','selector','tank'].includes(el.type);
    })||null;
  }
  function fbdInputNode(tag){
    try{
      const list=(typeof window.nodes!=='undefined'&&Array.isArray(window.nodes))?window.nodes:[];
      return list.find(function(node){return node&&node.type==='input'&&cleanTag(node.name)===cleanTag(tag);})||null;
    }catch(_){return null;}
  }
  function isNc(tag){
    const el=findElement(tag);
    if(el&&el.contactType==='nc')return true;
    const node=fbdInputNode(tag);
    const mode=String(node&&((node.el&&node.el.dataset&&(node.el.dataset.inputMode||node.el.dataset.mode))||node.inputMode||node.mode)||'').toLowerCase();
    if(/(?:^|-|_)nc(?:$|-|_)/.test(mode))return true;
    if(node&&node.el&&node.el.dataset&&node.el.dataset.nc==='true')return true;
    const label=String((el&&el.label)||(node&&node.name)||tag||'');
    return /STOP|PARADA|EMERGENCIA|E-?STOP|\bNC\b/i.test(label);
  }

  function updateModeUi(){
    const mode=getMode();
    document.documentElement.dataset.simuplcControlMode=mode;
    const host=document.getElementById('hmiHost');if(host)host.dataset.controlMode=mode;
    document.querySelectorAll('[data-global-control-mode]').forEach(function(button){
      const active=button.dataset.globalControlMode===mode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    const select=document.getElementById('arduinoGlobalControlModeV21');if(select)select.value=mode;
    const help=document.getElementById('arduinoGlobalControlHelpV21');if(help)help.textContent=modeDescription(mode);
    const badge=document.getElementById('hmiGlobalModeBadgeV21');if(badge){badge.textContent=modeLabel(mode);badge.dataset.mode=mode;}
  }

  async function sendModeToController(mode){
    const io=window.SimuPLCExternalIO;
    if(!(io&&io.isConnected&&io.isConnected()))return;
    try{
      if(io.sendCommand)await io.sendCommand('MODE,'+modeCommand(mode));
      clearTimeout(modeSyncTimer);
      modeSyncTimer=setTimeout(function(){try{io.requestState&&io.requestState();}catch(_){}},100);
    }catch(error){console.warn('[SimuPLC V21] No se pudo sincronizar el modo global:',error);}
  }

  function setMode(mode,options){
    mode=VALID_MODES.includes(mode)?mode:'both';
    try{localStorage.setItem(MODE_KEY,mode);}catch(_){}
    const cfg=readJson(CFG_KEY,{});
    cfg.globalControlMode=mode;
    cfg.statePeriodMs=50;
    cfg.version=21;
    writeJson(CFG_KEY,cfg);
    updateModeUi();
    window.dispatchEvent(new CustomEvent('simuplc-control-mode-change',{detail:{mode:mode,label:modeLabel(mode)}}));
    if(!options||options.send!==false)sendModeToController(mode);
    setTimeout(function(){
      if(mode!=='physical'&&window.SimuPLCHMI&&window.SimuPLCHMI.syncInputs){try{window.SimuPLCHMI.syncInputs();}catch(_){}}
      decorateControls();
    },45);
    scheduleRegenerate();
    return mode;
  }

  function ensureToolbarMode(){
    const toolbar=document.querySelector('#hmiHost .hmi-editor-toolbar');
    if(!toolbar||document.getElementById('hmiGlobalControlV21'))return;
    const wrap=document.createElement('div');
    wrap.id='hmiGlobalControlV21';
    wrap.className='hmi-global-control-v21';
    wrap.setAttribute('role','group');
    wrap.setAttribute('aria-label','Modo global de entradas');
    wrap.innerHTML='<span class="hmi-global-caption">CONTROL</span>'+
      '<button type="button" data-global-control-mode="hmi" title="Ignorar todas las entradas físicas">HMI</button>'+
      '<button type="button" data-global-control-mode="physical" title="Usar únicamente pulsadores, selectores y sensores físicos">FÍSICO</button>'+
      '<button type="button" data-global-control-mode="both" title="Usar HMI y controles físicos como en la V19">AMBOS</button>'+
      '<b id="hmiGlobalModeBadgeV21"></b>';
    const connect=document.getElementById('hmiIoConnectBtn');
    if(connect&&connect.parentNode===toolbar)toolbar.insertBefore(wrap,connect);else toolbar.appendChild(wrap);
    wrap.querySelectorAll('button').forEach(function(button){button.addEventListener('click',function(){setMode(button.dataset.globalControlMode);});});
    updateModeUi();
  }

  function ensureCodegenGlobalUi(){
    const box=document.getElementById('arduinoHmiBox');if(!box)return;
    const inputTitle=Array.from(box.querySelectorAll('.title')).find(function(el){return /Origen de cada entrada/i.test(el.textContent||'');});
    const inputWrap=document.getElementById('arduinoHmiInputs');
    if(inputTitle)inputTitle.textContent='Modo global de entradas';
    if(inputWrap){inputWrap.hidden=true;inputWrap.style.display='none';}
    let global=document.getElementById('arduinoGlobalControlBoxV21');
    if(!global){
      global=document.createElement('div');
      global.id='arduinoGlobalControlBoxV21';
      global.className='arduino-global-control-v21';
      global.innerHTML='<label>Fuente para todas las entradas<select id="arduinoGlobalControlModeV21">'+
        '<option value="hmi">Solo HMI</option><option value="physical">Solo física</option><option value="both">Físico + HMI (igual que V19)</option></select></label>'+
        '<p id="arduinoGlobalControlHelpV21"></p><small>Esta única selección se aplica a I1, I2, I3… y queda integrada en el archivo .ino.</small>';
      if(inputWrap&&inputWrap.parentNode)inputWrap.parentNode.insertBefore(global,inputWrap);else box.appendChild(global);
      global.querySelector('select').addEventListener('change',function(){setMode(this.value,{send:false});});
    }
    const sub=Array.from(box.querySelectorAll('.sub2')).find(function(el){return /Físico \+ HMI deja disponibles/i.test(el.textContent||'');});
    if(sub)sub.textContent='Selecciona una sola vez cómo trabajarán todas las entradas. No necesitas configurar I1, I2, I3… una por una.';
    const period=document.getElementById('arduinoHmiPeriod');
    if(period){period.value='50';period.disabled=true;}
    const status=document.getElementById('arduinoHmiStatus');
    if(status)status.textContent='Generador HMI V21 activo · modo global · respuesta inmediata · estados físicos visibles en el HMI.';
    updateModeUi();
  }

  function parseInputTags(code){
    const match=String(code).match(/const char\* HMI_INPUT_TAGS\[[^\]]+\]=\{([^}]*)\};/);
    if(!match)return [];
    const tags=[];
    match[1].replace(/"([^"]*)"/g,function(all,tag){if(tag)tags.push(cleanTag(tag));return all;});
    return tags;
  }


  function parseInputNcFlags(code,tags){
    const sourceMatch=String(code).match(/const uint8_t hmiInputSource\[HMI_SAFE_INPUT_COUNT\]=\{([^}]*)\};/);
    const sourceModes=sourceMatch?sourceMatch[1].split(',').map(function(value){return Number(String(value).trim());}):[];
    return tags.map(function(tag,index){
      const escaped=String(tag).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const comment=new RegExp('\\/\\/\\s*'+escaped+'\\s*:\\s*contacto\\s+(NO|NC)','i').exec(code);
      if(comment)return String(comment[1]).toUpperCase()==='NC';
      if(sourceModes[index]===3)return true;
      if(sourceModes[index]===2)return false;
      return isNc(tag);
    });
  }

  function upgradeGeneratedCode(source){
    let code=String(source||'');
    if(code.includes('SIMUPLC HMI READY CODE V21'))return code;
    if(!/SIMUPLC HMI READY CODE V(?:12|15|16|17|20)/.test(code))return code;

    const tags=parseInputTags(code);
    const ncFlags=parseInputNcFlags(code,tags);
    const hmiDefaults=ncFlags.map(function(nc){return nc?'true':'false';});
    const defaultMode=getMode()==='hmi'?1:getMode()==='physical'?2:0;

    code=code
      .replace(/SIMUPLC HMI READY CODE V(?:12|15|16|17|20)/g,'SIMUPLC HMI READY CODE V21')
      .replace(/READY_CODE_V(?:12|15|16|17|20)/g,'READY_CODE_V21')
      .replace(/GENERADOR HMI V(?:12|15|16|17|20)/g,'GENERADOR HMI V21');

    code=code.replace(/const uint32_t HMI_STATE_PERIOD_MS=\d+UL;/,'const uint32_t HMI_STATE_PERIOD_MS=50UL;');
    code=code.replace(/const uint16_t INPUT_DEBOUNCE_MS = \d+;/,'const uint16_t INPUT_DEBOUNCE_MS = 20;');
    code=code.replace(/bool hmiInputValues\[HMI_SAFE_INPUT_COUNT\]=\{[^;]*\};/,'bool hmiInputValues[HMI_SAFE_INPUT_COUNT]={'+(hmiDefaults.join(', ')||'false')+'};');
    code=code.replace(/const uint8_t hmiInputSource\[HMI_SAFE_INPUT_COUNT\]=\{[^;]*\};[^\n]*/,'const bool hmiInputIsNc[HMI_SAFE_INPUT_COUNT]={'+(ncFlags.map(function(value){return value?'true':'false';}).join(', ')||'false')+'}; // true=NC, false=NO');

    code=code.replace(
      'bool hmiControllerRunning=HMI_START_ON_BOOT;\nuint32_t hmiLastMessageMs=0,hmiLastStateMs=0;',
      'const uint8_t HMI_MODE_BOTH=0,HMI_MODE_HMI=1,HMI_MODE_PHYSICAL=2;\n'+
      'const uint8_t HMI_DEFAULT_CONTROL_MODE='+defaultMode+';\n'+
      'uint8_t hmiControlMode=HMI_DEFAULT_CONTROL_MODE;\n'+
      'bool hmiControllerRunning=HMI_START_ON_BOOT||(HMI_DEFAULT_CONTROL_MODE==HMI_MODE_PHYSICAL);\n'+
      'uint32_t hmiLastMessageMs=0,hmiLastStateMs=0;\n'+
      'bool hmiScanRequested=true;\n'+
      'bool hmiStateRequested=true;\n'+
      'bool hmiStateInitialized=false;\n'+
      'bool hmiLastControllerRunning=false;\n'+
      'uint8_t hmiLastControlMode=255;\n'+
      'bool hmiLastLogicalInputs[HMI_SAFE_INPUT_COUNT]={false};\n'+
      'bool hmiLastPhysicalInputs[HMI_SAFE_INPUT_COUNT]={false};\n'+
      'bool hmiLastHmiInputs[HMI_SAFE_INPUT_COUNT]={false};\n'+
      'bool hmiLastLogicalOutputs[HMI_SAFE_OUTPUT_COUNT]={false};'
    );

    code=code.replace(/bool hmiCombineInput\(uint8_t ix,bool physicalValue\)\{[^\n]*\}/,
`bool hmiCombineInput(uint8_t ix,bool physicalValue){
  if(ix>=HMI_INPUT_COUNT)return physicalValue;
  if(hmiPhysicalValues[ix]!=physicalValue){hmiPhysicalValues[ix]=physicalValue;hmiStateRequested=true;}
  if(hmiControlMode==HMI_MODE_HMI)return hmiInputValues[ix];
  if(hmiControlMode==HMI_MODE_PHYSICAL)return physicalValue;
  return hmiInputIsNc[ix]?(physicalValue&&hmiInputValues[ix]):(physicalValue||hmiInputValues[ix]);
}`);

    const statePattern=/String hmiBuildState\(\)\{[^\n]*\}\nvoid hmiSendState\(\);\nvoid hmiProcessCommand\(String command\)\{[^\n]*\}\nvoid hmiSendState\(\)\{[^\n]*\}/;
    const stateRuntime=`const char* hmiControlModeName(){return hmiControlMode==HMI_MODE_HMI?"HMI":(hmiControlMode==HMI_MODE_PHYSICAL?"PHYSICAL":"BOTH");}
String hmiBuildState(){String s="STATE";for(uint8_t i=0;i<HMI_INPUT_COUNT;i++){s+=',';s+=HMI_INPUT_TAGS[i];s+=',';s+=(hmiLogicalInput(i)?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_PHYSICAL,";s+=(hmiPhysicalValues[i]?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_HMI,";s+=(hmiInputValues[i]?'1':'0');}for(uint8_t i=0;i<HMI_OUTPUT_COUNT;i++){s+=',';s+=HMI_OUTPUT_TAGS[i];s+=',';s+=(hmiLogicalOutput(i)?'1':'0');}s+=",RUNNING,";s+=(hmiControllerRunning?'1':'0');s+=",CONTROL_MODE,";s+=hmiControlModeName();return s;}
bool hmiStateChanged(){
  bool changed=!hmiStateInitialized||hmiLastControllerRunning!=hmiControllerRunning||hmiLastControlMode!=hmiControlMode;
  for(uint8_t i=0;i<HMI_INPUT_COUNT;i++){
    bool logical=hmiLogicalInput(i);
    if(hmiLastLogicalInputs[i]!=logical||hmiLastPhysicalInputs[i]!=hmiPhysicalValues[i]||hmiLastHmiInputs[i]!=hmiInputValues[i])changed=true;
    hmiLastLogicalInputs[i]=logical;hmiLastPhysicalInputs[i]=hmiPhysicalValues[i];hmiLastHmiInputs[i]=hmiInputValues[i];
  }
  for(uint8_t i=0;i<HMI_OUTPUT_COUNT;i++){bool logical=hmiLogicalOutput(i);if(hmiLastLogicalOutputs[i]!=logical)changed=true;hmiLastLogicalOutputs[i]=logical;}
  hmiLastControllerRunning=hmiControllerRunning;hmiLastControlMode=hmiControlMode;hmiStateInitialized=true;return changed;
}
void hmiSendState();
void hmiProcessCommand(String command){
  command.trim();if(!command.length())return;hmiLastMessageMs=millis();
  if(command=="PING"){hmiTransportSend("PONG");return;}
  if(command=="GET_STATE"){hmiScanRequested=true;hmiStateRequested=true;return;}
  if(command=="RUN,1"||command=="RUN"){hmiControllerRunning=true;hmiScanRequested=true;hmiStateRequested=true;return;}
  if(command=="STOP"||command=="RUN,0"){hmiControllerRunning=false;hmiForceOutputsOff();hmiStateRequested=true;hmiSendState();return;}
  if(command.startsWith("HELLO")){hmiTransportSend("OK,SIMUPLC,READY_CODE_V21,1");hmiScanRequested=true;hmiStateRequested=true;return;}
  if(command.startsWith("MODE,")){
    String value=command.substring(5);value.trim();value.toUpperCase();
    uint8_t next=hmiControlMode;
    if(value=="HMI")next=HMI_MODE_HMI;else if(value=="PHYSICAL"||value=="FISICO")next=HMI_MODE_PHYSICAL;else if(value=="BOTH"||value=="AMBOS")next=HMI_MODE_BOTH;
    if(next!=hmiControlMode){hmiControlMode=next;if(next==HMI_MODE_PHYSICAL)hmiControllerRunning=true;hmiScanRequested=true;hmiStateRequested=true;}else hmiStateRequested=true;
    return;
  }
  if(command.startsWith("SET,")){
    int p=command.indexOf(',',4);
    if(p>4){String tag=command.substring(4,p);int ix=hmiFindInput(tag);if(ix>=0){bool next=command.substring(p+1).toInt()!=0;if(hmiInputValues[ix]!=next){hmiInputValues[ix]=next;hmiStateRequested=true;}hmiScanRequested=true;}}
    return;
  }
  hmiTransportSend("ERROR,COMANDO_NO_RECONOCIDO");
}
void hmiSendState(){hmiTransportSend(hmiBuildState());hmiLastStateMs=millis();hmiStateRequested=false;hmiStateChanged();}`;
    code=code.replace(statePattern,stateRuntime);

    code=code.replace(/void hmiBegin\(\)\{hmiLastMessageMs=millis\(\);hmiTransportBegin\(\);hmiSendState\(\);\}/,
      'void hmiBegin(){hmiLastMessageMs=millis();hmiTransportBegin();hmiScanRequested=true;hmiStateRequested=true;}');
    code=code.replace(/void hmiLoop\(\)\{hmiTransportLoop\(\);if\(HMI_STOP_ON_TIMEOUT&&hmiControllerRunning&&\(uint32_t\)\(millis\(\)-hmiLastMessageMs\)>HMI_TIMEOUT_MS\)\{hmiControllerRunning=false;hmiForceOutputsOff\(\);\}\}/,
      'void hmiLoop(){hmiTransportLoop();if(HMI_STOP_ON_TIMEOUT&&hmiControlMode!=HMI_MODE_PHYSICAL&&hmiControllerRunning&&(uint32_t)(millis()-hmiLastMessageMs)>HMI_TIMEOUT_MS){hmiControllerRunning=false;hmiForceOutputsOff();hmiStateRequested=true;hmiSendState();}}');
    code=code.replace(/void hmiMaybeSendState\(\)\{uint32_t now=millis\(\);if\(\(uint32_t\)\(now-hmiLastStateMs\)>=HMI_STATE_PERIOD_MS\)\{hmiLastStateMs=now;hmiSendState\(\);\}\}/,
      'void hmiMaybeSendState(){uint32_t now=millis();bool changed=hmiStateChanged();if(changed||hmiStateRequested||(uint32_t)(now-hmiLastStateMs)>=HMI_STATE_PERIOD_MS)hmiSendState();}');

    code=code.replace(/if\(\(uint32_t\)\(nowMs - lastScan\) < SCAN_MS\) return;\n  lastScan = nowMs;/,
      'if(!hmiScanRequested && (uint32_t)(nowMs - lastScan) < SCAN_MS) return;\n  hmiScanRequested=false;\n  lastScan = nowMs;');
    code=code.replace(/if\(nowMs - lastScan < SCAN_MS\) return;\n  lastScan = nowMs;/,
      'if(!hmiScanRequested && nowMs - lastScan < SCAN_MS) return;\n  hmiScanRequested=false;\n  lastScan = nowMs;');
    code=code.replace(/if\(\(uint32_t\)\(nowMs-lastScan\)<SCAN_MS\)return;lastScan=nowMs;/,
      'if(!hmiScanRequested&&(uint32_t)(nowMs-lastScan)<SCAN_MS)return;hmiScanRequested=false;lastScan=nowMs;');

    return code;
  }

  function patchGenerator(){
    if(generatorPatched)return true;
    if(!window.__simuplcCodegenV17Patched||typeof window.generateArduinoSketch!=='function'||typeof window.SimuPLCWrapGeneratedSketch!=='function')return false;
    generatorPatched=true;
    const oldGenerate=window.generateArduinoSketch;
    window.generateArduinoSketch=function(){return upgradeGeneratedCode(oldGenerate.apply(this,arguments));};
    const oldWrap=window.SimuPLCWrapGeneratedSketch;
    window.SimuPLCWrapGeneratedSketch=function(){return upgradeGeneratedCode(oldWrap.apply(this,arguments));};
    window.SimuPLCCodegenVersion=VERSION;
    window.__SimuPLCV21UpgradeGeneratedCode=upgradeGeneratedCode;
    return true;
  }

  function scheduleRegenerate(){
    clearTimeout(regenTimer);
    regenTimer=setTimeout(function(){
      try{
        const text=document.getElementById('arduinoCode');
        if(text&&typeof window.generateArduinoSketch==='function')text.value=window.generateArduinoSketch();
        else if(typeof window.SimuPLCGenerateLadderArduinoNow==='function')window.SimuPLCGenerateLadderArduinoNow();
      }catch(_){}
    },90);
  }

  function extState(){const io=window.SimuPLCExternalIO;try{return io&&io.getState?io.getState():null;}catch(_){return null;}}
  function inputActionState(raw,nc){return nc?!raw:!!raw;}
  function setSelectorVisual(node,el,state,source){
    let pos=0;
    const tag1=cleanTag(el.tag),tag2=cleanTag(el.tag2);
    const one=tag1&&source&&own(source,tag1)?!!source[tag1]:false;
    const two=tag2&&source&&own(source,tag2)?!!source[tag2]:false;
    if(String(el.selectorType)==='3')pos=one?1:(two?2:0);else pos=one?1:0;
    const angle=String(el.selectorType)==='3'?(pos===1?-55:(pos===2?55:0)):(pos===1?55:-55);
    node.style.setProperty('--selector-angle',angle+'deg');
    const knob=node.querySelector('.hmi-selector-knob');if(knob)knob.style.setProperty('--selector-angle',angle+'deg');
    const label=node.querySelector('.hmi-selector-position');if(label)label.textContent=(getMode()==='physical'?'FÍSICO ':'POS ')+pos;
    node.classList.toggle('active',pos!==0);
  }
  function ensureObjectModeBadge(node){let badge=node.querySelector('.hmi-global-source-v21');if(!badge){badge=document.createElement('div');badge.className='hmi-global-source-v21';node.appendChild(badge);}return badge;}
  function decorateControls(){
    clearTimeout(decorateTimer);
    const state=extState(),ready=!!(state&&state.ready),mode=getMode(),project=getProject();
    if(!project||!Array.isArray(project.elements))return;
    project.elements.forEach(function(el){
      if(!el)return;
      const node=document.querySelector('#hmiCanvas [data-id="'+el.id+'"]');if(!node)return;
      if(['pushbutton','sensor','estop','selector'].includes(el.type)){
        const badge=ensureObjectModeBadge(node);badge.textContent=mode==='hmi'?'HMI':mode==='physical'?'FÍSICO':'AMBOS';badge.dataset.mode=mode;
      }
      if(!ready)return;
      if(el.type==='selector'){
        const source=mode==='physical'?state.physicalInputs:(mode==='hmi'?state.hmiInputs:state.inputs);
        setSelectorVisual(node,el,state,source);return;
      }
      if(['pushbutton','sensor','estop'].includes(el.type)){
        const tag=cleanTag(el.tag);if(!tag)return;
        const nc=el.contactType==='nc';
        const source=mode==='physical'?state.physicalInputs:(mode==='hmi'?state.hmiInputs:state.inputs);
        const raw=source&&own(source,tag)?!!source[tag]:nc;
        const action=inputActionState(raw,nc);
        if(mode==='physical')node.classList.toggle('pressed',action);
        node.classList.toggle('on',action);
        node.classList.toggle('physical-active',mode==='physical'&&action);
        if(el.type==='sensor'){
          const info=node.querySelector('[data-sensor-source]');if(info)info.textContent=action?(mode==='physical'?'FÍSICO':mode==='hmi'?'HMI':'ACTIVO'):'INACTIVO';
        }
      }
    });
  }

  function blockPhysicalOnlyControls(event){
    if(getMode()!=='physical')return;
    const target=event.target&&event.target.closest?event.target.closest('#hmiCanvas .hmi-object'):null;if(!target)return;
    const type=target.dataset.type;
    if(!['pushbutton','sensor','estop','selector','tank'].includes(type))return;
    if(type==='tank'&&!event.target.closest('[data-tank-control]'))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const badge=document.getElementById('hmiGlobalModeBadgeV21');if(badge){badge.classList.add('notice');setTimeout(function(){badge.classList.remove('notice');},500);}
  }

  function patchExternalApi(){
    const io=window.SimuPLCExternalIO;if(!io||io.__v21Patched)return false;
    io.__v21Patched=true;
    io.setGlobalControlMode=setMode;
    io.getGlobalControlMode=getMode;
    const oldConnect=io.connect;
    io.connect=async function(){const result=await oldConnect.apply(this,arguments);await sendModeToController(getMode());return result;};
    return true;
  }
  function patchHmiApi(){
    const api=window.SimuPLCHMI;if(!api||api.__v21Patched)return false;
    api.__v21Patched=true;
    const oldRefresh=api.refreshExternalState;
    if(typeof oldRefresh==='function')api.refreshExternalState=function(){const result=oldRefresh.apply(this,arguments);setTimeout(decorateControls,0);return result;};
    api.getGlobalControlMode=getMode;
    api.setGlobalControlMode=setMode;
    return true;
  }

  function installStyles(){
    if(document.getElementById('simuplc-v21-styles'))return;
    const style=document.createElement('style');style.id='simuplc-v21-styles';style.textContent=`
      #hmiGlobalControlV21{display:inline-flex;align-items:center;gap:3px;padding:3px;border:1px solid #94a3b8;border-radius:11px;background:#e2e8f0;flex:0 0 auto}
      #hmiGlobalControlV21 .hmi-global-caption{padding:0 5px;font:900 9px Arial;color:#475569;letter-spacing:.4px}
      #hmiGlobalControlV21 button{height:32px;border:0;border-radius:8px;background:transparent;padding:0 9px;font:900 10px Arial;color:#334155;cursor:pointer;touch-action:manipulation}
      #hmiGlobalControlV21 button.active{background:#075985;color:#fff;box-shadow:0 2px 5px rgba(7,89,133,.25)}
      #hmiGlobalModeBadgeV21{display:none;padding:0 7px;font:900 9px Arial;color:#075985}
      #hmiGlobalModeBadgeV21.notice{display:inline-flex;animation:v21ModeNotice .5s ease}
      @keyframes v21ModeNotice{50%{transform:scale(1.12);color:#dc2626}}
      .arduino-global-control-v21{margin:8px 0;padding:10px;border:1px solid #93c5fd;border-radius:11px;background:#eff6ff}
      .arduino-global-control-v21 label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:900}
      .arduino-global-control-v21 select{height:40px;border:1px solid #60a5fa;border-radius:9px;background:#fff;padding:0 9px;color:#0f172a;font-weight:800}
      .arduino-global-control-v21 p{margin:7px 0 3px;font:800 11px/1.35 Arial;color:#1e3a8a}
      .arduino-global-control-v21 small{display:block;color:#475569;line-height:1.35}
      #hmiCanvas .hmi-global-source-v21{max-width:92%;padding:2px 7px;border-radius:999px;background:rgba(226,232,240,.94);color:#334155;font:900 clamp(7px,1vw,9px)/1.2 Arial;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,.18);pointer-events:none}
      #hmiCanvas .hmi-global-source-v21[data-mode="hmi"]{background:#dcfce7;color:#166534}
      #hmiCanvas .hmi-global-source-v21[data-mode="physical"]{background:#dbeafe;color:#1d4ed8}
      #hmiCanvas .hmi-global-source-v21[data-mode="both"]{background:#fef3c7;color:#92400e}
      #hmiHost[data-control-mode="physical"] #hmiCanvas .hmi-object-pushbutton,#hmiHost[data-control-mode="physical"] #hmiCanvas .hmi-object-estop,#hmiHost[data-control-mode="physical"] #hmiCanvas .hmi-object-sensor,#hmiHost[data-control-mode="physical"] #hmiCanvas .hmi-selector,#hmiHost[data-control-mode="physical"] #hmiCanvas [data-tank-control]{cursor:not-allowed!important}
      body.mode-hmi{overflow:hidden!important;overscroll-behavior:none}
      body.mode-hmi #hmiHost{width:100vw!important;max-width:100vw!important;overflow:hidden!important}
      #hmiHost .hmi-editor-toolbar{scrollbar-width:thin;overscroll-behavior-x:contain}
      #hmiHost .hmi-editor-toolbar::-webkit-scrollbar{height:4px}
      #hmiHost .hmi-editor-toolbar::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:999px}
      #hmiNavHmiBtn{display:none!important}
      #hmiHost .hmi-app-shell.operation-mode #hmiApplyTemplateBtn,#hmiHost .hmi-app-shell.operation-mode #hmiTemplateSelect,#hmiHost .hmi-app-shell.operation-mode #hmiProgramSource{display:none!important}
      #hmiHost:not(.hmi-kiosk) #hmiFloatToggleUiBtn{display:none!important}
      #hmiHost.hmi-kiosk #hmiFloatToggleUiBtn{display:block!important}
      @media(max-width:900px){
        #hmiHost .hmi-editor-toolbar{height:auto!important;min-height:50px!important;padding:5px 6px!important;gap:5px!important;overflow-x:auto!important;flex-wrap:nowrap!important;align-items:center!important}
        #hmiHost .hmi-toolbar-btn,#hmiHost .hmi-nav-btn,#hmiGlobalControlV21 button,#hmiIoConnectBtn,#hmiIoSettingsBtn{min-height:40px!important;height:40px!important;flex:0 0 auto!important}
        #hmiGlobalControlV21{position:sticky;left:0;z-index:12;background:#e2e8f0;box-shadow:4px 0 8px rgba(15,23,42,.08)}
        #hmiGlobalControlV21 .hmi-global-caption{display:none}
        #hmiGlobalControlV21 button{padding:0 8px;font-size:9px}
        #hmiHost .hmi-editor-layout{padding:3px!important}
        #hmiHost .hmi-viewport{height:calc(100dvh - 54px)!important;min-height:300px!important}
        #hmiHost .hmi-canvas-stage{margin:4px auto!important}
        #hmiHost .hmi-canvas{touch-action:manipulation}
        #hmiHost .hmi-toolbar-separator{display:none!important}
      }
      @media(max-width:560px){
        #hmiGlobalControlV21 button{padding:0 6px;font-size:8.5px}
        #hmiHost .hmi-start-btn,#hmiHost .hmi-stop-btn{padding:0 8px!important;font-size:10px!important}
        #hmiIoConnectBtn{max-width:100px;overflow:hidden;text-overflow:ellipsis}
        #hmiHost .hmi-connection-badge{display:none!important}
        #hmiHost .hmi-toolbar-field{font-size:9px!important}
      }
    `;document.head.appendChild(style);
  }

  function startObservers(){
    if(observersStarted)return;observersStarted=true;
    document.addEventListener('pointerdown',blockPhysicalOnlyControls,true);
    window.addEventListener('simuplc-external-state',function(event){
      const detail=event&&event.detail;
      if(detail&&detail.controlMode){const remote=String(detail.controlMode).toLowerCase();if(VALID_MODES.includes(remote)&&remote!==getMode()){try{localStorage.setItem(MODE_KEY,remote);}catch(_){}updateModeUi();}}
      setTimeout(decorateControls,0);
    });
    window.addEventListener('simuplc-control-mode-change',function(){setTimeout(decorateControls,0);});
    setInterval(function(){ensureToolbarMode();ensureCodegenGlobalUi();patchExternalApi();patchHmiApi();decorateControls();},220);
  }

  function boot(){
    installStyles();
    if(!localStorage.getItem(MODE_KEY))localStorage.setItem(MODE_KEY,'both');
    const cfg=readJson(CFG_KEY,{});if(!cfg.globalControlMode)cfg.globalControlMode=getMode();cfg.statePeriodMs=50;cfg.version=21;writeJson(CFG_KEY,cfg);
    patchGenerator();patchExternalApi();patchHmiApi();ensureToolbarMode();ensureCodegenGlobalUi();updateModeUi();startObservers();decorateControls();
    setTimeout(function(){sendModeToController(getMode());},300);
  }

  window.SimuPLCGlobalControl={getMode:getMode,setMode:setMode,upgradeGeneratedCode:upgradeGeneratedCode,version:VERSION};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,100);},{once:true});else setTimeout(boot,100);
  const retry=setInterval(function(){patchGenerator();patchExternalApi();patchHmiApi();ensureToolbarMode();ensureCodegenGlobalUi();},140);
  setTimeout(function(){clearInterval(retry);boot();},5000);
})();
