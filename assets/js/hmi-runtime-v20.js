(function(){
  'use strict';

  const VERSION = 'V20';
  const INPUT_KEY = 'simuplc_codegen_input_sources_v17';
  const CFG_KEY = 'simuplc_codegen_hmi_v12';
  let generatorPatched = false;
  let uiObserver = null;
  let decorateTimer = 0;

  function cleanTag(v){ return String(v || '').trim().toUpperCase(); }
  function clone(v){ try { return JSON.parse(JSON.stringify(v)); } catch (_) { return null; } }
  function readJson(key, fallback){
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : clone(fallback);
    } catch (_) { return clone(fallback); }
  }
  function writeJson(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function own(obj, key){ return !!obj && Object.prototype.hasOwnProperty.call(obj, key); }

  function getProject(){
    try { return window.SimuPLCHMI && window.SimuPLCHMI.getProject ? window.SimuPLCHMI.getProject() : null; }
    catch (_) { return null; }
  }

  function findInputElement(tag){
    const project = getProject();
    const key = cleanTag(tag);
    const elements = project && Array.isArray(project.elements) ? project.elements : [];
    return elements.find(function(el){
      return el && [el.tag, el.tag2].map(cleanTag).includes(key) && ['pushbutton','sensor','estop','selector','tank'].includes(el.type);
    }) || null;
  }

  function isNc(tag, element){
    const el = element || findInputElement(tag);
    if (el && el.contactType === 'nc') return true;
    const label = String(el && el.label || tag || '');
    return /STOP|PARADA|EMERGENCIA|E-?STOP|NC\b/i.test(label);
  }

  function readInputSettings(){ return readJson(INPUT_KEY, {}) || {}; }
  function getMode(tag){
    const settings = readInputSettings();
    const item = settings[cleanTag(tag)] || {};
    return ['dual','physical','hmi','and'].includes(item.mode) ? item.mode : 'dual';
  }

  function saveMode(tag, mode, nc){
    tag = cleanTag(tag);
    if (!tag) return;
    mode = ['dual','physical','hmi','and'].includes(mode) ? mode : 'dual';
    const settings = readInputSettings();
    const previous = settings[tag] || {};
    settings[tag] = {
      mode: mode,
      initial: mode === 'physical' ? !!previous.initial : (nc ? true : !!previous.initial)
    };
    writeJson(INPUT_KEY, settings);
  }

  function resolvedMode(tag, mode, element){
    mode = mode || getMode(tag);
    if (mode === 'dual') return isNc(tag, element) ? 'and' : 'or';
    return mode;
  }

  function migrateFastStatePeriod(){
    const cfg = readJson(CFG_KEY, {});
    if (!cfg || typeof cfg !== 'object') return;
    const current = Number(cfg.statePeriodMs);
    if (!Number.isFinite(current) || current > 60) {
      cfg.statePeriodMs = 60;
      cfg.version = 20;
      writeJson(CFG_KEY, cfg);
    }
  }

  function upgradeGeneratedCode(input){
    let code = String(input || '');
    if (!/SIMUPLC HMI READY CODE V(?:12|15|16|17)/.test(code)) return code;
    if (code.includes('SIMUPLC HMI READY CODE V20')) return code;

    code = code
      .replace(/SIMUPLC HMI READY CODE V(?:12|15|16|17)/g, 'SIMUPLC HMI READY CODE V20')
      .replace(/READY_CODE_V(?:12|15|16|17)/g, 'READY_CODE_V20')
      .replace(/GENERADOR HMI V(?:12|15|16|17)/g, 'GENERADOR HMI V20');

    code = code.replace(
      'uint32_t hmiLastMessageMs=0,hmiLastStateMs=0;',
      `uint32_t hmiLastMessageMs=0,hmiLastStateMs=0;\nbool hmiScanRequested=true;\nbool hmiStateRequested=true;\nbool hmiStateInitialized=false;\nbool hmiLastLogicalInputs[HMI_SAFE_INPUT_COUNT]={false};\nbool hmiLastPhysicalInputs[HMI_SAFE_INPUT_COUNT]={false};\nbool hmiLastHmiInputs[HMI_SAFE_INPUT_COUNT]={false};\nbool hmiLastLogicalOutputs[HMI_SAFE_OUTPUT_COUNT]={false};`
    );

    code = code.replace(
      /bool hmiCombineInput\(uint8_t ix,bool physicalValue\)\{[^\n]*\}/,
      `bool hmiCombineInput(uint8_t ix,bool physicalValue){\n  if(ix>=HMI_INPUT_COUNT)return physicalValue;\n  if(hmiPhysicalValues[ix]!=physicalValue){hmiPhysicalValues[ix]=physicalValue;hmiStateRequested=true;}\n  switch(hmiInputSource[ix]){\n    case 1:return hmiInputValues[ix];\n    case 2:return physicalValue||hmiInputValues[ix];\n    case 3:return physicalValue&&hmiInputValues[ix];\n    default:return physicalValue;\n  }\n}`
    );

    const stateBlock = /String hmiBuildState\(\)\{[^\n]*\}\nvoid hmiSendState\(\);\nvoid hmiProcessCommand\(String command\)\{[^\n]*\}\nvoid hmiSendState\(\)\{[^\n]*\}/;
    const stateReplacement = `String hmiBuildState(){String s="STATE";for(uint8_t i=0;i<HMI_INPUT_COUNT;i++){s+=',';s+=HMI_INPUT_TAGS[i];s+=',';s+=(hmiLogicalInput(i)?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_PHYSICAL,";s+=(hmiPhysicalValues[i]?'1':'0');s+=',';s+=HMI_INPUT_TAGS[i];s+="_HMI,";s+=(hmiInputValues[i]?'1':'0');}for(uint8_t i=0;i<HMI_OUTPUT_COUNT;i++){s+=',';s+=HMI_OUTPUT_TAGS[i];s+=',';s+=(hmiLogicalOutput(i)?'1':'0');}s+=",RUNNING,";s+=(hmiControllerRunning?'1':'0');return s;}\nbool hmiStateChanged(){\n  bool changed=!hmiStateInitialized;\n  for(uint8_t i=0;i<HMI_INPUT_COUNT;i++){\n    bool logical=hmiLogicalInput(i);\n    if(hmiLastLogicalInputs[i]!=logical||hmiLastPhysicalInputs[i]!=hmiPhysicalValues[i]||hmiLastHmiInputs[i]!=hmiInputValues[i])changed=true;\n    hmiLastLogicalInputs[i]=logical;hmiLastPhysicalInputs[i]=hmiPhysicalValues[i];hmiLastHmiInputs[i]=hmiInputValues[i];\n  }\n  for(uint8_t i=0;i<HMI_OUTPUT_COUNT;i++){bool logical=hmiLogicalOutput(i);if(hmiLastLogicalOutputs[i]!=logical)changed=true;hmiLastLogicalOutputs[i]=logical;}\n  hmiStateInitialized=true;return changed;\n}\nvoid hmiSendState();\nvoid hmiProcessCommand(String command){\n  command.trim();if(!command.length())return;hmiLastMessageMs=millis();\n  if(command=="PING"){hmiTransportSend("PONG");return;}\n  if(command=="GET_STATE"){hmiScanRequested=true;hmiStateRequested=true;return;}\n  if(command=="RUN,1"||command=="RUN"){hmiControllerRunning=true;hmiScanRequested=true;hmiStateRequested=true;return;}\n  if(command=="STOP"||command=="RUN,0"){hmiControllerRunning=false;hmiForceOutputsOff();hmiStateRequested=true;hmiSendState();return;}\n  if(command.startsWith("HELLO")){hmiTransportSend("OK,SIMUPLC,READY_CODE_V20,1");hmiScanRequested=true;hmiStateRequested=true;return;}\n  if(command.startsWith("SET,")){int p=command.indexOf(',',4);if(p>4){String tag=command.substring(4,p);int ix=hmiFindInput(tag);if(ix>=0){bool next=command.substring(p+1).toInt()!=0;if(hmiInputValues[ix]!=next){hmiInputValues[ix]=next;hmiStateRequested=true;}hmiScanRequested=true;}}return;}\n  hmiTransportSend("ERROR,COMANDO_NO_RECONOCIDO");\n}\nvoid hmiSendState(){hmiTransportSend(hmiBuildState());hmiLastStateMs=millis();hmiStateRequested=false;hmiStateChanged();}`;
    code = code.replace(stateBlock, stateReplacement);

    code = code.replace(
      /void hmiBegin\(\)\{hmiLastMessageMs=millis\(\);hmiTransportBegin\(\);hmiSendState\(\);\}/,
      'void hmiBegin(){hmiLastMessageMs=millis();hmiTransportBegin();hmiScanRequested=true;hmiStateRequested=true;}'
    );
    code = code.replace(
      /void hmiLoop\(\)\{hmiTransportLoop\(\);if\(HMI_STOP_ON_TIMEOUT&&hmiControllerRunning&&\(uint32_t\)\(millis\(\)-hmiLastMessageMs\)>HMI_TIMEOUT_MS\)\{hmiControllerRunning=false;hmiForceOutputsOff\(\);\}\}/,
      'void hmiLoop(){hmiTransportLoop();if(HMI_STOP_ON_TIMEOUT&&hmiControllerRunning&&(uint32_t)(millis()-hmiLastMessageMs)>HMI_TIMEOUT_MS){hmiControllerRunning=false;hmiForceOutputsOff();hmiStateRequested=true;hmiSendState();}}'
    );
    code = code.replace(
      /void hmiMaybeSendState\(\)\{uint32_t now=millis\(\);if\(\(uint32_t\)\(now-hmiLastStateMs\)>=HMI_STATE_PERIOD_MS\)\{hmiLastStateMs=now;hmiSendState\(\);\}\}/,
      'void hmiMaybeSendState(){uint32_t now=millis();bool changed=hmiStateChanged();if(changed||hmiStateRequested||(uint32_t)(now-hmiLastStateMs)>=HMI_STATE_PERIOD_MS)hmiSendState();}'
    );

    code = code.replace(
      /if\(\(uint32_t\)\(nowMs - lastScan\) < SCAN_MS\) return;\n  lastScan = nowMs;/,
      'if(!hmiScanRequested && (uint32_t)(nowMs - lastScan) < SCAN_MS) return;\n  hmiScanRequested=false;\n  lastScan = nowMs;'
    );
    code = code.replace(
      /if\(nowMs - lastScan < SCAN_MS\) return;\n  lastScan = nowMs;/,
      'if(!hmiScanRequested && nowMs - lastScan < SCAN_MS) return;\n  hmiScanRequested=false;\n  lastScan = nowMs;'
    );

    return code;
  }

  function patchGenerator(){
    if (generatorPatched || !window.__simuplcCodegenV17Patched) return false;
    if (typeof window.generateArduinoSketch !== 'function' || typeof window.SimuPLCWrapGeneratedSketch !== 'function') return false;
    generatorPatched = true;

    const oldGenerate = window.generateArduinoSketch;
    window.generateArduinoSketch = function(){ return upgradeGeneratedCode(oldGenerate.apply(this, arguments)); };

    const oldWrap = window.SimuPLCWrapGeneratedSketch;
    window.SimuPLCWrapGeneratedSketch = function(){ return upgradeGeneratedCode(oldWrap.apply(this, arguments)); };

    window.SimuPLCCodegenVersion = VERSION;
    window.__SimuPLCV20UpgradeGeneratedCode = upgradeGeneratedCode;
    return true;
  }

  function modeDescription(tag, mode, element){
    const resolved = resolvedMode(tag, mode, element);
    if (mode === 'hmi') return 'SOLO HMI · PIN FÍSICO IGNORADO';
    if (mode === 'physical') return 'SOLO FÍSICO · HMI SOLO VISUALIZA';
    if (resolved === 'and') return 'FÍSICO Y HMI · CUALQUIERA DESACTIVA';
    return 'FÍSICO O HMI · CUALQUIERA ACTIVA';
  }

  function patchCodegenRows(){
    document.querySelectorAll('#arduinoHmiInputs .arduino-hmi-input-row').forEach(function(row){
      const tag = cleanTag(row.dataset.tag);
      const select = row.querySelector('[data-input-mode]');
      const initial = row.querySelector('[data-input-initial]');
      const badge = row.querySelector('[data-input-logic]');
      if (!select || !tag) return;

      const labels = {
        dual: 'Física + HMI — automático según contacto',
        physical: 'Solo física — HMI solo visualiza',
        hmi: 'Solo HMI — no requiere control físico',
        and: 'Permiso compartido — cualquiera desactiva (AND)'
      };
      Array.from(select.options).forEach(function(option){ if (labels[option.value]) option.textContent = labels[option.value]; });

      if (!select.dataset.v20Bound) {
        select.dataset.v20Bound = '1';
        select.addEventListener('change', function(){
          const element = findInputElement(tag);
          const nc = isNc(tag, element);
          if (initial && nc && ['dual','hmi','and'].includes(select.value)) initial.checked = true;
          saveMode(tag, select.value, nc);
          setTimeout(function(){ patchCodegenRows(); decorateControls(); }, 0);
        });
      }
      if (initial && !initial.dataset.v20Bound) {
        initial.dataset.v20Bound = '1';
        initial.addEventListener('change', function(){ saveMode(tag, select.value, isNc(tag)); });
      }

      const element = findInputElement(tag);
      const mode = select.value || getMode(tag);
      if (badge) {
        badge.textContent = (isNc(tag, element) ? 'NC · ' : 'NO · ') + modeDescription(tag, mode, element);
        badge.classList.toggle('is-and', resolvedMode(tag, mode, element) === 'and');
        badge.classList.toggle('is-or', resolvedMode(tag, mode, element) === 'or');
      }
      row.title = modeDescription(tag, mode, element);
    });

    const status = document.getElementById('arduinoHmiStatus');
    if (status) status.textContent = 'Generador HMI V20 activo · respuesta inmediata · estados físico/HMI/efectivo separados · Solo HMI disponible para pulsadores, selectores y emergencia.';
    const period = document.getElementById('arduinoHmiPeriod');
    if (period && Number(period.value) > 60) {
      period.value = '60';
      period.dispatchEvent(new Event('change', {bubbles:true}));
    }
    document.querySelectorAll('#arduinoHmiBox .sub2').forEach(function(el){
      el.textContent = el.textContent.replace(/V17/g, 'V20');
    });
  }

  function selectedElement(){
    const selectedNode = document.querySelector('#hmiCanvas .hmi-object.selected');
    if (!selectedNode) return null;
    const project = getProject();
    return project && Array.isArray(project.elements) ? project.elements.find(function(el){ return el.id === selectedNode.dataset.id; }) : null;
  }

  function ensurePropertySourceField(){
    const form = document.getElementById('hmiPropertyForm');
    if (!form || document.getElementById('hmiPropInputSourceV20')) return;
    const box = document.createElement('div');
    box.id = 'hmiInputSourceBoxV20';
    box.className = 'hmi-special-properties';
    box.innerHTML = '<label>Fuente de control Arduino<select id="hmiPropInputSourceV20"><option value="dual">Física + HMI — automático</option><option value="hmi">Solo HMI</option><option value="physical">Solo física</option><option value="and">Permiso compartido — cualquiera desactiva</option></select></label><div class="hmi-property-help" id="hmiPropInputSourceHelpV20">Selecciona cómo se combina la señal física con el control del HMI.</div>';
    const positionRow = form.querySelector('.hmi-property-row');
    if (positionRow && positionRow.parentNode === form) form.insertBefore(box, positionRow);
    else form.appendChild(box);

    const select = box.querySelector('select');
    select.addEventListener('change', function(){
      const el = selectedElement();
      if (!el || !el.tag) return;
      const nc = isNc(el.tag, el);
      saveMode(el.tag, select.value, nc);
      const row = document.querySelector('#arduinoHmiInputs .arduino-hmi-input-row[data-tag="'+cleanTag(el.tag)+'"]');
      if (row) {
        const rowSelect = row.querySelector('[data-input-mode]');
        const initial = row.querySelector('[data-input-initial]');
        if (rowSelect) rowSelect.value = select.value;
        if (initial && nc && ['dual','hmi','and'].includes(select.value)) initial.checked = true;
        if (rowSelect) rowSelect.dispatchEvent(new Event('change', {bubbles:true}));
      }
      syncPropertySourceField();
      decorateControls();
    });
  }

  function syncPropertySourceField(){
    const box = document.getElementById('hmiInputSourceBoxV20');
    const select = document.getElementById('hmiPropInputSourceV20');
    const help = document.getElementById('hmiPropInputSourceHelpV20');
    if (!box || !select) return;
    const el = selectedElement();
    const visible = !!(el && el.tag && ['pushbutton','sensor','estop','selector'].includes(el.type));
    box.hidden = !visible;
    if (!visible) return;
    const mode = getMode(el.tag);
    select.value = mode;
    if (help) help.textContent = modeDescription(el.tag, mode, el) + (el.type === 'estop' && mode === 'hmi' ? ' · La emergencia virtual inicia en estado normal cerrado.' : '');
  }

  function stateWord(value, nc, selector){
    if (selector) return value ? 'ON' : 'OFF';
    if (nc) return value ? 'CERRADO' : 'ABIERTO';
    return value ? 'ACTIVO' : 'INACTIVO';
  }

  function sourceCauseLabel(physical, hmi, nc, mode, hasPhysical, hasHmi){
    if (mode === 'hmi') return hmi ? 'HMI ACTIVO' : 'HMI NORMAL';
    if (mode === 'physical') return physical ? 'FÍSICO ACTIVO' : 'FÍSICO NORMAL';
    const physicalCause = hasPhysical && (nc ? !physical : physical);
    const hmiCause = hasHmi && (nc ? !hmi : hmi);
    if (physicalCause && hmiCause) return 'FÍSICO + HMI';
    if (physicalCause) return 'FÍSICO';
    if (hmiCause) return 'HMI';
    return 'NORMAL';
  }

  function ensureSourceBadge(node){
    let badge = node.querySelector('.hmi-source-v20');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'hmi-source-v20';
      node.appendChild(badge);
    }
    return badge;
  }

  function decorateControls(){
    const io = window.SimuPLCExternalIO;
    const ext = io && io.getState ? io.getState() : null;
    const project = getProject();
    if (!project || !Array.isArray(project.elements)) return;

    project.elements.forEach(function(el){
      if (!el || !['pushbutton','sensor','estop','selector','tank'].includes(el.type)) return;
      const node = document.querySelector('#hmiCanvas [data-id="'+el.id+'"]');
      if (!node) return;

      if (el.type === 'tank') {
        node.querySelectorAll('[data-tag][data-sensor-source]').forEach(function(){ /* reservado */ });
        node.querySelectorAll('.hmi-tank-sensor[data-tag]').forEach(function(sensor){
          const tag = cleanTag(sensor.dataset.tag);
          const related = findInputElement(tag) || el;
          const nc = isNc(tag, related);
          const mode = getMode(tag);
          const hasPhysical = !!(ext && ext.ready && own(ext.physicalInputs, tag));
          const hasHmi = !!(ext && ext.ready && own(ext.hmiInputs, tag));
          const physical = hasPhysical ? !!ext.physicalInputs[tag] : nc;
          const hmi = hasHmi ? !!ext.hmiInputs[tag] : nc;
          const label = sensor.querySelector('[data-sensor-source]');
          if (label && ext && ext.ready) label.textContent = sourceCauseLabel(physical, hmi, nc, mode, hasPhysical, hasHmi);
        });
        return;
      }

      const tag = cleanTag(el.tag);
      if (!tag) return;
      const mode = getMode(tag);
      const nc = isNc(tag, el);
      const selector = el.type === 'selector';
      const hasPhysical = !!(ext && ext.ready && own(ext.physicalInputs, tag));
      const hasHmi = !!(ext && ext.ready && own(ext.hmiInputs, tag));
      const hasEffective = !!(ext && ext.ready && own(ext.inputs, tag));
      const physical = hasPhysical ? !!ext.physicalInputs[tag] : (nc ? true : false);
      const hmi = hasHmi ? !!ext.hmiInputs[tag] : (nc ? true : false);
      const effective = hasEffective ? !!ext.inputs[tag] : (mode === 'hmi' ? hmi : mode === 'physical' ? physical : resolvedMode(tag, mode, el) === 'and' ? physical && hmi : physical || hmi);

      const badge = ensureSourceBadge(node);
      const physicalText = mode === 'hmi' ? 'F:DESHAB.' : 'F:'+stateWord(physical, nc, selector);
      const hmiText = mode === 'physical' ? 'H:LECTURA' : 'H:'+stateWord(hmi, nc, selector);
      const effectiveText = 'E:'+stateWord(effective, nc, selector);
      badge.textContent = physicalText+' · '+hmiText+' · '+effectiveText;
      badge.title = modeDescription(tag, mode, el);
      badge.dataset.mode = mode;

      if (el.type === 'sensor') {
        const label = node.querySelector('[data-sensor-source]');
        if (label && ext && ext.ready) label.textContent = sourceCauseLabel(physical, hmi, nc, mode, hasPhysical, hasHmi);
      }

      if (selector && ext && ext.ready) {
        let pos = effective ? 1 : 0;
        if (el.selectorType === '3') {
          const tag2 = cleanTag(el.tag2);
          const second = tag2 && own(ext.inputs, tag2) ? !!ext.inputs[tag2] : false;
          pos = effective && second ? 0 : (effective ? 1 : (second ? 2 : 0));
        }
        const angle = el.selectorType === '3' ? (pos === 1 ? -55 : (pos === 2 ? 55 : 0)) : (pos === 1 ? 55 : -55);
        node.style.setProperty('--selector-angle', angle+'deg');
        const knob = node.querySelector('.hmi-selector-knob');
        if (knob) knob.style.setProperty('--selector-angle', angle+'deg');
        const position = node.querySelector('.hmi-selector-position');
        if (position) position.textContent = 'EFECTIVO '+pos;
        node.classList.toggle('active', pos !== 0);
      }
    });
  }

  function installStyles(){
    if (document.getElementById('hmi-v20-control-source-styles')) return;
    const style = document.createElement('style');
    style.id = 'hmi-v20-control-source-styles';
    style.textContent = `
      #hmiCanvas .hmi-source-v20{max-width:96%;padding:3px 7px;border-radius:999px;background:rgba(226,232,240,.94);color:#334155;font:900 clamp(7px,1.2vw,9px)/1.2 Arial;text-align:center;white-space:normal;box-shadow:0 1px 3px rgba(15,23,42,.16)}
      #hmiCanvas .hmi-source-v20[data-mode="hmi"]{background:#dcfce7;color:#166534}
      #hmiCanvas .hmi-source-v20[data-mode="physical"]{background:#dbeafe;color:#1d4ed8}
      #hmiCanvas .hmi-source-v20[data-mode="and"]{background:#fef3c7;color:#92400e}
      #hmiCanvas .hmi-object-selector .hmi-source-v20{margin-top:2px}
      #hmiInputSourceBoxV20{margin-top:8px;padding:9px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff}
      #hmiInputSourceBoxV20 label{display:flex;flex-direction:column;gap:5px;font-weight:900}
      #hmiInputSourceBoxV20 select{height:38px;border:1px solid #93c5fd;border-radius:8px;background:#fff;padding:0 8px}
    `;
    document.head.appendChild(style);
  }

  function patchProtocolLabels(){
    const protocol = Array.from(document.querySelectorAll('.hmi-io-status-card b')).find(function(el){ return /SET \/ STATE/.test(el.textContent || ''); });
    if (protocol) protocol.textContent = 'SET / STATE · V20 · RESPUESTA INMEDIATA';
    document.querySelectorAll('.hmi-io-help p').forEach(function(p){
      if (/El HMI envía entradas/.test(p.textContent || '')) p.innerHTML = 'El HMI envía entradas como <code>SET,I2,1</code>. Arduino ejecuta un scan inmediato y responde con <code>STATE</code> actualizado, incluyendo estado físico, HMI y efectivo.';
    });
  }

  function patchApiHooks(){
    const api = window.SimuPLCHMI;
    if (api && !api.__v20Patched && typeof api.refreshExternalState === 'function') {
      api.__v20Patched = true;
      const oldRefresh = api.refreshExternalState;
      api.refreshExternalState = function(){
        const result = oldRefresh.apply(this, arguments);
        setTimeout(decorateControls, 0);
        return result;
      };
    }
  }

  function patchUi(){
    installStyles();
    patchCodegenRows();
    ensurePropertySourceField();
    syncPropertySourceField();
    patchProtocolLabels();
    patchApiHooks();
    decorateControls();
  }

  function startObservers(){
    window.addEventListener('simuplc-external-state', function(){ setTimeout(decorateControls, 0); });
    document.addEventListener('pointerup', function(){ setTimeout(function(){ syncPropertySourceField(); decorateControls(); }, 10); });
    setInterval(function(){
      if (document.body && document.body.classList.contains('mode-hmi')) decorateControls();
      syncPropertySourceField();
    }, 150);
    setInterval(function(){
      patchCodegenRows();
      ensurePropertySourceField();
      patchProtocolLabels();
      patchApiHooks();
    }, 600);
  }

  function boot(){
    migrateFastStatePeriod();
    patchGenerator();
    patchUi();
    startObservers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 80); }, {once:true});
  else setTimeout(boot, 80);
  const retry = setInterval(function(){ if (patchGenerator()) patchUi(); }, 120);
  setTimeout(function(){ clearInterval(retry); patchUi(); }, 5000);
})();
