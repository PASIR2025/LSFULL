(function(global){
  'use strict';
  if(global.SimuPLCFBDAnalog) return;

  const CATALOG=global.SimuPLCAnalogCatalog || null;
  const TYPES=CATALOG ? CATALOG.TYPES : Object.freeze({
    CONST:'analog_constant', INPUT:'analog_input', SCALE:'scale', GT:'gt', LT:'lt', EQ:'eq', GTE:'gte', LTE:'lte', HYST:'hyst', PWM:'pwm_output', AO:'analog_output', PID:'pid', SPLIT:'split_range'
  });
  const TYPE_SET=new Set(Object.values(TYPES));
  const COMPARATORS=new Set([TYPES.GT,TYPES.LT,TYPES.EQ,TYPES.GTE,TYPES.LTE,TYPES.HYST]);
  const diagnostics={configured:0,modalOpens:0,sliderChanges:0,restores:0,lastError:null};
  let activeNode=null;

  function adapter(){ return global.SimuPLCFBDAdapter || null; }
  function nodes(){
    try{ return adapter() && adapter().getNodes ? adapter().getNodes() : (Array.isArray(global.nodes)?global.nodes:[]); }
    catch(_){ return []; }
  }
  function num(value,fallback){ value=Number(value); return Number.isFinite(value)?value:fallback; }
  function integer(value,fallback,min,max){
    value=parseInt(value,10); if(!Number.isFinite(value)) value=fallback;
    return Math.max(min,Math.min(max,value));
  }
  function clamp(value,min,max){ return Math.max(Math.min(value,Math.max(min,max)),Math.min(min,max)); }
  function normalizeRange(min,max){
    min=num(min,0); max=num(max,100);
    if(min===max) max=min+1;
    return {min,max};
  }
  function mapRange(value,inMin,inMax,outMin,outMax,shouldClamp){
    const input=normalizeRange(inMin,inMax);
    outMin=num(outMin,0); outMax=num(outMax,100);
    value=num(value,input.min);
    if(shouldClamp!==false) value=clamp(value,input.min,input.max);
    return outMin + ((value-input.min)/(input.max-input.min))*(outMax-outMin);
  }
  function cleanUnit(value){ return String(value==null?'':value).trim().slice(0,12); }
  function isAnalogType(type){ return TYPE_SET.has(String(type||'').toLowerCase()); }
  function isAnalogSource(node){ return !!(node && (node.type===TYPES.CONST || node.type===TYPES.INPUT || node.type===TYPES.SCALE || node.type===TYPES.PID || node.type===TYPES.SPLIT)); }
  function isAnalogSink(node){ return !!(node && (node.type===TYPES.PWM || node.type===TYPES.AO)); }
  function isComparator(node){ return !!(node && COMPARATORS.has(node.type)); }
  function labelFor(type){
    if(CATALOG) return CATALOG.symbolFor(type,String(type||'').toUpperCase());
    switch(type){
      case TYPES.CONST:return 'CONST';
      case TYPES.INPUT:return 'AI';
      case TYPES.SCALE:return 'SCALE';
      case TYPES.GT:return '>';
      case TYPES.LT:return '<';
      case TYPES.EQ:return '=';
      case TYPES.GTE:return '≥';
      case TYPES.LTE:return '≤';
      case TYPES.HYST:return 'HYS';
      case TYPES.PWM:return 'PWM';
      case TYPES.AO:return 'AO';
      case TYPES.PID:return 'PID';
      case TYPES.SPLIT:return 'SPLIT';
      default:return String(type||'').toUpperCase();
    }
  }
  function nameFor(type){
    return CATALOG ? CATALOG.nameFor(type,labelFor(type)) : labelFor(type);
  }
  function defaultParams(type){
    if(CATALOG){
      const shared=CATALOG.defaultParamsFor(type);
      if(shared && Object.keys(shared).length) return shared;
    }
    if(type===TYPES.CONST){
      return {value:50,unit:'',decimals:1};
    }
    if(type===TYPES.INPUT){
      return {rawMin:0,rawMax:4095,engMin:0,engMax:100,rawValue:0,unit:'%',decimals:1,clamp:true};
    }
    if(type===TYPES.SCALE){
      return {inMin:0,inMax:100,outMin:0,outMax:100,unit:'',decimals:1,clamp:true};
    }
    if(type===TYPES.PWM){
      return {inMin:0,inMax:100,unit:'%',decimals:1,clamp:true,frequency:1000,resolution:8};
    }
    if(type===TYPES.PID){ return {kp:2,ki:0.5,kd:0.1,sampleMs:100,outMin:0,outMax:100,mode:'auto',manualOutput:0,direction:'heating',unit:'%',decimals:1}; }
    if(type===TYPES.SPLIT){ return {inMin:0,inMax:100,neutral:50,deadband:2,outMax:100,unit:'%',decimals:1,clamp:true}; }
    if(type===TYPES.AO){
      return {inMin:0,inMax:100,unit:'%',decimals:1,clamp:true,voltageMin:0,voltageMax:3.3,outputUnit:'V'};
    }
    if(type===TYPES.EQ){
      return {threshold:50,tolerance:0.1,unit:'',decimals:1};
    }
    if(type===TYPES.HYST){
      return {low:40,high:60,unit:'',decimals:1,hystState:0};
    }
    return {threshold:50,unit:'',decimals:1};
  }
  function calculateRatio(node,input){
    let value=num(input,node.inMin);
    if(node.clamp!==false) value=clamp(value,node.inMin,node.inMax);
    return (value-node.inMin)/(node.inMax-node.inMin||1);
  }
  function ensureDefaults(node){
    if(!node || !isAnalogType(node.type)) return node;
    const d=defaultParams(node.type);
    Object.keys(d).forEach(function(key){ if(node[key]===undefined || node[key]===null || Number.isNaN(node[key])) node[key]=d[key]; });
    node.unit=cleanUnit(node.unit);
    node.decimals=integer(node.decimals,d.decimals||1,0,4);
    if(node.type===TYPES.CONST){
      node.constantValue=num(node.constantValue!==undefined?node.constantValue:node.value,d.value==null?50:d.value);
      node.analogValue=node.constantValue; node.value=node.constantValue;
    }else if(node.type===TYPES.INPUT){
      let r=normalizeRange(node.rawMin,node.rawMax); node.rawMin=r.min; node.rawMax=r.max;
      let e=normalizeRange(node.engMin,node.engMax); node.engMin=e.min; node.engMax=e.max;
      node.rawValue=num(node.rawValue,node.rawMin);
      if(node.clamp!==false) node.rawValue=clamp(node.rawValue,node.rawMin,node.rawMax);
      node.analogValue=mapRange(node.rawValue,node.rawMin,node.rawMax,node.engMin,node.engMax,node.clamp!==false);
      if(!Number.isFinite(node.value)) node.value=node.analogValue;
    }else if(node.type===TYPES.SCALE){
      let i=normalizeRange(node.inMin,node.inMax); node.inMin=i.min; node.inMax=i.max;
      let o=normalizeRange(node.outMin,node.outMax); node.outMin=o.min; node.outMax=o.max;
      if(node.clamp===undefined) node.clamp=true;
      if(!Number.isFinite(node.analogValue)) node.analogValue=node.outMin;
    }else if(node.type===TYPES.PID){
      node.kp=num(node.kp,2);node.ki=num(node.ki,0.5);node.kd=num(node.kd,0.1);node.sampleMs=integer(node.sampleMs,100,20,60000);
      let o=normalizeRange(node.outMin,node.outMax);node.outMin=o.min;node.outMax=o.max;
      node.mode=String(node.mode||'auto').toLowerCase()==='manual'?'manual':'auto';
      node.manualOutput=clamp(num(node.manualOutput,0),node.outMin,node.outMax);
      node.direction=String(node.direction||'heating').toLowerCase()==='cooling'?'cooling':'heating';
      node.pidIntegral=num(node.pidIntegral,0);node.pidPrevError=num(node.pidPrevError,0);node.pidLastAt=num(node.pidLastAt,0);
      node.pidPV=num(node.pidPV,0);node.pidSP=num(node.pidSP,0);node.analogValue=clamp(num(node.analogValue,node.outMin),node.outMin,node.outMax);
    }else if(node.type===TYPES.SPLIT){
      let i=normalizeRange(node.inMin,node.inMax);node.inMin=i.min;node.inMax=i.max;
      node.neutral=clamp(num(node.neutral,50),node.inMin,node.inMax);
      node.deadband=Math.max(0,num(node.deadband,2));node.outMax=Math.max(0,num(node.outMax,100));
      if(node.clamp===undefined)node.clamp=true;
      node.lastAnalogInput=num(node.lastAnalogInput,node.neutral);
      node.splitFill=Math.max(0,num(node.splitFill,0));node.splitDrain=Math.max(0,num(node.splitDrain,0));
      node.analogValue=node.lastAnalogInput;
    }else if(node.type===TYPES.PWM){
      let i=normalizeRange(node.inMin,node.inMax); node.inMin=i.min; node.inMax=i.max;
      node.frequency=integer(node.frequency,1000,1,40000); node.resolution=integer(node.resolution,8,1,16);
      if(node.clamp===undefined) node.clamp=true;
      node.lastAnalogInput=num(node.lastAnalogInput,node.inMin);
      node.outputPercent=calculateRatio(node,node.lastAnalogInput)*100;
      node.analogValue=node.outputPercent;
    }else if(node.type===TYPES.AO){
      let i=normalizeRange(node.inMin,node.inMax); node.inMin=i.min; node.inMax=i.max;
      let v=normalizeRange(node.voltageMin,node.voltageMax); node.voltageMin=v.min; node.voltageMax=v.max; node.outputUnit=cleanUnit(node.outputUnit||'V')||'V';
      if(node.clamp===undefined) node.clamp=true;
      node.lastAnalogInput=num(node.lastAnalogInput,node.inMin);
      node.outputVoltage=node.voltageMin+calculateRatio(node,node.lastAnalogInput)*(node.voltageMax-node.voltageMin);
      node.analogValue=node.outputVoltage;
    }else if(node.type===TYPES.EQ){
      node.threshold=num(node.threshold,50); node.tolerance=Math.max(0,num(node.tolerance,0.1));
    }else if(node.type===TYPES.HYST){
      node.low=num(node.low,40); node.high=num(node.high,60);
      if(node.low>node.high){ const tmp=node.low;node.low=node.high;node.high=tmp; }
      node.hystState=node.hystState?1:0;
    }else{
      node.threshold=num(node.threshold,50);
    }
    return node;
  }
  function constantValue(node){
    ensureDefaults(node);
    node.analogValue=num(node.constantValue,50);
    node.value=node.analogValue;
    return node.analogValue;
  }
  function analogInputValue(node){
    ensureDefaults(node);
    node.analogValue=mapRange(node.rawValue,node.rawMin,node.rawMax,node.engMin,node.engMax,node.clamp!==false);
    return node.analogValue;
  }
  function scaleValue(node,input){
    ensureDefaults(node);
    node.analogValue=mapRange(input,node.inMin,node.inMax,node.outMin,node.outMax,node.clamp!==false);
    return node.analogValue;
  }
  function splitRangeValue(node,input){
    ensureDefaults(node);
    let value=num(input,node.neutral);
    if(node.clamp!==false)value=clamp(value,node.inMin,node.inMax);
    const half=Math.max(0,node.deadband)/2;
    const low=clamp(node.neutral-half,node.inMin,node.inMax);
    const high=clamp(node.neutral+half,node.inMin,node.inMax);
    let fill=0,drain=0;
    if(value>high && node.inMax>high) fill=mapRange(value,high,node.inMax,0,node.outMax,true);
    else if(value<low && low>node.inMin) drain=mapRange(value,low,node.inMin,0,node.outMax,true);
    fill=clamp(fill,0,node.outMax);drain=clamp(drain,0,node.outMax);
    if(fill>0)drain=0;else if(drain>0)fill=0;
    node.lastAnalogInput=value;node.splitFill=fill;node.splitDrain=drain;node.analogValue=value;
    return {input:value,fill:fill,drain:drain,low:low,high:high};
  }
  function outputPercent(node,input){ ensureDefaults(node); return calculateRatio(node,input)*100; }
  function outputVoltage(node,input){ ensureDefaults(node); return node.voltageMin+calculateRatio(node,input)*(node.voltageMax-node.voltageMin); }
  function evaluatePID(node,pv,sp,now){
    ensureDefaults(node);pv=num(pv,0);sp=num(sp,0);now=num(now,(global.performance&&performance.now)?performance.now():Date.now());
    if(node.mode==='manual'){node.analogValue=clamp(node.manualOutput,node.outMin,node.outMax);return node.analogValue;}
    if(node.pidLastAt&&now-node.pidLastAt<node.sampleMs)return node.analogValue;
    const dt=Math.max(node.sampleMs,(node.pidLastAt?now-node.pidLastAt:node.sampleMs))/1000;
    const sign=node.direction==='cooling'?-1:1;const error=(sp-pv)*sign;
    const derivative=(error-node.pidPrevError)/Math.max(dt,0.001);
    let candidate=node.pidIntegral+error*dt;let output=node.kp*error+node.ki*candidate+node.kd*derivative;
    const limited=clamp(output,node.outMin,node.outMax);if(output===limited||Math.sign(error)!==Math.sign(output-limited))node.pidIntegral=candidate;
    node.pidPrevError=error;node.pidLastAt=now;node.pidPV=pv;node.pidSP=sp;node.analogValue=limited;return limited;
  }
  function evaluateOutput(node,input){
    ensureDefaults(node); node.lastAnalogInput=num(input,node.inMin);
    if(node.type===TYPES.PID){return '<strong>'+formatValue(node.analogValue,node,true)+'</strong><span>PV '+formatValue(node.pidPV,node,false)+' · SP '+formatValue(node.pidSP,node,false)+' · '+String(node.mode||'auto').toUpperCase()+'</span>';}
    if(node.type===TYPES.SPLIT){
      return '<strong>▲ '+formatValue(node.splitFill,node,true)+' · ▼ '+formatValue(node.splitDrain,node,true)+'</strong><span>IN '+formatValue(node.lastAnalogInput,node,true)+' · neutro '+formatValue(node.neutral,node,true)+'</span>';
    }
    if(node.type===TYPES.PWM){ node.outputPercent=outputPercent(node,node.lastAnalogInput); node.analogValue=node.outputPercent; return node.outputPercent; }
    if(node.type===TYPES.AO){ node.outputVoltage=outputVoltage(node,node.lastAnalogInput); node.analogValue=node.outputVoltage; return node.outputVoltage; }
    return 0;
  }
  function formatValue(value,node,includeUnit){
    node=ensureDefaults(node||{});
    const decimals=integer(node.decimals,1,0,4);
    const text=Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : '--';
    return includeUnit!==false && node.unit ? text+' '+node.unit : text;
  }
  function compare(node,input){
    ensureDefaults(node); input=num(input,0);
    switch(node.type){
      case TYPES.GT:return input>node.threshold?1:0;
      case TYPES.LT:return input<node.threshold?1:0;
      case TYPES.GTE:return input>=node.threshold?1:0;
      case TYPES.LTE:return input<=node.threshold?1:0;
      case TYPES.EQ:return Math.abs(input-node.threshold)<=Math.max(0,node.tolerance)?1:0;
      case TYPES.HYST:
        if(input>=node.high) node.hystState=1;
        else if(input<=node.low) node.hystState=0;
        return node.hystState?1:0;
      default:return 0;
    }
  }
  function displayText(node){
    ensureDefaults(node);
    if(node.type===TYPES.CONST){
      return '<strong>'+formatValue(constantValue(node),node,true)+'</strong><span>Valor fijo interno · sin pin</span>';
    }
    if(node.type===TYPES.INPUT){
      return '<strong>'+formatValue(analogInputValue(node),node,true)+'</strong><span>Raw: '+Number(node.rawValue).toFixed(0)+'</span>';
    }
    if(node.type===TYPES.SCALE){
      return '<strong>'+formatValue(node.analogValue,node,true)+'</strong><span>'+formatValue(node.lastAnalogInput,node,false)+' → escala</span>';
    }
    if(node.type===TYPES.PID){
      return '<strong>'+formatValue(node.analogValue,node,true)+'</strong><span>PV '+formatValue(node.pidPV,node,false)+' · SP '+formatValue(node.pidSP,node,false)+' · '+String(node.mode||'auto').toUpperCase()+'</span>';
    }
    if(node.type===TYPES.PWM){
      return '<strong>'+Number(node.outputPercent||0).toFixed(node.decimals)+' %</strong><span>Entrada '+formatValue(node.lastAnalogInput,node,true)+' · '+node.frequency+' Hz</span>';
    }
    if(node.type===TYPES.AO){
      return '<strong>'+Number(node.outputVoltage||0).toFixed(2)+' '+String(node.outputUnit||'V')+'</strong><span>Entrada '+formatValue(node.lastAnalogInput,node,true)+' · salida proporcional</span>';
    }
    if(node.type===TYPES.HYST){
      return '<strong>'+formatValue(node.lastAnalogInput,node,true)+'</strong><span>OFF ≤ '+formatValue(node.low,node,true)+' · ON ≥ '+formatValue(node.high,node,true)+'</span>';
    }
    const symbol=labelFor(node.type);
    let suffix=symbol+' '+formatValue(node.threshold,node,true);
    if(node.type===TYPES.EQ) suffix+=' ± '+formatValue(node.tolerance,node,true);
    return '<strong>'+formatValue(node.lastAnalogInput,node,true)+'</strong><span>'+suffix+'</span>';
  }
  function ensureValueDisplay(node){
    if(!node || !node.el) return null;
    let display=node.el.querySelector('.analog-value-display');
    if(!display){ display=document.createElement('div');display.className='analog-value-display';node.el.appendChild(display); }
    display.innerHTML=displayText(node);
    return display;
  }
  function ensureSlider(node){
    if(!node || node.type!==TYPES.INPUT || !node.el) return null;
    let slider=node.el.querySelector('.analog-slider');
    if(!slider){
      slider=document.createElement('input');
      slider.type='range';slider.className='analog-slider';slider.setAttribute('aria-label','Valor analógico simulado');
      ['pointerdown','mousedown','touchstart','click'].forEach(function(name){slider.addEventListener(name,function(ev){ev.stopPropagation();},{passive:name==='touchstart'});});
      slider.addEventListener('input',function(ev){
        ev.stopPropagation();node.rawValue=num(slider.value,node.rawMin);analogInputValue(node);refreshNode(node);diagnostics.sliderChanges++;
        try{document.dispatchEvent(new CustomEvent('simuplc:fbd-analog-change',{detail:{id:node.id,type:node.type,value:node.analogValue,rawValue:node.rawValue}}));}catch(_){ }
      });
      node.el.appendChild(slider);
    }
    slider.min=String(node.rawMin);slider.max=String(node.rawMax);slider.step='1';slider.value=String(node.rawValue);
    return slider;
  }
  function ensureConfigButton(node){
    if(!node || !node.el) return null;
    let button=node.el.querySelector('.analog-config-button');
    if(!button){
      button=document.createElement('button');button.type='button';button.className='analog-config-button';button.title='Configurar bloque analógico';button.textContent='⚙';
      ['pointerdown','mousedown','touchstart','click'].forEach(function(name){button.addEventListener(name,function(ev){ev.preventDefault();ev.stopPropagation();if(name==='click')openModal(node);},{passive:false});});
      node.el.appendChild(button);
    }
    return button;
  }
  function refreshNode(node){
    if(!node || !isAnalogType(node.type) || !node.el) return false;
    ensureDefaults(node);
    node.el.classList.add('analog-node');node.el.dataset.analog='1';
    node.el.classList.toggle('analog-source',isAnalogSource(node));
    node.el.classList.toggle('analog-comparator',isComparator(node));
    node.el.classList.toggle('analog-output-node',isAnalogSink(node));
    const label=node.el.querySelector('.label');if(label){label.textContent=(node.type===TYPES.CONST||node.type===TYPES.INPUT||isAnalogSink(node))?(node.name||labelFor(node.type)+'1'):labelFor(node.type);}
    if(node.qIndicator) node.qIndicator.style.display=isComparator(node)?'block':'none';
    ensureValueDisplay(node);ensureConfigButton(node);
    if(node.type===TYPES.INPUT) ensureSlider(node); else node.el.querySelector('.analog-slider')?.remove();
    const outputs=Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[]);
    outputs.forEach(function(out){out.classList.add('analog-terminal');out.style.display=isAnalogSink(node)?'none':'';});
    (node.inputs||[]).forEach(function(input){input.classList.add('analog-terminal');});
    return true;
  }
  function refreshAll(){ nodes().forEach(refreshNode); }
  function configureNewNode(node){
    if(!node || !isAnalogType(node.type)) return node;
    ensureDefaults(node);refreshNode(node);diagnostics.configured++;return node;
  }

  function paramsFor(node){
    ensureDefaults(node);
    const base={unit:node.unit,decimals:node.decimals};
    if(node.type===TYPES.CONST) return Object.assign(base,{value:node.constantValue});
    if(node.type===TYPES.INPUT) return Object.assign(base,{rawMin:node.rawMin,rawMax:node.rawMax,engMin:node.engMin,engMax:node.engMax,rawValue:node.rawValue,clamp:node.clamp!==false});
    if(node.type===TYPES.SCALE) return Object.assign(base,{inMin:node.inMin,inMax:node.inMax,outMin:node.outMin,outMax:node.outMax,clamp:node.clamp!==false});
    if(node.type===TYPES.SPLIT) return Object.assign(base,{inMin:node.inMin,inMax:node.inMax,neutral:node.neutral,deadband:node.deadband,outMax:node.outMax,clamp:node.clamp!==false});
    if(node.type===TYPES.PWM) return Object.assign(base,{inMin:node.inMin,inMax:node.inMax,clamp:node.clamp!==false,frequency:node.frequency,resolution:node.resolution});
    if(node.type===TYPES.PID) return Object.assign(base,{kp:node.kp,ki:node.ki,kd:node.kd,sampleMs:node.sampleMs,outMin:node.outMin,outMax:node.outMax,mode:node.mode,manualOutput:node.manualOutput,direction:node.direction});
    if(node.type===TYPES.AO) return Object.assign(base,{inMin:node.inMin,inMax:node.inMax,clamp:node.clamp!==false,voltageMin:node.voltageMin,voltageMax:node.voltageMax,outputUnit:node.outputUnit||'V'});
    if(node.type===TYPES.EQ) return Object.assign(base,{threshold:node.threshold,tolerance:node.tolerance});
    if(node.type===TYPES.HYST) return Object.assign(base,{low:node.low,high:node.high,hystState:node.hystState?1:0});
    return Object.assign(base,{threshold:node.threshold});
  }
  function applyParams(node,params){
    if(!node || !isAnalogType(node.type)) return node;
    params=params&&typeof params==='object'?params:{};
    Object.keys(params).forEach(function(key){ if(params[key]!==undefined) node[key]=params[key]; });
    if(node.type===TYPES.CONST && params.value!==undefined) node.constantValue=params.value;
    ensureDefaults(node);refreshNode(node);diagnostics.restores++;return node;
  }

  function installStyles(){
    if(document.getElementById('simuplc-analog-style')) return;
    const style=document.createElement('style');style.id='simuplc-analog-style';style.textContent=`
      .node.analog-node{background:linear-gradient(180deg,#edf8ff,#d9efff)!important;border-color:#2879b9!important;min-height:225px}.node.analog-node.has-signal{border-color:#1274b8!important;box-shadow:0 0 0 3px rgba(18,116,184,.2),0 6px 0 rgba(0,0,0,.06)!important}.node.analog-comparator{background:linear-gradient(180deg,#f4f0ff,#e9e2ff)!important;border-color:#6d55b5!important}.node.analog-output-node{background:linear-gradient(180deg,#fff8e8,#ffedbd)!important;border-color:#b7791f!important}.node.analog-output-node .analog-value-display{border-color:rgba(183,121,31,.36);color:#74470f}.node.analog-comparator.has-signal{border-color:#16a34a!important}.analog-value-display{width:92%;margin-top:6px;padding:7px 6px;border-radius:9px;background:rgba(255,255,255,.86);border:1px solid rgba(40,121,185,.32);display:grid;gap:2px;font-size:13px;line-height:1.15;color:#183b55;box-sizing:border-box;pointer-events:none}.analog-value-display strong{font-size:18px;font-variant-numeric:tabular-nums}.analog-value-display span{font-size:10.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis}.analog-slider{width:88%;margin-top:8px;accent-color:#1677b8;cursor:pointer;touch-action:pan-x}.analog-config-button{position:absolute;right:7px;top:7px;z-index:25;width:29px;height:29px;border-radius:8px;border:1px solid #7ca9cc;background:#fff;color:#174d75;display:grid;place-items:center;font-size:15px;cursor:pointer;padding:0;box-shadow:0 2px 5px rgba(0,0,0,.12)}.terminal.analog-terminal::before{background:#1677b8}.wire-path.analog-signal{stroke:#188ad1!important;stroke-width:6!important;filter:drop-shadow(0 0 6px rgba(24,138,209,.35))}.terminal.analog-terminal.signal-on::before{background:#188ad1!important;box-shadow:0 0 0 4px rgba(24,138,209,.28)!important}
      #analogConfigModal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:14px;background:rgba(8,25,42,.58);z-index:10080;backdrop-filter:blur(3px)}#analogConfigModal.show{display:flex}.analog-config-card{width:min(650px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;border:1px solid #bfd3e4;box-shadow:0 24px 70px rgba(0,0,0,.32)}.analog-config-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid #dce7ef}.analog-config-head h3{margin:0;color:#124b74}.analog-config-head button,.analog-config-actions button{padding:9px 13px;border-radius:9px;border:1px solid #b5c6d5;background:#fff;font-weight:800;cursor:pointer}.analog-config-body{padding:17px;display:grid;gap:13px}.analog-config-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.analog-config-grid label{display:grid;gap:5px;font-size:12px;font-weight:800;color:#29465d}.analog-config-grid input,.analog-config-grid select{width:100%;box-sizing:border-box;border:1px solid #abc0d1;border-radius:9px;padding:9px 10px;font:inherit}.analog-config-grid .wide{grid-column:1/-1}.analog-config-help{padding:10px 12px;border-radius:10px;background:#eef8ff;border-left:4px solid #188ad1;color:#29465d;font-size:12px;line-height:1.4}.analog-config-preview{padding:11px 13px;border:1px solid #bad2e4;border-radius:11px;background:#f7fbfe;color:#173e5d;font-weight:800}.analog-config-actions{display:flex;justify-content:flex-end;gap:9px}.analog-config-actions .primary{background:#08783d;color:#fff;border-color:#08783d}
      @media(max-width:620px),(pointer:coarse){.analog-config-grid{grid-template-columns:1fr}#analogConfigModal{align-items:flex-start;padding:5px}.analog-config-card{max-height:calc(100dvh - 10px)}}
    `;document.head.appendChild(style);
  }
  function field(id,label,type,value,extra,wide){
    return '<label'+(wide?' class="wide"':'')+'>'+label+'<input id="'+id+'" type="'+(type||'number')+'" value="'+String(value==null?'':value).replace(/"/g,'&quot;')+'" '+(extra||'')+'></label>';
  }
  function modalFields(node){
    ensureDefaults(node);
    let html='';
    if(node.type===TYPES.CONST){
      html+=field('analogConstantValue','Valor constante','number',node.constantValue,'step="any"');
      html+=field('analogUnit','Unidad','text',node.unit,'maxlength="12"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
    }else if(node.type===TYPES.INPUT){
      html+=field('analogRawValue','Valor simulado RAW','number',node.rawValue,'step="1"');
      html+=field('analogUnit','Unidad de ingeniería','text',node.unit,'maxlength="12"');
      html+=field('analogRawMin','RAW mínimo','number',node.rawMin,'step="any"');
      html+=field('analogRawMax','RAW máximo','number',node.rawMax,'step="any"');
      html+=field('analogEngMin','Valor escalado mínimo','number',node.engMin,'step="any"');
      html+=field('analogEngMax','Valor escalado máximo','number',node.engMax,'step="any"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
      html+='<label>Limitar al rango<select id="analogClamp"><option value="1">Sí</option><option value="0">No</option></select></label>';
    }else if(node.type===TYPES.SCALE){
      html+=field('analogInMin','Entrada mínima','number',node.inMin,'step="any"');
      html+=field('analogInMax','Entrada máxima','number',node.inMax,'step="any"');
      html+=field('analogOutMin','Salida mínima','number',node.outMin,'step="any"');
      html+=field('analogOutMax','Salida máxima','number',node.outMax,'step="any"');
      html+=field('analogUnit','Unidad de salida','text',node.unit,'maxlength="12"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
      html+='<label>Limitar al rango<select id="analogClamp"><option value="1">Sí</option><option value="0">No</option></select></label>';
    }else if(node.type===TYPES.PID){
      html+=field('analogKp','Kp · Ganancia proporcional','number',node.kp,'step="any"');
      html+=field('analogKi','Ki · Ganancia integral','number',node.ki,'step="any"');
      html+=field('analogKd','Kd · Ganancia derivativa','number',node.kd,'step="any"');
      html+=field('analogSampleMs','Tiempo de muestreo (ms)','number',node.sampleMs,'min="20" max="60000" step="1"');
      html+=field('analogOutMin','Salida mínima','number',node.outMin,'step="any"');
      html+=field('analogOutMax','Salida máxima','number',node.outMax,'step="any"');
      html+='<label>Modo<select id="analogPidMode"><option value="auto">Automático</option><option value="manual">Manual</option></select></label>';
      html+=field('analogManualOutput','Salida manual','number',node.manualOutput,'step="any"');
      html+='<label>Acción<select id="analogPidDirection"><option value="heating">Directa / calefacción</option><option value="cooling">Inversa / refrigeración</option></select></label>';
      html+=field('analogUnit','Unidad de salida','text',node.unit,'maxlength="12"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
    }else if(node.type===TYPES.SPLIT){
      html+=field('analogInMin','Entrada mínima','number',node.inMin,'step="any"');
      html+=field('analogInMax','Entrada máxima','number',node.inMax,'step="any"');
      html+=field('analogNeutral','Punto neutro','number',node.neutral,'step="any"');
      html+=field('analogDeadband','Zona muerta total','number',node.deadband,'min="0" step="any"');
      html+=field('analogSplitOutMax','Salida máxima','number',node.outMax,'min="0" step="any"');
      html+=field('analogUnit','Unidad','text',node.unit,'maxlength="12"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
      html+='<label>Limitar al rango<select id="analogClamp"><option value="1">Sí</option><option value="0">No</option></select></label>';
    }else if(node.type===TYPES.PWM){
      html+=field('analogInMin','Entrada mínima','number',node.inMin,'step="any"');
      html+=field('analogInMax','Entrada máxima','number',node.inMax,'step="any"');
      html+=field('analogUnit','Unidad de entrada','text',node.unit,'maxlength="12"');
      html+=field('analogFrequency','Frecuencia PWM (Hz)','number',node.frequency,'min="1" max="40000" step="1"');
      html+=field('analogResolution','Resolución (bits)','number',node.resolution,'min="1" max="16" step="1"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
      html+='<label>Limitar al rango<select id="analogClamp"><option value="1">Sí</option><option value="0">No</option></select></label>';
    }else if(node.type===TYPES.AO){
      html+=field('analogInMin','Entrada mínima','number',node.inMin,'step="any"');
      html+=field('analogInMax','Entrada máxima','number',node.inMax,'step="any"');
      html+='<label>Tipo de salida<select id="analogOutputProfile"><option value="v3.3">0–3.3 V</option><option value="v5">0–5 V</option><option value="v10">0–10 V</option><option value="ma4-20">4–20 mA</option><option value="custom">Personalizada</option></select></label>';
      html+=field('analogVoltageMin','Salida mínima','number',node.voltageMin,'step="any"');
      html+=field('analogVoltageMax','Salida máxima','number',node.voltageMax,'step="any"');
      html+=field('analogOutputUnit','Unidad de salida','text',node.outputUnit||'V','maxlength="12"');
      html+=field('analogUnit','Unidad de entrada','text',node.unit,'maxlength="12"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
      html+='<label>Limitar al rango<select id="analogClamp"><option value="1">Sí</option><option value="0">No</option></select></label>';
    }else if(node.type===TYPES.HYST){
      html+=field('analogLow','Umbral de apagado','number',node.low,'step="any"');
      html+=field('analogHigh','Umbral de encendido','number',node.high,'step="any"');
      html+=field('analogUnit','Unidad','text',node.unit,'maxlength="12"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
    }else{
      html+=field('analogThreshold','Valor de comparación','number',node.threshold,'step="any"');
      if(node.type===TYPES.EQ) html+=field('analogTolerance','Tolerancia ±','number',node.tolerance,'min="0" step="any"');
      html+=field('analogUnit','Unidad','text',node.unit,'maxlength="12"');
      html+=field('analogDecimals','Decimales','number',node.decimals,'min="0" max="4" step="1"');
    }
    return html;
  }
  function ensureModal(){
    if(document.getElementById('analogConfigModal')) return;
    const modal=document.createElement('div');modal.id='analogConfigModal';
    modal.innerHTML='<div class="analog-config-card" role="dialog" aria-modal="true"><div class="analog-config-head"><h3 id="analogConfigTitle">Configurar bloque analógico</h3><button type="button" id="analogConfigClose">Cerrar</button></div><div class="analog-config-body"><div class="analog-config-grid" id="analogConfigFields"></div><div class="analog-config-preview" id="analogConfigPreview"></div><div class="analog-config-help">El valor analógico se simula dentro de la app. Los comparadores entregan una señal digital 0/1 para controlar salidas, memorias, temporizadores y demás bloques.</div><div class="analog-config-actions"><button type="button" id="analogConfigCancel">Cancelar</button><button type="button" id="analogConfigSave" class="primary">Guardar configuración</button></div></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',function(ev){if(ev.target===modal)closeModal();});
    document.getElementById('analogConfigClose').addEventListener('click',closeModal);
    document.getElementById('analogConfigCancel').addEventListener('click',closeModal);
    document.getElementById('analogConfigSave').addEventListener('click',saveModal);
    modal.addEventListener('input',updatePreview);
    modal.addEventListener('change',function(ev){if(ev.target&&ev.target.id==='analogOutputProfile'){applyOutputProfileToFields(ev.target.value);updatePreview();}});
  }
  function outputProfileFor(min,max,unit){min=Number(min);max=Number(max);unit=String(unit||'V').toLowerCase();if(unit==='ma'&&min===4&&max===20)return 'ma4-20';if(unit==='v'&&min===0&&max===3.3)return 'v3.3';if(unit==='v'&&min===0&&max===5)return 'v5';if(unit==='v'&&min===0&&max===10)return 'v10';return 'custom';}
  function applyOutputProfileToFields(profile){const map={'v3.3':[0,3.3,'V'],v5:[0,5,'V'],v10:[0,10,'V'],'ma4-20':[4,20,'mA']},v=map[profile];if(!v)return;const mn=document.getElementById('analogVoltageMin'),mx=document.getElementById('analogVoltageMax'),un=document.getElementById('analogOutputUnit');if(mn)mn.value=v[0];if(mx)mx.value=v[1];if(un)un.value=v[2];}
  function openModal(node){
    if(!node || !isAnalogType(node.type)) return false;
    activeNode=node;ensureDefaults(node);ensureModal();
    document.getElementById('analogConfigTitle').textContent='Configurar '+((node.type===TYPES.INPUT||node.type===TYPES.CONST)?(node.name||labelFor(node.type)):(node.code||labelFor(node.type))+' · '+nameFor(node.type)+' ('+labelFor(node.type)+')');
    document.getElementById('analogConfigFields').innerHTML=modalFields(node);
    const clampEl=document.getElementById('analogClamp');if(clampEl)clampEl.value=node.clamp===false?'0':'1';
    const pidMode=document.getElementById('analogPidMode');if(pidMode)pidMode.value=node.mode==='manual'?'manual':'auto';
    const pidDirection=document.getElementById('analogPidDirection');if(pidDirection)pidDirection.value=node.direction==='cooling'?'cooling':'heating';
    const outputProfile=document.getElementById('analogOutputProfile');if(outputProfile)outputProfile.value=outputProfileFor(node.voltageMin,node.voltageMax,node.outputUnit);
    document.getElementById('analogConfigModal').classList.add('show');diagnostics.modalOpens++;updatePreview();
    setTimeout(function(){const first=document.querySelector('#analogConfigFields input');if(first)first.focus();},30);
    return true;
  }
  function closeModal(){document.getElementById('analogConfigModal')?.classList.remove('show');activeNode=null;}
  function read(id,fallback){const el=document.getElementById(id);return el?num(el.value,fallback):fallback;}
  function readText(id,fallback){const el=document.getElementById(id);return el?cleanUnit(el.value):fallback;}
  function saveModal(){
    const node=activeNode;if(!node)return;
    if(node.type===TYPES.CONST){
      node.constantValue=read('analogConstantValue',node.constantValue);
    }else if(node.type===TYPES.INPUT){
      node.rawValue=read('analogRawValue',node.rawValue);node.rawMin=read('analogRawMin',node.rawMin);node.rawMax=read('analogRawMax',node.rawMax);node.engMin=read('analogEngMin',node.engMin);node.engMax=read('analogEngMax',node.engMax);node.clamp=(document.getElementById('analogClamp')||{}).value!=='0';
    }else if(node.type===TYPES.SCALE){
      node.inMin=read('analogInMin',node.inMin);node.inMax=read('analogInMax',node.inMax);node.outMin=read('analogOutMin',node.outMin);node.outMax=read('analogOutMax',node.outMax);node.clamp=(document.getElementById('analogClamp')||{}).value!=='0';
    }else if(node.type===TYPES.PID){
      node.kp=read('analogKp',node.kp);node.ki=read('analogKi',node.ki);node.kd=read('analogKd',node.kd);
      node.sampleMs=integer(read('analogSampleMs',node.sampleMs),node.sampleMs,20,60000);
      node.outMin=read('analogOutMin',node.outMin);node.outMax=read('analogOutMax',node.outMax);
      node.mode=(document.getElementById('analogPidMode')||{}).value==='manual'?'manual':'auto';
      node.manualOutput=read('analogManualOutput',node.manualOutput);
      node.direction=(document.getElementById('analogPidDirection')||{}).value==='cooling'?'cooling':'heating';
      node.pidIntegral=0;node.pidPrevError=0;node.pidLastAt=0;
    }else if(node.type===TYPES.SPLIT){
      node.inMin=read('analogInMin',node.inMin);node.inMax=read('analogInMax',node.inMax);node.neutral=read('analogNeutral',node.neutral);node.deadband=Math.max(0,read('analogDeadband',node.deadband));node.outMax=Math.max(0,read('analogSplitOutMax',node.outMax));node.clamp=(document.getElementById('analogClamp')||{}).value!=='0';
      splitRangeValue(node,node.lastAnalogInput);
    }else if(node.type===TYPES.PWM){
      node.inMin=read('analogInMin',node.inMin);node.inMax=read('analogInMax',node.inMax);node.frequency=read('analogFrequency',node.frequency);node.resolution=read('analogResolution',node.resolution);node.clamp=(document.getElementById('analogClamp')||{}).value!=='0';
    }else if(node.type===TYPES.AO){
      node.inMin=read('analogInMin',node.inMin);node.inMax=read('analogInMax',node.inMax);const profile=(document.getElementById('analogOutputProfile')||{}).value||'custom';if(profile!=='custom')applyOutputProfileToFields(profile);node.voltageMin=read('analogVoltageMin',node.voltageMin);node.voltageMax=read('analogVoltageMax',node.voltageMax);node.outputUnit=readText('analogOutputUnit',node.outputUnit||'V')||'V';node.clamp=(document.getElementById('analogClamp')||{}).value!=='0';
    }else if(node.type===TYPES.HYST){
      node.low=read('analogLow',node.low);node.high=read('analogHigh',node.high);
    }else{
      node.threshold=read('analogThreshold',node.threshold);if(node.type===TYPES.EQ)node.tolerance=Math.max(0,read('analogTolerance',node.tolerance));
    }
    node.unit=readText('analogUnit',node.unit);node.decimals=integer(read('analogDecimals',node.decimals),node.decimals,0,4);
    ensureDefaults(node);refreshNode(node);closeModal();
    try{document.dispatchEvent(new CustomEvent('simuplc:fbd-analog-change',{detail:{id:node.id,type:node.type,params:paramsFor(node)}}));}catch(_){ }
  }
  function updatePreview(){
    const node=activeNode;if(!node)return;
    const preview=document.getElementById('analogConfigPreview');if(!preview)return;
    try{
      if(node.type===TYPES.CONST){
        const decimals=integer(read('analogDecimals',node.decimals),1,0,4);
        preview.textContent='Valor constante: '+Number(read('analogConstantValue',node.constantValue)).toFixed(decimals)+' '+readText('analogUnit',node.unit)+' · no requiere pin';
      }else if(node.type===TYPES.INPUT){
        const value=mapRange(read('analogRawValue',node.rawValue),read('analogRawMin',node.rawMin),read('analogRawMax',node.rawMax),read('analogEngMin',node.engMin),read('analogEngMax',node.engMax),(document.getElementById('analogClamp')||{}).value!=='0');
        preview.textContent='Vista previa: '+Number(value).toFixed(integer(read('analogDecimals',node.decimals),1,0,4))+' '+readText('analogUnit',node.unit);
      }else if(node.type===TYPES.SCALE){
        preview.textContent='Escala: '+read('analogInMin',node.inMin)+'…'+read('analogInMax',node.inMax)+' → '+read('analogOutMin',node.outMin)+'…'+read('analogOutMax',node.outMax)+' '+readText('analogUnit',node.unit);
      }else if(node.type===TYPES.PID){
        const mode=(document.getElementById('analogPidMode')||{}).value==='manual'?'MANUAL':'AUTOMÁTICO';
        const direction=(document.getElementById('analogPidDirection')||{}).value==='cooling'?'INVERSA / REFRIGERACIÓN':'DIRECTA / CALEFACCIÓN';
        preview.textContent='PID '+mode+': Kp '+read('analogKp',node.kp)+' · Ki '+read('analogKi',node.ki)+' · Kd '+read('analogKd',node.kd)+' · '+direction+' · salida '+read('analogOutMin',node.outMin)+'…'+read('analogOutMax',node.outMax)+' '+readText('analogUnit',node.unit);
      }else if(node.type===TYPES.SPLIT){
        const temp={type:TYPES.SPLIT,inMin:read('analogInMin',node.inMin),inMax:read('analogInMax',node.inMax),neutral:read('analogNeutral',node.neutral),deadband:Math.max(0,read('analogDeadband',node.deadband)),outMax:Math.max(0,read('analogSplitOutMax',node.outMax)),unit:readText('analogUnit',node.unit),decimals:integer(read('analogDecimals',node.decimals),1,0,4),clamp:(document.getElementById('analogClamp')||{}).value!=='0'};
        const r=splitRangeValue(temp,node.lastAnalogInput);
        preview.textContent='Neutro '+temp.neutral+' · zona muerta ±'+(temp.deadband/2)+' · LLENAR '+r.fill.toFixed(temp.decimals)+' · VACIAR '+r.drain.toFixed(temp.decimals)+' '+temp.unit;
      }else if(node.type===TYPES.PWM){
        preview.textContent='PWM: rango '+read('analogInMin',node.inMin)+'…'+read('analogInMax',node.inMax)+' '+readText('analogUnit',node.unit)+' → 0…100 % · '+read('analogFrequency',node.frequency)+' Hz';
      }else if(node.type===TYPES.AO){
        preview.textContent='AO: rango '+read('analogInMin',node.inMin)+'…'+read('analogInMax',node.inMax)+' '+readText('analogUnit',node.unit)+' → '+read('analogVoltageMin',node.voltageMin)+'…'+read('analogVoltageMax',node.voltageMax)+' '+readText('analogOutputUnit',node.outputUnit||'V')+' · el HMI normaliza mínimo=0 % y máximo=100 %';
      }else if(node.type===TYPES.HYST){
        preview.textContent='Apaga en '+read('analogLow',node.low)+' · enciende en '+read('analogHigh',node.high)+' '+readText('analogUnit',node.unit);
      }else{
        preview.textContent='Condición: entrada '+labelFor(node.type)+' '+read('analogThreshold',node.threshold)+' '+readText('analogUnit',node.unit)+(node.type===TYPES.EQ?' con tolerancia ± '+read('analogTolerance',node.tolerance):'');
      }
    }catch(error){preview.textContent='Revisa los valores ingresados.';}
  }
  function hasFBDAnalogCodegen(){
    const unified=global.SimuPLCMCUCodegen;
    const base=global.SimuPLCESP32Codegen;
    return !!(
      (unified && typeof unified.refresh==='function') ||
      (base && typeof base.generateFBD==='function')
    );
  }
  function installArduinoGuard(){
    if(global.__simuplcAnalogArduinoGuard) return;
    const raw=global.openArduinoModal;
    if(typeof raw!=='function') return;
    global.__simuplcAnalogArduinoGuard=true;
    const wrapped=function(){
      const analogNodes=nodes().filter(function(node){return node&&isAnalogType(node.type);});
      // Desde la Fase 3 el generador MCU traduce AI, SCALE, comparadores e
      // histéresis tanto para Arduino como para ESP32. La advertencia antigua
      // solo se conserva como protección si el motor de código no cargó.
      if(analogNodes.length && !hasFBDAnalogCodegen()){
        const message='El motor de generación MCU no está disponible. Recarga la aplicación antes de generar el código de los bloques analógicos.';
        try{
          if(global.SimuPLCModal && typeof global.SimuPLCModal.alert==='function'){ global.SimuPLCModal.alert(message,{title:'Generador MCU no disponible'}); return; }
        }catch(_){ }
        global.alert(message); return;
      }
      return raw.apply(this,arguments);
    };
    wrapped.__simuplcFBDAnalogGuard=true;
    wrapped.__original=raw;
    global.openArduinoModal=wrapped;
  }
  function installInteractions(){
    global.addEventListener('simuplc:fbd-component-created',function(ev){
      const id=ev&&ev.detail&&ev.detail.id;const node=nodes().find(function(item){return item&&String(item.id)===String(id);});if(node&&isAnalogType(node.type))configureNewNode(node);
    });
    document.addEventListener('dblclick',function(ev){
      const host=ev.target&&ev.target.closest&&ev.target.closest('.node.analog-node');if(!host)return;const node=nodes().find(function(item){return item&&item.el===host;});if(node){ev.preventDefault();ev.stopPropagation();openModal(node);}
    },true);
    document.addEventListener('keydown',function(ev){
      if(ev.key!=='Enter')return;const tag=document.activeElement&&document.activeElement.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
      const node=adapter()&&adapter().getSelectedNode?adapter().getSelectedNode():global.selectedNode;if(node&&isAnalogType(node.type)){ev.preventDefault();openModal(node);}
    });
  }
  function init(){installStyles();ensureModal();installInteractions();setTimeout(refreshAll,50);setTimeout(refreshAll,500);setTimeout(installArduinoGuard,600);setTimeout(installArduinoGuard,1600);}

  global.SimuPLCFBDAnalog=Object.freeze({
    TYPES:TYPES,catalog:CATALOG,labelFor:labelFor,nameFor:nameFor,isAnalogType:isAnalogType,isAnalogSource:isAnalogSource,isAnalogSink:isAnalogSink,isComparator:isComparator,
    configureNewNode:configureNewNode,refreshNode:refreshNode,refreshAll:refreshAll,openConfig:openModal,
    ensureDefaults:ensureDefaults,evaluatePID:evaluatePID,constantValue:constantValue,analogInputValue:analogInputValue,scaleValue:scaleValue,splitRangeValue:splitRangeValue,compare:compare,evaluateOutput:evaluateOutput,outputPercent:outputPercent,outputVoltage:outputVoltage,
    formatValue:formatValue,paramsFor:paramsFor,applyParams:applyParams,mapRange:mapRange,
    resetRuntime:function(node){if(!node)return;if(node.type===TYPES.HYST)node.hystState=0;if(node.type===TYPES.SCALE||isAnalogSink(node))node.lastAnalogInput=0;if(node.type===TYPES.PID){node.pidIntegral=0;node.pidPrevError=0;node.pidLastAt=0;node.analogValue=node.outMin||0;}if(node.type===TYPES.SPLIT){node.splitFill=0;node.splitDrain=0;node.lastAnalogInput=node.neutral||0;}if(node.type===TYPES.PWM)node.outputPercent=0;if(node.type===TYPES.AO)node.outputVoltage=0;if(COMPARATORS.has(node.type))node.lastAnalogInput=0;refreshNode(node);},
    getDiagnostics:function(){return {ok:true,module:'fbd-analog-service',nodeCount:nodes().filter(function(n){return n&&isAnalogType(n.type);}).length,stats:Object.assign({},diagnostics)};}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
