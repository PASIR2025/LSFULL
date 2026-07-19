(function(){
  'use strict';

  const CFG_KEY = 'simuplc_codegen_hmi_v12';
  const INPUT_KEY = 'simuplc_codegen_input_sources_v17';
  const LEGACY_INPUT_KEYS = ['simuplc_codegen_input_sources_v16','simuplc_codegen_input_sources_v15'];
  const WIFI_BOARDS = new Set(['esp32','esp8266']);
  let currentLabels = {inputs:[],outputs:[]};
  let baseFbdGenerator = null;

  function clone(v){ try{return JSON.parse(JSON.stringify(v));}catch(_){return null;} }
  function cleanTag(v){ return String(v||'').trim().toUpperCase(); }
  function safeName(v){ let s=String(v||'').trim().replace(/[^A-Za-z0-9_]/g,'_'); if(!s)s='X'; if(/^\d/.test(s))s='_'+s; return s; }
  function escCpp(v){ return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\r\n]+/g,' '); }
  function bool(v){ return !!v; }
  function number(v,fb,min,max){ const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fb; }
  function readJson(key,fb){ try{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&typeof x==='object'?x:clone(fb);}catch(_){return clone(fb);} }
  function writeJson(key,v){ try{localStorage.setItem(key,JSON.stringify(v));}catch(_){} }
  function isLadderMode(){try{if(document.body&&document.body.classList.contains('mode-ladder'))return true;if(document.body&&document.body.classList.contains('mode-hmi')){const p=window.SimuPLCHMI&&window.SimuPLCHMI.getProject?window.SimuPLCHMI.getProject():null;return !!(p&&p.source==='ladder');}}catch(_){}return false;}

  const defaults = {
    transport:'serial',
    baudRate:115200,
    startOnBoot:false,
    version:42,
    failSafe:false,
    timeoutMs:15000,
    statePeriodMs:1000,
    apSsid:'SIMUPLC-HMI',
    apPassword:'simuplc123',
    stationSsid:'MI_WIFI',
    stationPassword:'CLAVE_WIFI',
    wsPort:81,
    cloudHost:'mi-servidor.com',
    cloudPort:443,
    cloudPath:'/simuplc',
    cloudTls:true
  };

  function getStoredCfg(){ const cfg=Object.assign({},defaults,readJson(CFG_KEY,defaults)); if(!cfg.version||cfg.version<42){if(cfg.transport==='none')cfg.transport='serial';cfg.failSafe=false;cfg.timeoutMs=15000;cfg.statePeriodMs=1000;cfg.version=42;writeJson(CFG_KEY,cfg);} return cfg; }
  function getCfg(){
    const cfg=getStoredCfg();
    const q=id=>document.getElementById(id);
    if(q('arduinoHmiTransport'))cfg.transport=q('arduinoHmiTransport').value;
    if(q('arduinoHmiBaud'))cfg.baudRate=number(q('arduinoHmiBaud').value,115200,1200,2000000);
    if(q('arduinoHmiStartBoot'))cfg.startOnBoot=q('arduinoHmiStartBoot').checked;
    if(q('arduinoHmiFailSafe'))cfg.failSafe=q('arduinoHmiFailSafe').checked;
    if(q('arduinoHmiTimeout'))cfg.timeoutMs=number(q('arduinoHmiTimeout').value,15000,1000,600000);
    if(q('arduinoHmiPeriod'))cfg.statePeriodMs=number(q('arduinoHmiPeriod').value,1000,100,5000);
    if(q('arduinoHmiApSsid'))cfg.apSsid=q('arduinoHmiApSsid').value.trim()||defaults.apSsid;
    if(q('arduinoHmiApPass'))cfg.apPassword=q('arduinoHmiApPass').value;
    if(q('arduinoHmiStaSsid'))cfg.stationSsid=q('arduinoHmiStaSsid').value.trim()||defaults.stationSsid;
    if(q('arduinoHmiStaPass'))cfg.stationPassword=q('arduinoHmiStaPass').value;
    if(q('arduinoHmiWsPort'))cfg.wsPort=number(q('arduinoHmiWsPort').value,81,1,65535);
    if(q('arduinoHmiCloudHost'))cfg.cloudHost=q('arduinoHmiCloudHost').value.trim()||defaults.cloudHost;
    if(q('arduinoHmiCloudPort'))cfg.cloudPort=number(q('arduinoHmiCloudPort').value,443,1,65535);
    if(q('arduinoHmiCloudPath'))cfg.cloudPath=q('arduinoHmiCloudPath').value.trim()||'/';
    if(q('arduinoHmiCloudTls'))cfg.cloudTls=q('arduinoHmiCloudTls').checked;
    writeJson(CFG_KEY,cfg);
    try{const io=readJson('simuplc_external_io_v2',{});io.baudRate=cfg.baudRate;if(cfg.transport==='serial')io.transport='serial';localStorage.setItem('simuplc_external_io_v2',JSON.stringify(io));}catch(_){}
    return cfg;
  }

  function getInitialGlobalMode(){
    let mode='both';
    try{mode=String(localStorage.getItem('simuplc_global_control_mode_v21')||readJson(CFG_KEY,{}).globalControlMode||'both').toLowerCase();}catch(_){}
    return ['both','hmi','physical'].includes(mode)?mode:'both';
  }

  function collectFbdLabels(){
    let arr=[];try{arr=(typeof nodes!=='undefined'?nodes:(window.nodes||[]))||[];}catch(_){arr=window.nodes||[];}
    const digits=s=>{const m=String(s||'').match(/\d+/);return m?Number(m[0]):0;};
    const inputs=arr.filter(n=>n&&n.type==='input').slice().sort((a,b)=>digits(a.name)-digits(b.name)).map((n,i)=>cleanTag(n.name||('I'+(i+1))));
    const outputs=arr.filter(n=>n&&n.type==='output').slice().sort((a,b)=>digits(a.name)-digits(b.name)).map((n,i)=>cleanTag(n.name||('Q'+(i+1))));
    return {inputs,outputs};
  }

  function hmiElementForTag(tag){
    try{
      const p=window.SimuPLCHMI&&window.SimuPLCHMI.getProject?window.SimuPLCHMI.getProject():null;
      const els=p&&Array.isArray(p.elements)?p.elements:[];
      return els.find(el=>[el.tag,el.tag2,el.tag3,el.tag4].map(cleanTag).includes(cleanTag(tag)))||null;
    }catch(_){return null;}
  }
  function fbdInputNodeForTag(tag){
    try{
      let arr=(typeof nodes!=='undefined'?nodes:(window.nodes||[]))||[];
      const key=cleanTag(tag);
      return arr.find(n=>n&&n.type==='input'&&cleanTag(n.name)===key)||null;
    }catch(_){return null;}
  }
  function inputContactInfo(tag){
    const key=cleanTag(tag),node=fbdInputNodeForTag(key),el=hmiElementForTag(key);
    const nodeMode=String(node&&((node.el&&node.el.dataset&&(node.el.dataset.inputMode||node.el.dataset.mode))||node.inputMode||node.mode)||'').toLowerCase();
    const nodeExplicit=nodeMode.match(/(?:^|-)(no|nc)$/);
    const nodeNcFlag=!!(node&&node.el&&node.el.dataset&&node.el.dataset.nc==='true');
    const hmiType=String(el&&(el.contactType||el.contact||el.nc)||'').toLowerCase();
    const hmiExplicit=/^(no|nc)$/.test(hmiType)?hmiType:'';
    const label=String((el&&el.label)||(node&&node.name)||key);
    let nc=false,source='predeterminado';
    if(nodeExplicit){nc=nodeExplicit[1]==='nc';source='entrada FBD';}
    else if(nodeNcFlag){nc=true;source='entrada FBD';}
    else if(hmiExplicit){nc=hmiExplicit==='nc';source='elemento HMI';}
    else if(/STOP|PARADA|EMERGENCIA|RESET\s*NC/i.test(label)){nc=true;source='etiqueta';}
    return {nc,type:nc?'NC':'NO',source,label};
  }
  function resolveInputMode(tag,mode){
    // DUAL significa que las dos fuentes quedan disponibles de forma independiente:
    // contacto NO -> OR (cualquiera arranca); contacto NC -> AND (cualquiera detiene).
    if(mode==='dual'||mode==='auto'||mode==='or')return inputContactInfo(tag).nc?'and':'or';
    return ['physical','hmi','and'].includes(mode)?mode:'physical';
  }
  function defaultInputSetting(tag){
    const info=inputContactInfo(tag);
    return {mode:'dual',initial:info.nc};
  }
  function readInputSettings(){
    const current=readJson(INPUT_KEY,null);
    if(current&&Object.keys(current).length)return current;
    let legacy={};
    for(const key of LEGACY_INPUT_KEYS){
      const candidate=readJson(key,{});
      if(candidate&&Object.keys(candidate).length){legacy=candidate;break;}
    }
    const migrated={};
    Object.keys(legacy||{}).forEach(tag=>{
      const old=legacy[tag]||{},d=defaultInputSetting(tag);
      // Corrección V17: cualquier ajuste anterior llamado auto/or/and/ambos se migra
      // a DUAL para eliminar el bloqueo que obligaba a pulsar físico + HMI en contactos NO.
      const mode=(old.mode==='physical'||old.mode==='hmi')?old.mode:'dual';
      migrated[cleanTag(tag)]={mode,initial:mode==='dual'?d.initial:(typeof old.initial==='boolean'?old.initial:d.initial)};
    });
    writeJson(INPUT_KEY,migrated);
    return migrated;
  }
  function getInputSettings(labels){
    const saved=readInputSettings()||{},out={};
    (labels.inputs||[]).forEach(tag=>{
      const key=cleanTag(tag),d=defaultInputSetting(key),s=saved[key]||{};
      let mode=['dual','physical','hmi','and'].includes(s.mode)?s.mode:d.mode;
      if(s.mode==='auto'||s.mode==='or')mode='dual';
      // Protección adicional: una entrada NO nunca hereda AND de versiones anteriores.
      if(mode==='and'&&!inputContactInfo(key).nc)mode='dual';
      out[key]={mode,initial:mode==='dual'?d.initial:(typeof s.initial==='boolean'?s.initial:d.initial)};
    });
    return out;
  }
  function saveInputSettings(settings){ writeJson(INPUT_KEY,settings||{}); }

  function transportTitle(t){return ({none:'Sin comunicación externa',serial:'USB / OTG — Web Serial',esp32_ap:'Wi‑Fi local — punto de acceso',esp32_sta:'Wi‑Fi local — conectado al router',esp32_cloud:'Internet — WebSocket remoto'})[t]||t;}
  function transportCode(t){return ({physical:0,hmi:1,or:2,and:3})[t]??0;}

  function ensureUi(){
    const modal=document.getElementById('arduinoModal');if(!modal||document.getElementById('arduinoHmiBox'))return;
    const board=document.getElementById('arduinoBoardBox');if(!board)return;
    const style=document.createElement('style');style.id='arduino-hmi-codegen-v42-style';style.textContent=`
      #arduinoHmiBox{padding:12px;border-radius:16px;margin:10px 0 12px;border:1px solid #d8e5ff;background:linear-gradient(180deg,#fff,#f5f9ff);box-shadow:0 8px 22px rgba(148,163,184,.14)}
      #arduinoCard[data-theme="dark"] #arduinoHmiBox{background:rgba(2,6,23,.35);border-color:rgba(148,163,184,.16)}
      #arduinoHmiBox .title{font-size:13px;font-weight:900;margin-bottom:2px}#arduinoHmiBox .sub2{font-size:12px;color:#475569;margin-bottom:10px}#arduinoCard[data-theme="dark"] #arduinoHmiBox .sub2{color:#94a3b8}
      .arduino-hmi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}.arduino-hmi-field{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:900}.arduino-hmi-field input,.arduino-hmi-field select{height:36px;border:1px solid #bfd3f6;border-radius:9px;padding:0 8px;background:#fff;color:#0f172a}.arduino-hmi-check{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;padding:8px 0}.arduino-hmi-check input{width:18px;height:18px}
      #arduinoCard[data-theme="dark"] .arduino-hmi-field input,#arduinoCard[data-theme="dark"] .arduino-hmi-field select{background:#0b1220;color:#e5e7eb;border-color:rgba(148,163,184,.35)}
      #arduinoHmiInputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:7px;margin-top:9px}.arduino-hmi-input-row{display:grid;grid-template-columns:64px minmax(210px,1fr) 128px 76px;align-items:center;gap:8px;padding:8px 10px;border:1px solid #d8e5ff;border-radius:11px;background:#fafdff;font-size:12px}.arduino-hmi-input-row b{font-family:Consolas,monospace}.arduino-hmi-input-row select{height:32px;border:1px solid #bfd3f6;border-radius:8px;background:#fff}.arduino-hmi-input-row label{display:flex;align-items:center;gap:5px;font-size:10px}.arduino-hmi-input-row input{width:17px;height:17px}
      .arduino-hmi-logic{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 7px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:10px;font-weight:900;text-align:center}.arduino-hmi-logic.is-and{background:#fef3c7;color:#92400e}.arduino-hmi-logic.is-or{background:#dcfce7;color:#166534}@media(max-width:720px){.arduino-hmi-input-row{grid-template-columns:52px 1fr}.arduino-hmi-logic,.arduino-hmi-input-row label{grid-column:2}}
      #arduinoCard[data-theme="dark"] .arduino-hmi-input-row{background:rgba(2,6,23,.28);border-color:rgba(148,163,184,.16)}#arduinoCard[data-theme="dark"] .arduino-hmi-input-row select{background:#0b1220;color:#e5e7eb;border-color:rgba(148,163,184,.35)}
      #arduinoHmiStatus{margin-top:9px;padding:8px 10px;border-radius:10px;background:#ecfdf5;border:1px solid #86efac;color:#166534;font-size:11px;font-weight:800;line-height:1.4}#arduinoCard[data-theme="dark"] #arduinoHmiStatus{background:rgba(22,101,52,.18);color:#bbf7d0;border-color:rgba(134,239,172,.3)}
      .arduino-hmi-section[hidden]{display:none!important}
    `;document.head.appendChild(style);
    const box=document.createElement('div');box.id='arduinoHmiBox';box.innerHTML=`
      <div class="title">Comunicación HMI integrada</div>
      <div class="sub2">El archivo generado incluirá tu circuito, USB/OTG o Wi‑Fi, pines físicos y protocolo HMI. Verifica que el código muestre “SIMUPLC HMI READY CODE V43”.</div>
      <div class="arduino-hmi-grid">
        <label class="arduino-hmi-field">Conexión HMI<select id="arduinoHmiTransport"><option value="serial">USB / OTG — listo para HMI</option><option value="none">Sin comunicación externa</option><option value="esp32_ap">ESP32/ESP8266 — red propia</option><option value="esp32_sta">ESP32/ESP8266 — router local</option><option value="esp32_cloud">ESP32/ESP8266 — internet</option></select></label>
        <label class="arduino-hmi-field arduino-hmi-section" data-for="serial">Velocidad USB<select id="arduinoHmiBaud"><option>9600</option><option>57600</option><option selected>115200</option><option>230400</option><option>460800</option></select></label>
        <label class="arduino-hmi-field">Envío de estados (ms)<input id="arduinoHmiPeriod" type="number" min="40" max="5000" step="10"></label>
        <label class="arduino-hmi-field">Timeout HMI (ms)<input id="arduinoHmiTimeout" type="number" min="500" max="600000" step="100"></label>
      </div>
      <div class="arduino-hmi-grid arduino-hmi-section" data-for="esp32_ap">
        <label class="arduino-hmi-field">Nombre de red<input id="arduinoHmiApSsid"></label><label class="arduino-hmi-field">Clave de red<input id="arduinoHmiApPass"></label><label class="arduino-hmi-field">Puerto WebSocket<input id="arduinoHmiWsPort" type="number" min="1" max="65535"></label>
      </div>
      <div class="arduino-hmi-grid arduino-hmi-section" data-for="esp32_sta esp32_cloud">
        <label class="arduino-hmi-field">Wi‑Fi / router<input id="arduinoHmiStaSsid"></label><label class="arduino-hmi-field">Clave Wi‑Fi<input id="arduinoHmiStaPass"></label>
      </div>
      <div class="arduino-hmi-grid arduino-hmi-section" data-for="esp32_cloud">
        <label class="arduino-hmi-field">Servidor WebSocket<input id="arduinoHmiCloudHost"></label><label class="arduino-hmi-field">Puerto<input id="arduinoHmiCloudPort" type="number" min="1" max="65535"></label><label class="arduino-hmi-field">Ruta<input id="arduinoHmiCloudPath"></label><label class="arduino-hmi-check"><input id="arduinoHmiCloudTls" type="checkbox"> Conexión segura TLS/WSS</label>
      </div>
      <div class="arduino-hmi-grid">
        <label class="arduino-hmi-check"><input id="arduinoHmiStartBoot" type="checkbox"> Ejecutar lógica al energizar</label><label class="arduino-hmi-check"><input id="arduinoHmiFailSafe" type="checkbox"> Apagar salidas si se pierde el HMI</label>
      </div>
      <div class="title" style="margin-top:8px">Origen de cada entrada</div>
      <div class="sub2">Físico + HMI deja disponibles las dos fuentes: en NO cualquiera arranca; en NC cualquiera detiene. No es necesario pulsar ambos controles.</div>
      <div id="arduinoHmiInputs"></div>
      <div id="arduinoHmiStatus"></div>`;
    board.insertAdjacentElement('afterend',box);

    const boardSel=document.getElementById('arduinoBoardSelect');
    if(boardSel&&!boardSel.querySelector('option[value="esp32"]')){
      boardSel.insertAdjacentHTML('beforeend','<option value="esp32">ESP32 Dev Module</option><option value="esp8266">ESP8266 NodeMCU</option>');
    }
    if(boardSel&&!boardSel.dataset.hmiV12Bound){boardSel.dataset.hmiV12Bound='1';boardSel.addEventListener('change',()=>setTimeout(regenerate,20));}
    ['arduinoModeSelect','arduinoOutputLevel'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.dataset.hmiV12Bound){el.dataset.hmiV12Bound='1';el.addEventListener('change',()=>setTimeout(regenerate,20));}});
    loadUi();
    box.addEventListener('input',onUiChange);box.addEventListener('change',onUiChange);
  }

  function loadUi(){
    const cfg=getStoredCfg(),q=id=>document.getElementById(id);if(!q('arduinoHmiTransport'))return;
    q('arduinoHmiTransport').value=cfg.transport;q('arduinoHmiBaud').value=String(cfg.baudRate);q('arduinoHmiStartBoot').checked=cfg.startOnBoot;q('arduinoHmiFailSafe').checked=cfg.failSafe;q('arduinoHmiTimeout').value=cfg.timeoutMs;q('arduinoHmiPeriod').value=cfg.statePeriodMs;q('arduinoHmiApSsid').value=cfg.apSsid;q('arduinoHmiApPass').value=cfg.apPassword;q('arduinoHmiStaSsid').value=cfg.stationSsid;q('arduinoHmiStaPass').value=cfg.stationPassword;q('arduinoHmiWsPort').value=cfg.wsPort;q('arduinoHmiCloudHost').value=cfg.cloudHost;q('arduinoHmiCloudPort').value=cfg.cloudPort;q('arduinoHmiCloudPath').value=cfg.cloudPath;q('arduinoHmiCloudTls').checked=cfg.cloudTls;
    updateVisibility();renderInputRows(currentLabels);updateStatus();
  }
  function updateVisibility(){
    const t=(document.getElementById('arduinoHmiTransport')||{}).value||'none';
    document.querySelectorAll('#arduinoHmiBox [data-for]').forEach(el=>el.hidden=!String(el.dataset.for||'').split(/\s+/).includes(t));
    const mode=document.getElementById('arduinoModeSelect');if(mode){mode.disabled=t!=='none';if(t!=='none')mode.value='plc';}
    const info=document.getElementById('arduinoModeInfo');if(info&&t!=='none')info.textContent='PLC universal + HMI';
  }
  function onUiChange(ev){
    updateVisibility();const cfg=getCfg();
    if(ev.target&&ev.target.id==='arduinoHmiTransport'&&cfg.transport.startsWith('esp32')){
      const b=document.getElementById('arduinoBoardSelect');if(b&&!WIFI_BOARDS.has(b.value)){b.value='esp32';b.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    if(ev.target&&ev.target.matches('[data-input-mode],[data-input-initial]')){
      const row=ev.target.closest('.arduino-hmi-input-row');
      if(row&&ev.target.matches('[data-input-mode]')&&ev.target.value==='auto'){
        row.querySelector('[data-input-initial]').checked=inputContactInfo(row.dataset.tag).nc;
      }
      if(row)updateInputRow(row);
      saveRows();
    }
    updateStatus();scheduleRegenerate();
  }
  function saveRows(){
    const settings=getInputSettings(currentLabels);
    document.querySelectorAll('#arduinoHmiInputs .arduino-hmi-input-row').forEach(row=>{const tag=row.dataset.tag;if(!tag)return;settings[tag]={mode:row.querySelector('[data-input-mode]').value,initial:row.querySelector('[data-input-initial]').checked};});saveInputSettings(settings);
  }
  function updateInputRow(row){
    if(!row)return;
    const tag=cleanTag(row.dataset.tag),info=inputContactInfo(tag);
    const mode=(row.querySelector('[data-input-mode]')||{}).value||'dual';
    const resolved=resolveInputMode(tag,mode),badge=row.querySelector('[data-input-logic]');
    if(badge){
      badge.textContent=info.type+' · '+(resolved==='or'?'CUALQUIERA (OR)':resolved==='and'?'AMBOS (AND)':resolved==='physical'?'SOLO FÍSICO':'SOLO HMI');
      badge.className='arduino-hmi-logic '+(resolved==='or'?'is-or':resolved==='and'?'is-and':'');
    }
    row.dataset.resolvedMode=resolved;
    row.title=info.type==='NO'?'Contacto NO: físico OR HMI; cualquiera activa sin depender del otro.':'Contacto NC: físico AND HMI en reposo; cualquiera puede abrir y detener.';
  }
  function renderInputRows(labels){
    currentLabels={inputs:(labels&&labels.inputs||[]).map(cleanTag),outputs:(labels&&labels.outputs||[]).map(cleanTag)};
    const wrap=document.getElementById('arduinoHmiInputs');if(!wrap)return;const settings=getInputSettings(currentLabels);wrap.innerHTML='';
    currentLabels.inputs.forEach(tag=>{
      const s=settings[tag]||defaultInputSetting(tag),row=document.createElement('div');row.className='arduino-hmi-input-row';row.dataset.tag=tag;
      row.innerHTML='<b>'+tag+'</b><select data-input-mode><option value="dual">Físico + HMI — cualquiera controla (recomendado)</option><option value="physical">Solo física</option><option value="hmi">Solo HMI</option><option value="and">Coincidencia física Y HMI (avanzado)</option></select><span class="arduino-hmi-logic" data-input-logic></span><label><input data-input-initial type="checkbox"> HMI inicial 1</label>';
      row.querySelector('select').value=s.mode;row.querySelector('input').checked=!!s.initial;wrap.appendChild(row);updateInputRow(row);
    });
    saveInputSettings(settings);updateStatus();
  }
  function updateStatus(){
    const s=document.getElementById('arduinoHmiStatus');if(!s)return;const cfg=getCfg(),board=(document.getElementById('arduinoBoardSelect')||{}).value||'uno';let txt='Generación normal sin conexión HMI.';
    if(cfg.transport==='serial')txt='Se generará un único .ino con USB/OTG, lógica PLC, entradas físicas, salidas y respuesta STATE.';
    else if(cfg.transport==='esp32_ap')txt='Se generará una red propia y servidor WebSocket. Dirección esperada: ws://192.168.4.1:'+cfg.wsPort+'/';
    else if(cfg.transport==='esp32_sta')txt='El controlador se conectará al router y mostrará su IP por Serial. El HMI usará ws://IP:'+cfg.wsPort+'/';
    else if(cfg.transport==='esp32_cloud')txt='El controlador se conectará como cliente a '+(cfg.cloudTls?'wss://':'ws://')+cfg.cloudHost+':'+cfg.cloudPort+cfg.cloudPath+'. Requiere servidor relay compatible.';
    if(cfg.transport.startsWith('esp32')&&!WIFI_BOARDS.has(board))txt+=' ⚠ Selecciona ESP32 o ESP8266.';s.textContent=txt;
  }
  let regenTimer=0;
  function scheduleRegenerate(){clearTimeout(regenTimer);regenTimer=setTimeout(regenerate,80);}
  function regenerate(){
    if(isLadderMode()&&typeof window.SimuPLCGenerateLadderArduinoNow==='function'){window.SimuPLCGenerateLadderArduinoNow();return;}
    const ta=document.getElementById('arduinoCode');if(ta&&typeof window.generateArduinoSketch==='function')ta.value=window.generateArduinoSketch();
  }

  function tagsArray(labels,kind){return (labels[kind]||[]).map(t=>'"'+escCpp(cleanTag(t))+'"').join(', ')||'""';}
  function hmiDefaults(labels){const s=getInputSettings(labels);return (labels.inputs||[]).map(t=>{const x=s[cleanTag(t)]||defaultInputSetting(t);return (x.mode==='dual'?inputContactInfo(t).nc:!!x.initial)?'true':'false';}).join(', ')||'false';}
  function hmiModes(labels){const s=getInputSettings(labels);return (labels.inputs||[]).map(t=>{const x=s[cleanTag(t)]||defaultInputSetting(t);return String(transportCode(resolveInputMode(t,x.mode)));}).join(', ')||'0';}
  function hmiModeComments(labels){const s=getInputSettings(labels);return (labels.inputs||[]).map(t=>{const x=s[cleanTag(t)]||defaultInputSetting(t),info=inputContactInfo(t),resolved=resolveInputMode(t,x.mode);return '// '+cleanTag(t)+': contacto '+info.type+' -> '+(resolved==='or'?'FISICO O HMI (cualquiera activa)':resolved==='and'?'FISICO Y HMI (ambos deben permitir)':resolved==='physical'?'SOLO FISICO':'SOLO HMI');}).join('\n');}

  function transportIncludes(cfg,board){
    let out='#include <Arduino.h>\n';
    if(cfg.transport.startsWith('esp32')){
      out+=board==='esp8266'?'#include <ESP8266WiFi.h>\n':'#include <WiFi.h>\n';
      out+=cfg.transport==='esp32_cloud'?'#include <WebSocketsClient.h>\n':'#include <WebSocketsServer.h>\n';
    }
    return out;
  }

  function transportGlobals(cfg){
    if(cfg.transport==='serial')return `char hmiRxBuffer[160];\nuint16_t hmiRxLength=0;`;
    if(cfg.transport==='esp32_ap'||cfg.transport==='esp32_sta')return `WebSocketsServer hmiWebSocket(${Math.trunc(cfg.wsPort)});\nuint32_t hmiWifiRetryMs=0;`;
    if(cfg.transport==='esp32_cloud')return `WebSocketsClient hmiWebSocket;\nuint32_t hmiWifiRetryMs=0;`;
    return '';
  }

  function transportFunctions(cfg,board){
    if(cfg.transport==='serial')return `
void hmiTransportSend(const String& line){ Serial.println(line); }
void hmiTransportBegin(){ Serial.begin(HMI_BAUD_RATE); }
void hmiTransportLoop(){
  while(Serial.available()>0){
    char c=(char)Serial.read();
    if(c=='\\n'){
      hmiRxBuffer[hmiRxLength]='\\0';
      if(hmiRxLength) hmiProcessCommand(String(hmiRxBuffer));
      hmiRxLength=0;
    }else if(c!='\\r' && hmiRxLength<sizeof(hmiRxBuffer)-1){ hmiRxBuffer[hmiRxLength++]=c; }
  }
}`;
    if(cfg.transport==='esp32_ap'||cfg.transport==='esp32_sta'){
      const wifiBegin=cfg.transport==='esp32_ap'
        ?`WiFi.mode(WIFI_AP);\n  WiFi.softAP(HMI_AP_SSID,HMI_AP_PASSWORD);\n  Serial.print(F("SIMUPLC WS: ws://"));Serial.print(WiFi.softAPIP());Serial.print(':');Serial.print(HMI_WS_PORT);Serial.println('/');`
        :`WiFi.mode(WIFI_STA);\n  WiFi.begin(HMI_STA_SSID,HMI_STA_PASSWORD);\n  uint32_t waitStart=millis(); while(WiFi.status()!=WL_CONNECTED && millis()-waitStart<15000){delay(250);}\n  Serial.print(F("SIMUPLC WS: ws://"));Serial.print(WiFi.localIP());Serial.print(':');Serial.print(HMI_WS_PORT);Serial.println('/');`;
      return `
void hmiTransportSend(const String& line){ hmiWebSocket.broadcastTXT(line); }
void hmiSocketEvent(uint8_t client,WStype_t type,uint8_t* payload,size_t length){
  if(type==WStype_TEXT){ String msg;msg.reserve(length);for(size_t i=0;i<length;i++)msg+=(char)payload[i];int start=0;while(start<msg.length()){int end=msg.indexOf('\\n',start);if(end<0)end=msg.length();String line=msg.substring(start,end);line.trim();if(line.length())hmiProcessCommand(line);start=end+1;} }
  else if(type==WStype_CONNECTED){ hmiSendState(); }
}
void hmiTransportBegin(){
  Serial.begin(115200);
  ${wifiBegin}
  hmiWebSocket.begin();hmiWebSocket.onEvent(hmiSocketEvent);
}
void hmiTransportLoop(){ ${cfg.transport==='esp32_sta'?'if(WiFi.status()!=WL_CONNECTED && (uint32_t)(millis()-hmiWifiRetryMs)>5000UL){hmiWifiRetryMs=millis();WiFi.disconnect();WiFi.begin(HMI_STA_SSID,HMI_STA_PASSWORD);} ':''}hmiWebSocket.loop(); }`;
    }
    if(cfg.transport==='esp32_cloud')return `
void hmiTransportSend(const String& line){ if(hmiWebSocket.isConnected())hmiWebSocket.sendTXT(line); }
void hmiCloudEvent(WStype_t type,uint8_t* payload,size_t length){
  if(type==WStype_TEXT){ String msg;msg.reserve(length);for(size_t i=0;i<length;i++)msg+=(char)payload[i];int start=0;while(start<msg.length()){int end=msg.indexOf('\\n',start);if(end<0)end=msg.length();String line=msg.substring(start,end);line.trim();if(line.length())hmiProcessCommand(line);start=end+1;} }
  else if(type==WStype_CONNECTED){ hmiTransportSend(String("HELLO,CONTROLLER,")+HMI_DEVICE_ID+"\\n");hmiSendState(); }
}
void hmiTransportBegin(){
  Serial.begin(115200);WiFi.mode(WIFI_STA);WiFi.begin(HMI_STA_SSID,HMI_STA_PASSWORD);
  uint32_t waitStart=millis();while(WiFi.status()!=WL_CONNECTED && millis()-waitStart<20000){delay(250);}
  ${cfg.cloudTls?'hmiWebSocket.beginSSL(HMI_CLOUD_HOST,HMI_CLOUD_PORT,HMI_CLOUD_PATH);':'hmiWebSocket.begin(HMI_CLOUD_HOST,HMI_CLOUD_PORT,HMI_CLOUD_PATH);'}
  hmiWebSocket.onEvent(hmiCloudEvent);hmiWebSocket.setReconnectInterval(3000);
}
void hmiTransportLoop(){ if(WiFi.status()!=WL_CONNECTED && (uint32_t)(millis()-hmiWifiRetryMs)>5000UL){hmiWifiRetryMs=millis();WiFi.disconnect();WiFi.begin(HMI_STA_SSID,HMI_STA_PASSWORD);} hmiWebSocket.loop(); }`;
    return `void hmiTransportSend(const String& line){(void)line;}\nvoid hmiTransportBegin(){}\nvoid hmiTransportLoop(){}`;
  }

  function commonRuntime(cfg,labels,source,board){
    const ni=Math.max(1,(labels.inputs||[]).length),no=Math.max(1,(labels.outputs||[]).length);
    const ncFlags=(labels.inputs||[]).map(tag=>inputContactInfo(tag).nc?'true':'false').join(', ')||'false';
    const hmiInitial=(labels.inputs||[]).map(tag=>inputContactInfo(tag).nc?'true':'false').join(', ')||'false';
    const initialMode=getInitialGlobalMode();
    const modeConst=initialMode==='hmi'?'HMI_MODE_HMI':initialMode==='physical'?'HMI_MODE_PHYSICAL':'HMI_MODE_BOTH';
    const sourceHelpers=source==='fbd'?`
bool hmiLogicalInput(uint8_t ix){for(uint16_t n=0;n<N_NODES;n++)if(nodeType[n]==T_INPUT&&nodeInputIndex[n]==ix)return val[n];return false;}
bool hmiLogicalOutput(uint8_t ox){for(uint16_t n=0;n<N_NODES;n++)if(nodeType[n]==T_OUTPUT&&nodeOutputIndex[n]==ox)return val[n];return false;}
void hmiForceOutputsOff(){for(uint16_t n=0;n<N_NODES;n++)if(nodeType[n]==T_OUTPUT)val[n]=false;for(uint8_t ox=0;ox<N_OUTPUTS;ox++)digitalWrite(outputPins[ox],OUTPUT_ACTIVE_LOW[ox]?HIGH:LOW);}
`:buildLadderHelpers(labels);
    return `
// ===== SIMUPLC HMI READY CODE V43 =====
const uint32_t HMI_BAUD_RATE=${Math.trunc(cfg.baudRate)}UL;
const uint32_t HMI_STATE_PERIOD_MS=${Math.max(500,Math.trunc(cfg.statePeriodMs))}UL;
const uint32_t HMI_TIMEOUT_MS=${Math.max(5000,Math.trunc(cfg.timeoutMs))}UL;
const bool HMI_STOP_ON_TIMEOUT=${cfg.failSafe?'true':'false'};
const bool HMI_START_ON_BOOT=${cfg.startOnBoot?'true':'false'};
const uint8_t HMI_INPUT_COUNT=${(labels.inputs||[]).length};
const uint8_t HMI_OUTPUT_COUNT=${(labels.outputs||[]).length};
const uint8_t HMI_SAFE_INPUT_COUNT=${ni};
const uint8_t HMI_SAFE_OUTPUT_COUNT=${no};
const char* HMI_INPUT_TAGS[HMI_SAFE_INPUT_COUNT]={${tagsArray(labels,'inputs')}};
const char* HMI_OUTPUT_TAGS[HMI_SAFE_OUTPUT_COUNT]={${tagsArray(labels,'outputs')}};
const bool hmiInputIsNc[HMI_SAFE_INPUT_COUNT]={${ncFlags}};
bool hmiInputValues[HMI_SAFE_INPUT_COUNT]={${hmiInitial}};
bool hmiPhysicalValues[HMI_SAFE_INPUT_COUNT]={false};
const uint8_t HMI_MODE_BOTH=0,HMI_MODE_HMI=1,HMI_MODE_PHYSICAL=2;
const uint8_t HMI_DEFAULT_CONTROL_MODE=${modeConst};
uint8_t hmiControlMode=HMI_DEFAULT_CONTROL_MODE;
bool hmiControllerRunning=HMI_START_ON_BOOT;
bool hmiStateRequested=true;
bool hmiScanRequested=true;
bool hmiStateInitialized=false;
uint32_t hmiLastMessageMs=0,hmiLastStateMs=0;
bool hmiLastRunning=false;
uint8_t hmiLastMode=255;
bool hmiLastLogicalInputs[HMI_SAFE_INPUT_COUNT]={false};
bool hmiLastPhysicalInputs[HMI_SAFE_INPUT_COUNT]={false};
bool hmiLastHmiInputs[HMI_SAFE_INPUT_COUNT]={false};
bool hmiLastLogicalOutputs[HMI_SAFE_OUTPUT_COUNT]={false};
${cfg.transport==='esp32_ap'?`const char* HMI_AP_SSID="${escCpp(cfg.apSsid)}";\nconst char* HMI_AP_PASSWORD="${escCpp(cfg.apPassword)}";\nconst uint16_t HMI_WS_PORT=${Math.trunc(cfg.wsPort)};`:''}
${cfg.transport==='esp32_sta'||cfg.transport==='esp32_cloud'?`const char* HMI_STA_SSID="${escCpp(cfg.stationSsid)}";\nconst char* HMI_STA_PASSWORD="${escCpp(cfg.stationPassword)}";`:''}
${cfg.transport==='esp32_sta'?`const uint16_t HMI_WS_PORT=${Math.trunc(cfg.wsPort)};`:''}
${cfg.transport==='esp32_cloud'?`const char* HMI_CLOUD_HOST="${escCpp(cfg.cloudHost)}";\nconst uint16_t HMI_CLOUD_PORT=${Math.trunc(cfg.cloudPort)};\nconst char* HMI_CLOUD_PATH="${escCpp(cfg.cloudPath)}";\nconst char* HMI_DEVICE_ID="SIMUPLC-PLC-01";`:''}
${transportGlobals(cfg)}

bool hmiCombineInput(uint8_t ix,bool physicalValue){
  if(ix>=HMI_INPUT_COUNT)return physicalValue;
  if(hmiPhysicalValues[ix]!=physicalValue){hmiPhysicalValues[ix]=physicalValue;hmiStateRequested=true;}
  if(hmiControlMode==HMI_MODE_HMI)return hmiInputValues[ix];
  if(hmiControlMode==HMI_MODE_PHYSICAL)return physicalValue;
  return hmiInputIsNc[ix]?(physicalValue&&hmiInputValues[ix]):(physicalValue||hmiInputValues[ix]);
}
int hmiFindInput(const String& tag){for(uint8_t i=0;i<HMI_INPUT_COUNT;i++)if(tag.equalsIgnoreCase(HMI_INPUT_TAGS[i]))return i;return -1;}
const char* hmiControlModeName(){return hmiControlMode==HMI_MODE_HMI?"HMI":(hmiControlMode==HMI_MODE_PHYSICAL?"PHYSICAL":"BOTH");}
${sourceHelpers}
void hmiTransportSend(const String& line);
void hmiTransportBegin();
void hmiTransportLoop();
String hmiBuildState(){String s="STATE";for(uint8_t i=0;i<HMI_INPUT_COUNT;i++){s+=',';s+=HMI_INPUT_TAGS[i];s+=',';s+=(hmiLogicalInput(i)?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_PHYSICAL,";s+=(hmiPhysicalValues[i]?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_HMI,";s+=(hmiInputValues[i]?'1':'0');}for(uint8_t i=0;i<HMI_OUTPUT_COUNT;i++){s+=',';s+=HMI_OUTPUT_TAGS[i];s+=',';s+=(hmiLogicalOutput(i)?'1':'0');}s+=",RUNNING,";s+=(hmiControllerRunning?'1':'0');s+=",CONTROL_MODE,";s+=hmiControlModeName();return s;}
bool hmiStateChanged(){
  bool changed=!hmiStateInitialized||hmiLastRunning!=hmiControllerRunning||hmiLastMode!=hmiControlMode;
  for(uint8_t i=0;i<HMI_INPUT_COUNT;i++){
    bool logical=hmiLogicalInput(i);
    if(hmiLastLogicalInputs[i]!=logical||hmiLastPhysicalInputs[i]!=hmiPhysicalValues[i]||hmiLastHmiInputs[i]!=hmiInputValues[i])changed=true;
    hmiLastLogicalInputs[i]=logical;hmiLastPhysicalInputs[i]=hmiPhysicalValues[i];hmiLastHmiInputs[i]=hmiInputValues[i];
  }
  for(uint8_t i=0;i<HMI_OUTPUT_COUNT;i++){bool logical=hmiLogicalOutput(i);if(hmiLastLogicalOutputs[i]!=logical)changed=true;hmiLastLogicalOutputs[i]=logical;}
  hmiLastRunning=hmiControllerRunning;hmiLastMode=hmiControlMode;hmiStateInitialized=true;return changed;
}
void hmiSendState(){hmiTransportSend(hmiBuildState());hmiLastStateMs=millis();hmiStateRequested=false;hmiStateChanged();}
void hmiAck(const String& subject,const String& value){hmiTransportSend(String("ACK,")+subject+","+value);}
void hmiProcessCommand(String command){
  command.trim();if(!command.length())return;hmiLastMessageMs=millis();
  if(command=="PING"){hmiTransportSend("PONG");return;}
  if(command=="GET_STATE"){hmiStateRequested=true;return;}
  if(command=="RUN,1"||command=="RUN"){hmiControllerRunning=true;hmiScanRequested=true;hmiStateRequested=true;hmiAck("RUN","1");return;}
  if(command=="STOP"||command=="RUN,0"){hmiControllerRunning=false;hmiForceOutputsOff();hmiStateRequested=true;hmiAck("RUN","0");hmiSendState();return;}
  if(command.startsWith("HELLO")){hmiTransportSend("OK,SIMUPLC,READY_CODE_V43,1");hmiStateRequested=true;return;}
  if(command.startsWith("MODE,")){
    String value=command.substring(5);value.trim();value.toUpperCase();
    if(value=="HMI")hmiControlMode=HMI_MODE_HMI;else if(value=="PHYSICAL"||value=="FISICO")hmiControlMode=HMI_MODE_PHYSICAL;else hmiControlMode=HMI_MODE_BOTH;
    hmiScanRequested=true;hmiStateRequested=true;hmiAck("MODE",hmiControlModeName());return;
  }
  if(command.startsWith("SET,")){
    int p=command.indexOf(',',4);
    if(p>4){String tag=command.substring(4,p);int ix=hmiFindInput(tag);if(ix>=0){bool next=command.substring(p+1).toInt()!=0;hmiInputValues[ix]=next;hmiScanRequested=true;hmiStateRequested=true;hmiAck(tag,next?"1":"0");return;}}
  }
  hmiTransportSend("ERROR,COMANDO_NO_RECONOCIDO");
}
${transportFunctions(cfg,board)}
void hmiBegin(){hmiLastMessageMs=millis();hmiTransportBegin();hmiStateRequested=true;hmiScanRequested=true;}
void hmiLoop(){hmiTransportLoop();if(HMI_STOP_ON_TIMEOUT&&hmiControlMode!=HMI_MODE_PHYSICAL&&hmiControllerRunning&&(uint32_t)(millis()-hmiLastMessageMs)>HMI_TIMEOUT_MS){hmiControllerRunning=false;hmiForceOutputsOff();hmiStateRequested=true;}}
void hmiMaybeSendState(){uint32_t now=millis();bool changed=hmiStateChanged();if(changed||hmiStateRequested||(uint32_t)(now-hmiLastStateMs)>=HMI_STATE_PERIOD_MS)hmiSendState();}
// ===== FIN SIMUPLC HMI READY CODE V43 =====
`;
  }

  function buildLadderHelpers(labels){
    const ins=(labels.inputs||[]).map((t,i)=>`case ${i}:return ${safeName(t)};`).join('');
    const outs=(labels.outputs||[]).map((t,i)=>`case ${i}:return ${safeName(t)};`).join('');
    const off=(labels.outputs||[]).map(t=>`${safeName(t)}=false;`).join('');
    return `void writeOutputs();\nbool hmiLogicalInput(uint8_t ix){switch(ix){${ins}default:return false;}}\nbool hmiLogicalOutput(uint8_t ox){switch(ox){${outs}default:return false;}}\nvoid hmiForceOutputsOff(){${off}writeOutputs();}\n`;
  }

  function insertBeforeFunction(code,fnName,text){const ix=code.indexOf('void '+fnName+'(');return ix>=0?code.slice(0,ix)+text+'\n'+code.slice(ix):text+'\n'+code;}
  function insertIntoSetup(code,line){const start=code.indexOf('void setup(){');if(start<0)return code;const brace=code.indexOf('{',start);let depth=0;for(let i=brace;i<code.length;i++){if(code[i]==='{')depth++;else if(code[i]==='}'){depth--;if(depth===0)return code.slice(0,i)+'  '+line+'\n'+code.slice(i);}}return code;}

  function wrapFbd(base,labels,cfg,board){
    if(!base||base.includes('SIMUPLC HMI READY CODE V43'))return base;
    let code=transportIncludes(cfg,board)+base;
    const runtime=commonRuntime(cfg,labels,'fbd',board);
    {const pos=code.indexOf('static inline bool readRawInput');code=pos>=0?code.slice(0,pos)+runtime+'\n'+code.slice(pos):insertBeforeFunction(code,'setup',runtime);}
    code=code.replace('val[n] = (m==0) ? inStable[ix] : !inStable[ix];','bool combinedInput = hmiCombineInput(ix, inStable[ix]);\n      val[n] = (m==0) ? combinedInput : !combinedInput;');
    code=insertIntoSetup(code,'hmiBegin();');
    code=code.replace('void loop(){\n  unsigned long nowMs = millis();','void loop(){\n  hmiLoop();\n  unsigned long nowMs = millis();');
    code=code.replace('  readInputs();\n  propagateNoCounter(nowMs);','  readInputs();\n  if(!hmiControllerRunning){hmiForceOutputsOff();hmiMaybeSendState();return;}\n  propagateNoCounter(nowMs);');
    const last=code.lastIndexOf('  writeOutputs();');if(last>=0)code=code.slice(0,last)+'  writeOutputs();\n  hmiMaybeSendState();'+code.slice(last+'  writeOutputs();'.length);
    return code;
  }

  function wrapLadder(base,labels,cfg,board){
    if(!base||base.includes('SIMUPLC HMI READY CODE V43'))return base;
    let code=transportIncludes(cfg,board)+base;
    const runtime=commonRuntime(cfg,labels,'ladder',board);
    code=insertBeforeFunction(code,'setup',runtime);
    (labels.inputs||[]).forEach((tag,ix)=>{
      const n=safeName(tag),re=new RegExp('\\b'+n+'\\s*=\\s*\\(digitalRead\\(PIN_'+n+'\\)\\s*==\\s*LOW\\);','g');
      code=code.replace(re,n+' = hmiCombineInput('+ix+', (digitalRead(PIN_'+n+') == LOW));');
    });
    code=insertIntoSetup(code,'hmiBegin();');
    const loopIx=code.lastIndexOf('void loop(){');
    if(loopIx>=0){
      let tail=code.slice(loopIx);
      tail=tail.replace(/void\s+loop\s*\(\s*\)\s*\{/,m=>m+'\n  hmiLoop();');
      tail=tail.replace(/\breadInputs\s*\(\s*\)\s*;/,m=>m+'\n  if(!hmiControllerRunning){hmiForceOutputsOff();hmiMaybeSendState();delay(10);return;}');
      const matches=[...tail.matchAll(/\bwriteOutputs\s*\(\s*\)\s*;/g)];
      if(matches.length){const m=matches[matches.length-1],w=m.index+m[0].length;tail=tail.slice(0,w)+'\n  hmiMaybeSendState();'+tail.slice(w);}
      code=code.slice(0,loopIx)+tail;
    }
    return code;
  }

  function wrapGenerated(base,source,labels){
    const cfg=getCfg(),board=(document.getElementById('arduinoBoardSelect')||{}).value||((window.getArduinoBoard&&window.getArduinoBoard())||'uno');labels={inputs:(labels&&labels.inputs||[]).map(v=>String(v||'').trim()).filter(Boolean),outputs:(labels&&labels.outputs||[]).map(v=>String(v||'').trim()).filter(Boolean)};renderInputRows(labels);
    if(cfg.transport==='none')return base;
    if(cfg.transport.startsWith('esp32')&&!WIFI_BOARDS.has(board))return '#error Selecciona ESP32 o ESP8266 en el generador para usar Wi-Fi.\n'+base;
    return source==='ladder'?wrapLadder(base,labels,cfg,board):wrapFbd(base,labels,cfg,board);
  }

  function patchGenerator(){
    if(window.__simuplcCodegenV17Patched)return true;
    if(typeof window.generateArduinoSketch!=='function')return false;
    window.__simuplcCodegenV17Patched=true;
    baseFbdGenerator=window.generateArduinoSketch;
    window.generateArduinoSketch=function(){
      const cfg=getCfg();
      if(cfg.transport==='none')return baseFbdGenerator();
      const labels=collectFbdLabels();
      let base='';
      if(typeof window.generateArduinoSketchFull==='function')base=window.generateArduinoSketchFull();
      else base=baseFbdGenerator();
      const ready=wrapGenerated(base,'fbd',labels);
      if(!ready.includes('SIMUPLC HMI READY CODE V43')){
        return '#error GENERADOR HMI V43 NO INTEGRADO. Selecciona USB / OTG y pulsa Regenerar.\n'+ready;
      }
      return ready;
    };
    window.SimuPLCWrapGeneratedSketch=wrapGenerated;
    window.SimuPLCGetCodegenConfig=()=>clone(getCfg());
    window.SimuPLCCodegenVersion='V43';
    return true;
  }

  function patchModalOpen(){
    if(window.__simuplcModalV17Patched||typeof window.openArduinoModal!=='function')return;window.__simuplcModalV17Patched=true;const old=window.openArduinoModal;window.openArduinoModal=function(){old.apply(this,arguments);ensureUi();loadUi();setTimeout(regenerate,0);};
  }

  function boot(){
    patchGenerator();patchModalOpen();ensureUi();
    const st=document.getElementById('arduinoHmiStatus');
    if(st)st.textContent='Generador HMI V43 activo · ACK de comandos · HMI/FÍSICO/AMBOS en tiempo real.';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
  setTimeout(boot,100);
  setTimeout(boot,500);
  setTimeout(boot,1200);
  const retry=setInterval(()=>{if(patchGenerator()){patchModalOpen();ensureUi();clearInterval(retry);}},250);
  setTimeout(()=>clearInterval(retry),8000);
})();
