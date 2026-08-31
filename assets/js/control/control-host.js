(function(){
  'use strict';
  if(window.__SIMUPLC_CONTROL_HOST_V24__) return;
  window.__SIMUPLC_CONTROL_HOST_V24__=true;

  function frame(){ return document.getElementById('controlFrame'); }
  function ladderFrame(){ return document.getElementById('ladderFrame'); }
  function controlWindow(){ const f=frame(); return f&&f.contentWindow; }
  function ladderWindow(){ const f=ladderFrame(); return f&&f.contentWindow; }
  function postControl(payload){ const w=controlWindow(); if(!w)return false; try{w.postMessage(payload,'*');return true;}catch(_){return false;} }
  function ladderPost(action,payload){ const w=ladderWindow(); if(!w)return false; try{w.postMessage({type:'SIMUPLC_HMI_BRIDGE',action:action,payload:payload||{}},'*');return true;}catch(_){return false;} }

  function send(cmd, data){
    return new Promise(function(resolve){
      const target = controlWindow();
      if(!target){ resolve({ok:false,error:'no-frame'}); return; }
      const requestId = 'ctrl_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      const tm = setTimeout(function(){ window.removeEventListener('message', onMsg); resolve({ok:false,error:'timeout'}); }, 2500);
      function onMsg(ev){
        const msg = ev.data || {};
        if(!msg.__simuplcControlHost || msg.requestId!==requestId) return;
        clearTimeout(tm); window.removeEventListener('message', onMsg); resolve(msg);
      }
      window.addEventListener('message', onMsg);
      target.postMessage({__simuplcControlHost:true, requestId:requestId, cmd:cmd, data:data}, '*');
    });
  }

  function normalizeSource(v){ return String(v||'').toLowerCase()==='fbd'?'fbd':'ladder'; }
  let selectedSource=(function(){try{return normalizeSource(localStorage.getItem('simuplc_control_program_source'));}catch(_){return 'ladder';}})();
  let runtimeOn=false, pollTimer=0, lastInputs={}, lastElectricalInputs={}, lastAnalogInputs={};
  let hmiControlState={inputs:{},outputs:{},states:{},analogInputs:{},analogOutputs:{},analogRuntime:{},analogMeta:{},simulationOn:false,receivedAt:0};
  function saveSource(){try{localStorage.setItem('simuplc_control_program_source',selectedSource);}catch(_){} }
  function announceLink(){ postControl({type:'SIMUPLC_CONTROL_LINK_CONFIG',linked:true,source:selectedSource}); }
  function setSource(source){ selectedSource=normalizeSource(source);saveSource();announceLink();return selectedSource; }

  // CONTROL entrega el estado electrico REAL de cada borne I del PLC. El motor KOP
  // conserva, por compatibilidad, state.simValues como estado mecanico/accionado del
  // dispositivo de campo. Convertimos aqui sin alterar Ladder: para una entrada fisica
  // NC, PLC=1 en reposo equivale a actuador=false; para NO, PLC=1 equivale a actuador=true.
  function ladderPhysicalInputTypes(){
    const out={};
    try{
      const w=ladderWindow(), api=w&&w.LadderEditor, model=api&&typeof api.getProject==='function'?api.getProject():null;
      function walk(list){(list||[]).forEach(function(el){
        if(!el)return;
        const label=String(el.label||'').trim().toUpperCase(), t=String(el.type||'').trim().toUpperCase();
        if(/^I(?:\d|\.)/i.test(label)&&(t==='NO'||t==='NC')&&!(label in out)) out[label]=String(el.physicalInputType||el.inputPhysicalType||'NO').toUpperCase()==='NC'?'NC':'NO';
        if(t==='BRANCH'&&Array.isArray(el.branches))el.branches.forEach(walk);
      });}
      (model&&model.rungs||[]).forEach(function(r){walk(r&&r.elements||[]);});
    }catch(_){ }
    return out;
  }
  function electricalToLadderActuation(values){
    const types=ladderPhysicalInputTypes(), out={};
    Object.keys(values||{}).forEach(function(k){
      const key=String(k).trim().toUpperCase(), electrical=!!values[k];
      if(!key)return;
      out[key]=types[key]==='NC'?!electrical:electrical;
    });
    return out;
  }

  function fbdNodes(){try{return window.SimuPLCFBDAdapter&&window.SimuPLCFBDAdapter.getNodes?window.SimuPLCFBDAdapter.getNodes():[];}catch(_){return[];} }
  function fbdRunning(){try{return !!(window.SimuPLCFBDSimulation&&window.SimuPLCFBDSimulation.isRunning&&window.SimuPLCFBDSimulation.isRunning());}catch(_){return false;} }
  function fbdStart(){try{return !!(window.SimuPLCFBDSimulation&&window.SimuPLCFBDSimulation.start&&window.SimuPLCFBDSimulation.start());}catch(_){return false;} }
  function fbdStop(){try{if(window.SimuPLCFBDSimulation&&window.SimuPLCFBDSimulation.stop)window.SimuPLCFBDSimulation.stop({silent:true});}catch(_){} }
  function fbdSetInputs(values){
    const norm={};Object.keys(values||{}).forEach(function(k){const key=String(k||'').trim().toUpperCase();if(key)norm[key]=!!values[k];});
    try{
      const compat=window.SimuPLCHMIFBDCompat;
      if(compat&&typeof compat.setDigitalInput==='function')Object.keys(norm).forEach(function(k){compat.setDigitalInput(k,norm[k]);});
      else fbdNodes().forEach(function(n){const key=String(n&&n.name||'').trim().toUpperCase();if(n&&n.type==='input'&&Object.prototype.hasOwnProperty.call(norm,key)){n.value=norm[key]?1:0;n.el&&n.el.classList.toggle('active',norm[key]);}});
      if(window.SimuPLCFBDSimulation&&typeof window.SimuPLCFBDSimulation.scan==='function')window.SimuPLCFBDSimulation.scan();
    }catch(_){}
  }
  function fbdSetAnalogInputs(values){
    const norm={};Object.keys(values||{}).forEach(function(k){const key=String(k||'').trim().toUpperCase(),v=Number(values[k]);if(key&&Number.isFinite(v))norm[key]=v;});
    try{
      const compat=window.SimuPLCHMIFBDCompat;
      if(compat&&typeof compat.setAnalogInput==='function'){
        Object.keys(norm).forEach(function(k){compat.setAnalogInput(k,norm[k]);});
      }else{
        fbdNodes().forEach(function(n){
          if(!n||n.type!=='analog_input')return;
          const key=String(n.name||'').trim().toUpperCase();if(!Object.prototype.hasOwnProperty.call(norm,key))return;
          const value=norm[key];
          try{window.SimuPLCFBDAnalog&&window.SimuPLCFBDAnalog.ensureDefaults&&window.SimuPLCFBDAnalog.ensureDefaults(n);}catch(_){}
          const eMin=Number(n.engMin),eMax=Number(n.engMax),rMin=Number(n.rawMin),rMax=Number(n.rawMax);
          const engMin=Number.isFinite(eMin)?eMin:0,engMax=Number.isFinite(eMax)&&eMax!==engMin?eMax:100,rawMin=Number.isFinite(rMin)?rMin:0,rawMax=Number.isFinite(rMax)&&rMax!==rawMin?rMax:4095;
          const ratio=Math.max(0,Math.min(1,(value-engMin)/(engMax-engMin)));
          n.rawValue=rawMin+ratio*(rawMax-rawMin);n.analogValue=value;n.value=value;
          try{window.SimuPLCFBDAnalog&&window.SimuPLCFBDAnalog.refreshNode&&window.SimuPLCFBDAnalog.refreshNode(n);}catch(_){}
        });
      }
      if(window.SimuPLCFBDSimulation&&typeof window.SimuPLCFBDSimulation.scan==='function')window.SimuPLCFBDSimulation.scan();
      else if(typeof window.scanLogic==='function')window.scanLogic();
    }catch(_){}
  }
  function fbdState(){
    const inputs={},outputs={},analogInputs={},analogOutputs={},analogRuntime={},analogMeta={};
    try{fbdNodes().forEach(function(n){
      if(!n||!n.name)return;const tag=String(n.name).trim().toUpperCase();if(!tag)return;
      if(n.type==='input')inputs[tag]=!!(n.el&&n.el.classList.contains('active'));
      if(n.type==='output'||n.type==='M')outputs[tag]=!!n.value;
      if(n.type==='analog_input'){
        let v=Number(n.analogValue);try{if(window.SimuPLCFBDAnalog&&window.SimuPLCFBDAnalog.analogInputValue)v=Number(window.SimuPLCFBDAnalog.analogInputValue(n));}catch(_){}
        if(Number.isFinite(v))analogInputs[tag]=v;
      }else if(n.type==='pwm_output'){
        let v=Number(n.outputPercent);if(!Number.isFinite(v))v=Number(n.analogValue);if(!Number.isFinite(v))v=Number(n.value);
        if(Number.isFinite(v)){analogOutputs[tag]=v;analogMeta[tag]={min:0,max:100,unit:'%',kind:'pwm',source:'FBD'};}
      }else if(n.type==='analog_output'){
        let v=Number(n.outputVoltage);if(!Number.isFinite(v))v=Number(n.analogValue);if(!Number.isFinite(v))v=Number(n.value);if(!Number.isFinite(v))v=Number(n.lastAnalogInput);
        if(Number.isFinite(v)){analogOutputs[tag]=v;analogMeta[tag]={min:Number.isFinite(Number(n.voltageMin))?Number(n.voltageMin):0,max:Number.isFinite(Number(n.voltageMax))?Number(n.voltageMax):3.3,unit:String(n.outputUnit||'V'),kind:'ao',source:'FBD'};}
      }else if(n.type==='analog_constant'||n.type==='scale'||n.type==='pid'){
        const v=Number(n.analogValue);if(Number.isFinite(v))analogRuntime[tag]=v;
      }
    });}catch(_){}
    return {inputs:inputs,outputs:outputs,analogInputs:analogInputs,analogOutputs:analogOutputs,analogRuntime:analogRuntime,analogMeta:analogMeta,simulationOn:fbdRunning(),receivedAt:Date.now()};
  }

  function forwardLadderState(st){ if(!runtimeOn||selectedSource!=='ladder')return; postControl({type:'SIMUPLC_CONTROL_RUNTIME_STATE',source:'ladder',state:st||{inputs:{},outputs:{},analogInputs:{},analogOutputs:{},analogRuntime:{},analogMeta:{},simulationOn:false}}); }
  function forwardFbdState(){if(!runtimeOn||selectedSource!=='fbd')return;postControl({type:'SIMUPLC_CONTROL_RUNTIME_STATE',source:'fbd',state:fbdState()});}
  function startPoll(){
    stopPoll();
    pollTimer=setInterval(function(){if(!runtimeOn)return;if(selectedSource==='ladder')ladderPost('getState',{});else forwardFbdState();},70);
  }
  function stopPoll(){ if(pollTimer){clearInterval(pollTimer);pollTimer=0;} }

  function runtimeStart(source){
    if(source)setSource(source);
    runtimeOn=true;lastInputs={};lastElectricalInputs={};lastAnalogInputs={};announceLink();
    if(selectedSource==='fbd'){
      ladderPost('stop',{});fbdStart();
      setTimeout(function(){if(runtimeOn&&selectedSource==='fbd'){fbdSetInputs(lastElectricalInputs);fbdSetAnalogInputs(lastAnalogInputs);forwardFbdState();}},35);
    }else{
      fbdStop();ladderPost('start',{});
      setTimeout(function(){if(runtimeOn&&selectedSource==='ladder'){lastInputs=electricalToLadderActuation(lastElectricalInputs);ladderPost('setInputs',{values:lastInputs});ladderPost('setAnalogInputs',{values:lastAnalogInputs});ladderPost('getState',{});}},30);
    }
    startPoll();
  }
  function runtimeStop(source){
    if(source&&normalizeSource(source)!==selectedSource){/* el origen antiguo no cambia la selección */}
    runtimeOn=false;stopPoll();lastInputs={};lastElectricalInputs={};lastAnalogInputs={};
    try{ladderPost('stop',{});}catch(_){} try{fbdStop();}catch(_){}
    postControl({type:'SIMUPLC_CONTROL_RUNTIME_STATE',source:selectedSource,state:{inputs:{},outputs:{},analogInputs:{},analogOutputs:{},analogRuntime:{},analogMeta:{},simulationOn:false}});
  }
  function runtimeInputs(values,source){
    if(source)setSource(source);
    lastElectricalInputs={};Object.keys(values||{}).forEach(function(k){const key=String(k).trim().toUpperCase();if(key)lastElectricalInputs[key]=!!values[k];});
    if(!runtimeOn)return;
    if(selectedSource==='fbd'){fbdSetInputs(lastElectricalInputs);forwardFbdState();}
    else{lastInputs=electricalToLadderActuation(lastElectricalInputs);ladderPost('setInputs',{values:lastInputs});}
  }
  function runtimeAnalogInputs(values,source){
    if(source)setSource(source);
    lastAnalogInputs={};Object.keys(values||{}).forEach(function(k){const key=String(k||'').trim().toUpperCase(),v=Number(values[k]);if(key&&Number.isFinite(v))lastAnalogInputs[key]=v;});
    if(!runtimeOn)return;
    if(selectedSource==='fbd'){fbdSetAnalogInputs(lastAnalogInputs);forwardFbdState();}
    else{ladderPost('setAnalogInputs',{values:lastAnalogInputs});}
  }
  function hmiControlPost(action,values){
    return postControl({type:'SIMUPLC_CONTROL_HMI',action:action,values:values||{}});
  }
  function hmiControlStart(){
    // El HMI gobierna los dispositivos S1/S2/... de CONTROL. Si el esquema contiene
    // un PLC, el propio control.html iniciará el programa KOP/FBD seleccionado y enviará
    // sus entradas eléctricas al runtime. En lógica cableada pura no se inicia programa.
    hmiControlState={inputs:{},outputs:{},states:{},simulationOn:false,receivedAt:Date.now()};
    announceLink();
    return hmiControlPost('start',{});
  }
  function hmiControlStop(){hmiControlPost('stop',{});hmiControlState={inputs:{},outputs:{},states:{},analogInputs:{},analogOutputs:{},analogRuntime:{},analogMeta:{},simulationOn:false,receivedAt:Date.now()};}
  function hmiControlSetInputs(values){const norm={};Object.keys(values||{}).forEach(function(k){const key=String(k||'').trim().toUpperCase();if(key)norm[key]=!!values[k];});hmiControlPost('inputs',norm);}
  function hmiControlSetAnalogInputs(values){const norm={};Object.keys(values||{}).forEach(function(k){const key=String(k||'').trim().toUpperCase(),v=Number(values[k]);if(key&&Number.isFinite(v))norm[key]=v;});hmiControlPost('analogInputs',norm);}
  function hmiControlRequest(){hmiControlPost('state',{});}

  function navigate(mode){
    mode=mode==='ladder'?'ladder':(mode==='hmi'?'hmi':(mode==='control'?'control':'fbd'));
    if(typeof window.setSimuPLCEditorMode==='function'){window.setSimuPLCEditorMode(mode);return;}
    const ids={fbd:'modeFBDBtn',ladder:'modeLadderBtn',control:'modeControlBtn',hmi:'modeHMIBtn'};
    const b=document.getElementById(ids[mode]);if(b)b.click();
  }

  window.addEventListener('message',function(ev){
    const msg=ev.data||{},cw=controlWindow(),lw=ladderWindow();
    if(ev.source===cw){
      if(msg.type==='SIMUPLC_CONTROL_READY'){if(msg.source)setSource(msg.source);else announceLink();return;}
      if(msg.type==='SIMUPLC_CONTROL_NAV'){navigate(msg.mode);return;}
      if(msg.type==='SIMUPLC_CONTROL_HMI_STATE'){hmiControlState=Object.assign({inputs:{},outputs:{},states:{},analogInputs:{},analogOutputs:{},analogRuntime:{},analogMeta:{},simulationOn:false,receivedAt:Date.now()},msg.state||{});try{window.dispatchEvent(new CustomEvent('simuplc-control-hmi-state',{detail:hmiControlState}));}catch(_){}return;}
      if(msg.type==='SIMUPLC_CONTROL_RUNTIME'){
        if(msg.action==='source'){if(!runtimeOn)setSource(msg.source);}
        else if(msg.action==='start')runtimeStart(msg.source);
        else if(msg.action==='stop')runtimeStop(msg.source);
        else if(msg.action==='inputs')runtimeInputs(msg.values||{},msg.source);
        else if(msg.action==='analogInputs')runtimeAnalogInputs(msg.values||{},msg.source);
        return;
      }
    }
    if(ev.source===lw && msg.type==='SIMUPLC_HMI_STATE')forwardLadderState(msg.state||{});
  },false);

  const cf=frame();if(cf)cf.addEventListener('load',function(){announceLink();});
  window.addEventListener('beforeunload',stopPoll);

  window.SimuPLCControlHost = {
    async getProject(){ const res = await send('getProject'); return res && res.ok ? res.data : null; },
    async setProject(data){ const res = await send('setProject', data); return !!(res && res.ok); },
    async focus(){ announceLink(); return send('focus'); },
    async clear(){ return send('clear'); },
    ping(){ return send('ping'); },
    runtime:{start:runtimeStart,stop:runtimeStop,setInputs:runtimeInputs,setAnalogInputs:runtimeAnalogInputs,setSource:setSource,getSource:function(){return selectedSource;},isRunning:function(){return runtimeOn;}},
    hmi:{start:hmiControlStart,stop:hmiControlStop,setInput:function(tag,value){const o={};o[tag]=!!value;hmiControlSetInputs(o);},setInputs:hmiControlSetInputs,setAnalogInput:function(tag,value){const o={};o[tag]=Number(value);hmiControlSetAnalogInputs(o);},setAnalogInputs:hmiControlSetAnalogInputs,requestState:hmiControlRequest,getState:function(){return Object.assign({},hmiControlState,{inputs:Object.assign({},hmiControlState.inputs||{}),outputs:Object.assign({},hmiControlState.outputs||{}),states:Object.assign({},hmiControlState.states||{}),analogInputs:Object.assign({},hmiControlState.analogInputs||{}),analogOutputs:Object.assign({},hmiControlState.analogOutputs||{}),analogRuntime:Object.assign({},hmiControlState.analogRuntime||{}),analogMeta:Object.assign({},hmiControlState.analogMeta||{})});}}
  };
})();
