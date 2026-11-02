(function (global) {
  'use strict';

  if (global.SimuPLCLadderAnalogProcessing) return;

  const VERSION = '1.9.0-split-range-two-outputs-v13';
  const CATALOG = global.SimuPLCAnalogCatalog || null;
  const TYPES = CATALOG && CATALOG.TYPES ? CATALOG.TYPES : {
    CONST: 'analog_constant', INPUT: 'analog_input', SCALE: 'scale', GT: 'gt', LT: 'lt', EQ: 'eq', GTE: 'gte', LTE: 'lte', HYST: 'hyst', PWM: 'pwm_output', AO: 'analog_output', PID: 'pid', SPLIT: 'split_range'
  };
  const PROCESSOR_TYPES = [TYPES.CONST, TYPES.SCALE, TYPES.GT, TYPES.LT, TYPES.EQ, TYPES.GTE, TYPES.LTE, TYPES.HYST, TYPES.PID, TYPES.SPLIT, TYPES.PWM, TYPES.AO];
  const COMPARATOR_TYPES = [TYPES.GT, TYPES.LT, TYPES.EQ, TYPES.GTE, TYPES.LTE, TYPES.HYST];
  const diagnostics = {
    normalized: 0,
    created: 0,
    editOpens: 0,
    evaluations: 0,
    networkConflicts: 0,
    serializations: 0,
    loads: 0
  };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function num(value, fallback) {
    const result = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(result) ? result : fallback;
  }

  function integer(value, fallback, min, max) {
    let result = Math.round(num(value, fallback));
    if (Number.isFinite(min)) result = Math.max(min, result);
    if (Number.isFinite(max)) result = Math.min(max, result);
    return result;
  }

  function clamp(value, min, max) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.max(low, Math.min(high, value));
  }

  function cleanText(value, fallback, maxLength) {
    const result = String(value == null ? '' : value).trim();
    return (result || fallback || '').slice(0, maxLength || 120);
  }

  function normalizedType(value) {
    const raw = value && typeof value === 'object' ? value.type : value;
    return CATALOG && typeof CATALOG.normalizeType === 'function'
      ? CATALOG.normalizeType(raw)
      : String(raw || '').toLowerCase();
  }

  function isProcessor(value) {
    return PROCESSOR_TYPES.indexOf(normalizedType(value)) >= 0;
  }

  function isConstant(value) {
    return normalizedType(value) === TYPES.CONST;
  }

  function isScale(value) {
    return normalizedType(value) === TYPES.SCALE;
  }

  function isOutputSink(value) {
    const type = normalizedType(value);
    return type === TYPES.PWM || type === TYPES.AO;
  }

  function isPWM(value) { return normalizedType(value) === TYPES.PWM; }
  function isAO(value) { return normalizedType(value) === TYPES.AO; }
  function isPID(value){return normalizedType(value)===TYPES.PID;}
  function isSplit(value){return normalizedType(value)===TYPES.SPLIT;}

  function isComparator(value) {
    return COMPARATOR_TYPES.indexOf(normalizedType(value)) >= 0;
  }

  function definitionFor(value) {
    return CATALOG && typeof CATALOG.get === 'function' ? CATALOG.get(value) : null;
  }

  function defaultsFor(value) {
    return CATALOG && typeof CATALOG.defaultParamsFor === 'function'
      ? CATALOG.defaultParamsFor(value)
      : {};
  }

  function normalizeProcessor(element) {
    if (!element || !isProcessor(element)) return element;
    const type = normalizedType(element);
    const defaults = defaultsFor(type);
    element.type = type;
    element.signalType = (isConstant(type) || isScale(type) || isSplit(type)) ? 'analog' : (isOutputSink(type) ? 'analog-output' : 'mixed');
    element.analogVersion = 3;
    element.reference = element.reference == null ? '' : String(element.reference);
    element.description = element.description == null ? element.reference : String(element.description);

    if (type === TYPES.CONST) {
      element.constantValue = num(element.constantValue !== undefined ? element.constantValue : element.value, defaults.value == null ? 50 : defaults.value);
      element.value = element.constantValue;
      element.analogValue = element.constantValue;
      element.unit = cleanText(element.unit, defaults.unit || '', 12);
      element.decimals = integer(element.decimals, defaults.decimals == null ? 1 : defaults.decimals, 0, 4);
    } else if (type === TYPES.SCALE) {
      element.inMin = num(element.inMin, defaults.inMin == null ? 0 : defaults.inMin);
      element.inMax = num(element.inMax, defaults.inMax == null ? 100 : defaults.inMax);
      if (element.inMax === element.inMin) element.inMax = element.inMin + 1;
      element.outMin = num(element.outMin, defaults.outMin == null ? 0 : defaults.outMin);
      element.outMax = num(element.outMax, defaults.outMax == null ? 100 : defaults.outMax);
      element.unit = cleanText(element.unit, defaults.unit || '', 12);
      element.decimals = integer(element.decimals, defaults.decimals == null ? 1 : defaults.decimals, 0, 4);
      element.clamp = element.clamp !== false;
    } else if (isSplit(type)) {
      element.inMin=num(element.inMin,defaults.inMin==null?0:defaults.inMin);element.inMax=num(element.inMax,defaults.inMax==null?100:defaults.inMax);if(element.inMin===element.inMax)element.inMax=element.inMin+1;
      element.neutral=clamp(num(element.neutral,defaults.neutral==null?50:defaults.neutral),element.inMin,element.inMax);
      element.deadband=Math.max(0,num(element.deadband,defaults.deadband==null?2:defaults.deadband));element.outMax=Math.max(0,num(element.outMax,defaults.outMax==null?100:defaults.outMax));
      element.unit=cleanText(element.unit,defaults.unit||'%',12);element.decimals=integer(element.decimals,defaults.decimals==null?1:defaults.decimals,0,4);element.clamp=element.clamp!==false;
      element.lastAnalogInput=num(element.lastAnalogInput,element.neutral);element.splitFill=Math.max(0,num(element.splitFill,0));element.splitDrain=Math.max(0,num(element.splitDrain,0));element.analogValue=element.lastAnalogInput;
    } else if (isPID(type)) {
      element.kp=num(element.kp,2);element.ki=num(element.ki,0.5);element.kd=num(element.kd,0.1);element.sampleMs=integer(element.sampleMs,100,20,60000);
      element.outMin=num(element.outMin,0);element.outMax=num(element.outMax,100);if(element.outMin===element.outMax)element.outMax=element.outMin+1;if(element.outMin>element.outMax){const swap=element.outMin;element.outMin=element.outMax;element.outMax=swap;}
      element.mode=cleanText(element.mode,'auto',10).toLowerCase()==='manual'?'manual':'auto';
      element.manualOutput=clamp(num(element.manualOutput,0),element.outMin,element.outMax);
      element.direction=cleanText(element.direction,'heating',12).toLowerCase()==='cooling'?'cooling':'heating';
      element.unit=cleanText(element.unit,'%',12);element.decimals=integer(element.decimals,1,0,4);element._pidIntegral=num(element._pidIntegral,0);element._pidPrevError=num(element._pidPrevError,0);element._pidLastAt=num(element._pidLastAt,0);element.analogValue=clamp(num(element.analogValue,element.outMin),element.outMin,element.outMax);
    } else if (isOutputSink(type)) {
      element.inMin = num(element.inMin, defaults.inMin == null ? 0 : defaults.inMin);
      element.inMax = num(element.inMax, defaults.inMax == null ? 100 : defaults.inMax);
      if (element.inMax === element.inMin) element.inMax = element.inMin + 1;
      element.unit = cleanText(element.unit, defaults.unit || '%', 12);
      element.decimals = integer(element.decimals, defaults.decimals == null ? 1 : defaults.decimals, 0, 4);
      element.clamp = element.clamp !== false;
      if (type === TYPES.PWM) {
        element.frequency = integer(element.frequency, defaults.frequency == null ? 1000 : defaults.frequency, 1, 40000);
        element.resolution = integer(element.resolution, defaults.resolution == null ? 8 : defaults.resolution, 1, 16);
        element.outputPercent = num(element.outputPercent, 0);
      } else {
        element.voltageMin = num(element.voltageMin, defaults.voltageMin == null ? 0 : defaults.voltageMin);
        element.voltageMax = num(element.voltageMax, defaults.voltageMax == null ? 3.3 : defaults.voltageMax);
        if (element.voltageMax === element.voltageMin) element.voltageMax = element.voltageMin + 3.3;
        element.outputUnit=cleanText(element.outputUnit,defaults.outputUnit||'V',12)||'V';
        element.outputVoltage = num(element.outputVoltage, element.voltageMin);
      }
    } else if (type === TYPES.HYST) {
      element.low = num(element.low, defaults.low == null ? 40 : defaults.low);
      element.high = num(element.high, defaults.high == null ? 60 : defaults.high);
      if (element.high < element.low) { const temp = element.low; element.low = element.high; element.high = temp; }
      element.unit = cleanText(element.unit, defaults.unit || '', 12);
      element.decimals = integer(element.decimals, defaults.decimals == null ? 1 : defaults.decimals, 0, 4);
      element._hystRuntime = !!(element._hystRuntime || element.hystState);
      element.hystState = element._hystRuntime ? 1 : 0;
    } else {
      element.threshold = num(element.threshold, defaults.threshold == null ? 50 : defaults.threshold);
      element.tolerance = Math.abs(num(element.tolerance, defaults.tolerance == null ? 0.1 : defaults.tolerance));
      element.unit = cleanText(element.unit, defaults.unit || '', 12);
      element.decimals = integer(element.decimals, defaults.decimals == null ? 1 : defaults.decimals, 0, 4);
    }
    diagnostics.normalized += 1;
    return element;
  }

  function allElements() {
    try {
      if (typeof freeElements === 'function') return freeElements() || [];
    } catch (_) {}
    try {
      return state.ladder.rungs[0].elements || [];
    } catch (_) {
      return [];
    }
  }

  function elementById(id) {
    try {
      if (typeof findElementById === 'function') return findElementById(id);
    } catch (_) {}
    return allElements().find(function (element) { return element && element.id === id; }) || null;
  }

  function processorElements() {
    return allElements().filter(isProcessor).map(normalizeProcessor);
  }

  function migrateSplitOutputPins() {
    try {
      const splitIds = new Set(processorElements().filter(isSplit).map(function (element) { return String(element.id || ''); }));
      if (!splitIds.size || !state || !Array.isArray(state.proWires)) return 0;
      let migrated = 0;
      state.proWires.forEach(function (wire) {
        if (!wire) return;
        ['from', 'to'].forEach(function (field) {
          const value = String(wire[field] || '');
          const match = value.match(/^(.*):out$/i);
          if (!match || !splitIds.has(match[1])) return;
          wire[field] = match[1] + ':fill';
          migrated += 1;
        });
      });
      return migrated;
    } catch (_) {
      return 0;
    }
  }

  function prefixFor(type) {
    const normalized = normalizedType(type);
    if (normalized === TYPES.CONST) return 'CONST';
    if (normalized === TYPES.SCALE) return 'SCL';
    if (normalized === TYPES.GT) return 'GT';
    if (normalized === TYPES.LT) return 'LT';
    if (normalized === TYPES.EQ) return 'EQ';
    if (normalized === TYPES.GTE) return 'GE';
    if (normalized === TYPES.LTE) return 'LE';
    if (normalized === TYPES.HYST) return 'HYS';
    if (normalized === TYPES.PWM) return 'PWM';
    if (normalized === TYPES.AO) return 'AO';
    if (normalized === TYPES.PID) return 'PID';
    if (normalized === TYPES.SPLIT) return 'SPLIT';
    return 'A';
  }

  function nextLabel(type) {
    const prefix = prefixFor(type);
    let maximum = 0;
    allElements().forEach(function (element) {
      const match = String(element && element.label || '').toUpperCase().match(new RegExp('^' + prefix + '(\\d+)$'));
      if (match) maximum = Math.max(maximum, parseInt(match[1], 10) || 0);
    });
    return prefix + (maximum + 1);
  }

  function scalePx(value) {
    try { if (typeof px === 'function') return px(value); } catch (_) {}
    try { if (typeof S === 'function') return S(value); } catch (_) {}
    return value;
  }

  function pinId(element, side) {
    try { if (typeof proPinId === 'function') return proPinId(element, side); } catch (_) {}
    return String(element && element.id || 'x') + ':' + side;
  }

  function pinById(id) {
    try { if (typeof getProPinById === 'function') return getProPinById(id); } catch (_) {}
    try { return (state.proPins || []).find(function (pin) { return pin && pin.id === id; }) || null; } catch (_) { return null; }
  }

  function requestDraw(modelChanged) {
    try { if (modelChanged && typeof markModelDirty === 'function') markModelDirty(); } catch (_) {}
    try {
      if (typeof scheduleDraw === 'function') scheduleDraw(!!modelChanged);
      else if (typeof draw === 'function') draw();
    } catch (_) {}
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
    else {
      const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
      context.moveTo(x + r, y);
      context.arcTo(x + width, y, x + width, y + height, r);
      context.arcTo(x + width, y + height, x, y + height, r);
      context.arcTo(x, y + height, x, y, r);
      context.arcTo(x, y, x + width, y, r);
      context.closePath();
    }
  }

  function formatNumber(value, decimals, unit) {
    if (!Number.isFinite(value)) return '—';
    return Number(value).toFixed(integer(decimals, 1, 0, 4)) + (unit ? ' ' + unit : '');
  }

  function runtimeFor(element) {
    try { return state.analogElementRuntime && state.analogElementRuntime[element.id] || null; }
    catch (_) { return null; }
  }

  function drawProcessor(element, x, y) {
    normalizeProcessor(element);
    const definition = definitionFor(element.type) || {};
    const runtime = runtimeFor(element) || {};
    const sink = isOutputSink(element);
    const constant = isConstant(element);
    const width = scalePx(element.type === TYPES.PID ? 154 : (element.type === TYPES.SPLIT ? 170 : (element.type === TYPES.SCALE ? 138 : (constant ? 136 : (sink ? 142 : 122)))));
    const height = scalePx(92);
    const left = x - width / 2;
    const top = y - height / 2;
    const outputOn = !sink && !!runtime.digitalOutput;
    const hasInput = constant || Number.isFinite(runtime.inputValue);

    ctx.save();
    roundedRect(ctx, left, top, width, height, scalePx(10));
    ctx.fillStyle = outputOn ? '#fff2f2' : (sink && hasInput ? '#eefcf4' : '#f6fbff');
    ctx.strokeStyle = outputOn ? '#d10000' : (hasInput ? (sink ? '#0b8b57' : '#087e9a') : '#4a6878');
    ctx.lineWidth = scalePx(outputOn ? 3.2 : 2.4);
    ctx.fill(); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = outputOn ? '#b10000' : (sink ? '#087a4e' : '#087e9a');
    ctx.font = '900 ' + Math.round(scalePx(element.type === TYPES.SCALE ? 17 : (constant ? 18 : (sink ? 21 : 27)))) + 'px Arial';
    ctx.fillText(definition.symbol || String(element.type).toUpperCase(), x, y - scalePx(20));

    ctx.fillStyle = '#213b49'; ctx.font = '800 ' + Math.round(scalePx(11)) + 'px Arial';
    if (constant) {
      const value = Number.isFinite(runtime.outputValue) ? runtime.outputValue : element.constantValue;
      ctx.fillText(formatNumber(value, element.decimals, element.unit), x, y + scalePx(6));
      ctx.fillStyle = '#667b87'; ctx.font = '700 ' + Math.round(scalePx(9)) + 'px Arial';
      ctx.fillText('Valor fijo interno · sin pin', x, y + scalePx(29));
    } else if (isSplit(element)) {ctx.fillText('▲ '+formatNumber(runtime.fill,element.decimals,element.unit)+'  ▼ '+formatNumber(runtime.drain,element.decimals,element.unit),x,y+scalePx(5));ctx.fillStyle='#667b87';ctx.font='700 '+Math.round(scalePx(9))+'px Arial';ctx.fillText('IN '+formatNumber(runtime.inputValue,element.decimals,element.unit)+' · N '+formatNumber(element.neutral,element.decimals,element.unit),x,y+scalePx(27));
    } else if (isPID(element)) {ctx.fillText(formatNumber(runtime.outputValue,element.decimals,element.unit),x,y+scalePx(5));ctx.fillStyle='#667b87';ctx.font='700 '+Math.round(scalePx(9))+'px Arial';ctx.fillText('PV '+formatNumber(runtime.pv,element.decimals,'')+' · SP '+formatNumber(runtime.sp,element.decimals,''),x,y+scalePx(27));
    } else if (element.type === TYPES.SCALE) {
      ctx.fillText(formatNumber(runtime.inputValue, element.decimals, '') + '  →  ' + formatNumber(runtime.outputValue, element.decimals, element.unit), x, y + scalePx(7));
      ctx.fillStyle = '#667b87'; ctx.font = '700 ' + Math.round(scalePx(9)) + 'px Arial';
      ctx.fillText(element.inMin + '…' + element.inMax + ' / ' + element.outMin + '…' + element.outMax, x, y + scalePx(29));
    } else if (isPWM(element)) {
      ctx.fillText(formatNumber(runtime.outputValue, element.decimals, '%'), x, y + scalePx(4));
      ctx.fillStyle = '#667b87'; ctx.font = '700 ' + Math.round(scalePx(9)) + 'px Arial';
      ctx.fillText(element.frequency + ' Hz · ' + element.resolution + ' bits', x, y + scalePx(27));
    } else if (isAO(element)) {
      ctx.fillText(formatNumber(runtime.outputValue, element.decimals, 'V'), x, y + scalePx(4));
      ctx.fillStyle = '#667b87'; ctx.font = '700 ' + Math.round(scalePx(9)) + 'px Arial';
      ctx.fillText(element.voltageMin + '…' + element.voltageMax + ' V', x, y + scalePx(27));
    } else if (element.type === TYPES.HYST) {
      ctx.fillText(formatNumber(runtime.inputValue, element.decimals, element.unit), x, y + scalePx(4));
      ctx.fillStyle = '#667b87'; ctx.font = '700 ' + Math.round(scalePx(9)) + 'px Arial';
      ctx.fillText('OFF ' + element.low + ' · ON ' + element.high, x, y + scalePx(27));
    } else {
      ctx.fillText(formatNumber(runtime.inputValue, element.decimals, element.unit), x, y + scalePx(4));
      ctx.fillStyle = '#667b87'; ctx.font = '700 ' + Math.round(scalePx(9)) + 'px Arial';
      let thresholdText = (definition.symbol || '') + ' ' + element.threshold;
      if (element.type === TYPES.EQ) thresholdText += ' ± ' + element.tolerance;
      if (element.unit) thresholdText += ' ' + element.unit;
      ctx.fillText(thresholdText, x, y + scalePx(27));
    }

    ctx.fillStyle = '#087e9a'; ctx.font = '900 ' + Math.round(scalePx(9)) + 'px Arial'; ctx.textAlign = 'left';
    if (isPID(element)){ctx.fillText('PV',left+scalePx(7),y-scalePx(13));ctx.fillText('SP',left+scalePx(7),y+scalePx(19));} else if (!constant) ctx.fillText('A', left + scalePx(7), y + scalePx(2));
    if (!sink) {
      ctx.textAlign = 'right'; ctx.fillStyle = (isScale(element)||isSplit(element)) ? '#087e9a' : (outputOn ? '#d10000' : '#555');
      if(isSplit(element)){ctx.fillText('LLENAR',left+width-scalePx(7),y-scalePx(13));ctx.fillText('VACIAR',left+width-scalePx(7),y+scalePx(19));}
      else ctx.fillText((isScale(element) || constant || isPID(element)) ? 'A' : 'Q', left + width - scalePx(7), y + scalePx(2));
    }
    ctx.restore();
  }

  function injectStyles() {
    if (document.getElementById('simuplc-ladder-analog-processing-style')) return;
    const style = document.createElement('style');
    style.id = 'simuplc-ladder-analog-processing-style';
    style.textContent = `
      .ladder-lib-section[data-family="analog"] .ladder-lib-item{border-color:#9fd5df;background:#f2fcff}
      .ladder-lib-section[data-family="analog"] .ladder-lib-symbol{color:#087e9a;background:#e7f9fd;border-color:#a9dce5;font-size:20px}
      .ladder-lib-section[data-family="analog"] .ladder-lib-item[data-ladder-type="analog_constant"] .ladder-lib-symbol{font-size:12px;letter-spacing:-.3px}
      .ladder-analog-processing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;padding:12px;border:1px solid #b8dce5;border-radius:12px;background:#f5fcfe}
      .ladder-analog-processing-grid label{display:grid;gap:5px;font-size:12px;font-weight:800;color:#244553}
      .ladder-analog-processing-grid .wide{grid-column:1/-1}
      .ladder-analog-processing-help{grid-column:1/-1;padding:8px 10px;border-radius:9px;background:#e6f7fb;color:#285563;font-size:11px;line-height:1.35}
      .ladder-analog-runtime-row .var-type{color:#087e9a;font-weight:800}
      .ladder-analog-runtime-value{font-size:16px;font-weight:900;color:#087e9a;margin-top:6px}
      .ladder-analog-runtime-value.on{color:#c90000}
      .ladder-analog-runtime-detail{font-size:11px;color:#66717d;margin-top:4px}
      @media(max-width:520px){.ladder-analog-processing-grid{grid-template-columns:1fr}.ladder-analog-processing-grid .wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function libraryButton(definition) {
    return '<button type="button" class="ladder-lib-item" data-premium="1" data-ladder-type="' + definition.type + '" title="' + definition.name + ': ' + definition.description + '">'
      + '<span class="ladder-lib-symbol">' + definition.symbol + '</span>'
      + '<span class="ladder-lib-text"><strong>' + definition.name + '</strong><span>' + definition.description + '</span></span>'
      + '</button>';
  }

  function addLibraryItems() {
    const library = document.getElementById('ladderComponentLibrary');
    if (!library) return false;
    let section = library.querySelector('.ladder-lib-section[data-family="analog"]');
    if (!section) {
      section = document.createElement('div');
      section.className = 'ladder-lib-section';
      section.dataset.family = 'analog';
      section.innerHTML = '<p class="ladder-lib-section-title">Analógico</p><div class="ladder-lib-grid"></div>';
      const note = library.querySelector('.ladder-lib-note');
      if (note) library.insertBefore(section, note);
      else library.appendChild(section);
    }
    const grid = section.querySelector('.ladder-lib-grid') || section;
    PROCESSOR_TYPES.forEach(function (type) {
      if (grid.querySelector('[data-ladder-type="' + type + '"]')) return;
      const definition = definitionFor(type);
      if (!definition) return;
      grid.insertAdjacentHTML('beforeend', libraryButton(definition));
    });
    return true;
  }

  function ensureLibrary() {
    if (addLibraryItems()) return;
    const observer = new MutationObserver(function () {
      if (addLibraryItems()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); addLibraryItems(); }, 5000);
  }

  function createEditFields() {
    const grid = document.querySelector('#editOverlay .edit-grid');
    if (!grid) return null;
    let wrap = document.getElementById('ladderAnalogProcessingFields');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'ladderAnalogProcessingFields';
    wrap.className = 'ladder-analog-processing-grid';
    wrap.innerHTML = `
      <label data-field="constantValue">Valor constante<input class="edit-input" id="ladderAnalogConstantValue" type="number" step="any"></label>
      <label data-field="inMin">Entrada mínima<input class="edit-input" id="ladderAnalogInMin" type="number" step="any"></label>
      <label data-field="inMax">Entrada máxima<input class="edit-input" id="ladderAnalogInMax" type="number" step="any"></label>
      <label data-field="outMin">Salida mínima<input class="edit-input" id="ladderAnalogOutMin" type="number" step="any"></label>
      <label data-field="outMax">Salida máxima<input class="edit-input" id="ladderAnalogOutMax" type="number" step="any"></label>
      <label data-field="neutral">Punto neutro<input class="edit-input" id="ladderSplitNeutral" type="number" step="any"></label>
      <label data-field="deadband">Zona muerta total<input class="edit-input" id="ladderSplitDeadband" type="number" min="0" step="any"></label>
      <label data-field="splitOutMax">Salida máxima Split<input class="edit-input" id="ladderSplitOutMax" type="number" min="0" step="any"></label>
      <label data-field="threshold">Valor de comparación<input class="edit-input" id="ladderAnalogThreshold" type="number" step="any"></label>
      <label data-field="tolerance">Tolerancia<input class="edit-input" id="ladderAnalogTolerance" type="number" min="0" step="any"></label>
      <label data-field="low">Umbral de apagado<input class="edit-input" id="ladderAnalogLow" type="number" step="any"></label>
      <label data-field="high">Umbral de encendido<input class="edit-input" id="ladderAnalogHigh" type="number" step="any"></label>
      <label data-field="kp">Kp<input class="edit-input" id="ladderPidKp" type="number" step="any"></label>
      <label data-field="ki">Ki<input class="edit-input" id="ladderPidKi" type="number" step="any"></label>
      <label data-field="kd">Kd<input class="edit-input" id="ladderPidKd" type="number" step="any"></label>
      <label data-field="sampleMs">Muestreo (ms)<input class="edit-input" id="ladderPidSampleMs" type="number" min="20" step="1"></label>
      <label data-field="pidOutMin">Salida mínima<input class="edit-input" id="ladderPidOutMin" type="number" step="any"></label>
      <label data-field="pidOutMax">Salida máxima<input class="edit-input" id="ladderPidOutMax" type="number" step="any"></label>
      <label data-field="manualOutput">Salida manual<input class="edit-input" id="ladderPidManual" type="number" step="any"></label>
      <label data-field="pidMode">Modo<select class="edit-select" id="ladderPidMode"><option value="auto">Automático</option><option value="manual">Manual</option></select></label>
      <label data-field="pidDirection">Acción<select class="edit-select" id="ladderPidDirection"><option value="heating">Calefacción</option><option value="cooling">Refrigeración</option></select></label>
      <label data-field="frequency">Frecuencia PWM (Hz)<input class="edit-input" id="ladderAnalogFrequency" type="number" min="1" max="40000" step="1"></label>
      <label data-field="resolution">Resolución PWM (bits)<input class="edit-input" id="ladderAnalogResolution" type="number" min="1" max="16" step="1"></label>
      <label data-field="voltageMin">Salida mínima AO<input class="edit-input" id="ladderAnalogVoltageMin" type="number" step="any"></label>
      <label data-field="voltageMax">Salida máxima AO<input class="edit-input" id="ladderAnalogVoltageMax" type="number" step="any"></label>
      <label data-field="outputUnit">Unidad de salida AO<input class="edit-input" id="ladderAnalogOutputUnit" type="text" maxlength="12" placeholder="V, mA"></label>
      <label data-field="unit">Unidad<input class="edit-input" id="ladderAnalogUnit" type="text" maxlength="12" placeholder="%, °C, bar..."></label>
      <label data-field="decimals">Decimales<input class="edit-input" id="ladderAnalogDecimals" type="number" min="0" max="4" step="1"></label>
      <label data-field="clamp" class="wide">Limitar al rango<select class="edit-select" id="ladderAnalogClamp"><option value="1">Sí</option><option value="0">No</option></select></label>
      <div class="ladder-analog-processing-help" id="ladderAnalogProcessingHelp"></div>`;
    const actions = grid.querySelector('.storage-actions');
    if (actions) grid.insertBefore(wrap, actions); else grid.appendChild(wrap);
    return wrap;
  }

  function setGenericEditVisibility(show) {
    const behaviorLabel = document.getElementById('editBehaviorSelect')?.closest('label');
    const physicalLabel = document.getElementById('editPhysicalTypeSelect')?.closest('label');
    const note = document.querySelector('#editOverlay .edit-grid > .insert-note');
    [behaviorLabel, physicalLabel, note].forEach(function (node) { if (node) node.style.display = show ? '' : 'none'; });
  }

  function showField(wrap, name, visible) {
    const field = wrap && wrap.querySelector('[data-field="' + name + '"]');
    if (field) field.style.display = visible ? 'grid' : 'none';
  }

  function fillEditFields(element) {
    const wrap = createEditFields();
    if (!wrap || !element || !isProcessor(element)) { if (wrap) wrap.style.display = 'none'; return; }
    normalizeProcessor(element); wrap.style.display = 'grid'; setGenericEditVisibility(false);
    const constant=isConstant(element),scale=isScale(element),split=isSplit(element),sink=isOutputSink(element),pwm=isPWM(element),ao=isAO(element),pid=isPID(element);
    const hyst = normalizedType(element) === TYPES.HYST, eq = normalizedType(element) === TYPES.EQ;
    showField(wrap,'constantValue',constant);
    ['inMin','inMax','clamp'].forEach(name=>showField(wrap,name,scale||split||sink));['kp','ki','kd','sampleMs','pidOutMin','pidOutMax','manualOutput','pidMode','pidDirection'].forEach(name=>showField(wrap,name,pid));
    ['outMin','outMax'].forEach(name => showField(wrap,name,scale));['neutral','deadband','splitOutMax'].forEach(name=>showField(wrap,name,split));
    showField(wrap,'threshold',!constant&&!scale&&!split&&!sink&&!hyst&&!pid); showField(wrap,'tolerance',eq);
    showField(wrap,'low',hyst); showField(wrap,'high',hyst);
    showField(wrap,'frequency',pwm); showField(wrap,'resolution',pwm);
    showField(wrap,'voltageMin',ao); showField(wrap,'voltageMax',ao); showField(wrap,'outputUnit',ao);
    showField(wrap,'unit',true); showField(wrap,'decimals',true);
    const values={ladderAnalogConstantValue:element.constantValue,ladderAnalogInMin:element.inMin,ladderAnalogInMax:element.inMax,ladderAnalogOutMin:element.outMin,ladderAnalogOutMax:element.outMax,ladderAnalogThreshold:element.threshold,ladderAnalogTolerance:element.tolerance,ladderAnalogLow:element.low,ladderAnalogHigh:element.high,ladderAnalogFrequency:element.frequency,ladderAnalogResolution:element.resolution,ladderAnalogVoltageMin:element.voltageMin,ladderAnalogVoltageMax:element.voltageMax,ladderAnalogOutputUnit:element.outputUnit||'V',ladderAnalogUnit:element.unit||'',ladderAnalogDecimals:element.decimals,ladderPidKp:element.kp,ladderPidKi:element.ki,ladderPidKd:element.kd,ladderPidSampleMs:element.sampleMs,ladderPidOutMin:element.outMin,ladderPidOutMax:element.outMax,ladderPidManual:element.manualOutput,ladderSplitNeutral:element.neutral,ladderSplitDeadband:element.deadband,ladderSplitOutMax:element.outMax};
    Object.keys(values).forEach(id=>{const field=document.getElementById(id);if(field)field.value=values[id]==null?'':values[id];});
    const pm=document.getElementById('ladderPidMode');if(pm)pm.value=element.mode||'auto';const pd=document.getElementById('ladderPidDirection');if(pd)pd.value=element.direction||'heating';
    document.getElementById('ladderAnalogClamp').value = element.clamp === false ? '0' : '1';
    const definition=definitionFor(element.type)||{};
    document.getElementById('ladderAnalogProcessingHelp').textContent=definition.description||'Procesamiento analógico Ladder.';
    diagnostics.editOpens += 1;
  }

  function captureEditFields() {
    let element=null; try{element=elementById(state.editTargetId);}catch(_){}
    if(!element||!isProcessor(element))return;
    const type=normalizedType(element);
    if(isConstant(element)){
      element.constantValue=num(document.getElementById('ladderAnalogConstantValue')?.value,element.constantValue);
      element.value=element.constantValue; element.analogValue=element.constantValue;
    }else if(isPID(element)){element.kp=num(document.getElementById('ladderPidKp')?.value,element.kp);element.ki=num(document.getElementById('ladderPidKi')?.value,element.ki);element.kd=num(document.getElementById('ladderPidKd')?.value,element.kd);element.sampleMs=integer(document.getElementById('ladderPidSampleMs')?.value,element.sampleMs,20,60000);element.outMin=num(document.getElementById('ladderPidOutMin')?.value,element.outMin);element.outMax=num(document.getElementById('ladderPidOutMax')?.value,element.outMax);element.manualOutput=num(document.getElementById('ladderPidManual')?.value,element.manualOutput);element.mode=cleanText(document.getElementById('ladderPidMode')?.value,element.mode,10);element.direction=cleanText(document.getElementById('ladderPidDirection')?.value,element.direction,12);
    }else if(isSplit(element)){
      element.inMin=num(document.getElementById('ladderAnalogInMin')?.value,element.inMin);element.inMax=num(document.getElementById('ladderAnalogInMax')?.value,element.inMax);element.neutral=num(document.getElementById('ladderSplitNeutral')?.value,element.neutral);element.deadband=Math.max(0,num(document.getElementById('ladderSplitDeadband')?.value,element.deadband));element.outMax=Math.max(0,num(document.getElementById('ladderSplitOutMax')?.value,element.outMax));element.clamp=document.getElementById('ladderAnalogClamp')?.value!=='0';
    }else if(isScale(element)||isPID(element)||isSplit(element)||isOutputSink(element)){
      element.inMin=num(document.getElementById('ladderAnalogInMin')?.value,element.inMin);
      element.inMax=num(document.getElementById('ladderAnalogInMax')?.value,element.inMax);
      element.clamp=document.getElementById('ladderAnalogClamp')?.value!=='0';
      if(isScale(element)){
        element.outMin=num(document.getElementById('ladderAnalogOutMin')?.value,element.outMin);
        element.outMax=num(document.getElementById('ladderAnalogOutMax')?.value,element.outMax);
      }else if(type===TYPES.PWM){
        element.frequency=integer(document.getElementById('ladderAnalogFrequency')?.value,element.frequency,1,40000);
        element.resolution=integer(document.getElementById('ladderAnalogResolution')?.value,element.resolution,1,16);
      }else{
        element.voltageMin=num(document.getElementById('ladderAnalogVoltageMin')?.value,element.voltageMin);
        element.voltageMax=num(document.getElementById('ladderAnalogVoltageMax')?.value,element.voltageMax);
        element.outputUnit=cleanText(document.getElementById('ladderAnalogOutputUnit')?.value,element.outputUnit||'V',12)||'V';
      }
    }else if(type===TYPES.HYST){
      element.low=num(document.getElementById('ladderAnalogLow')?.value,element.low);
      element.high=num(document.getElementById('ladderAnalogHigh')?.value,element.high);
    }else{
      element.threshold=num(document.getElementById('ladderAnalogThreshold')?.value,element.threshold);
      if(type===TYPES.EQ)element.tolerance=Math.abs(num(document.getElementById('ladderAnalogTolerance')?.value,element.tolerance));
    }
    element.unit=cleanText(document.getElementById('ladderAnalogUnit')?.value,element.unit,12);
    element.decimals=integer(document.getElementById('ladderAnalogDecimals')?.value,element.decimals,0,4);
    normalizeProcessor(element);
  }

  function signalTypeOf(pin) {
    if (!pin) return 'unknown';
    if (pin.kind === 'junction' || pin.rail) return 'conductor';
    return pin.signalType === 'analog' ? 'analog' : 'digital';
  }

  function validateConnection(pinA, pinB) {
    if (!pinA || !pinB) return { ok: false, reason: 'Selecciona dos terminales válidos.' };
    const typeA = signalTypeOf(pinA);
    const typeB = signalTypeOf(pinB);
    if (typeA === 'conductor' || typeB === 'conductor') return { ok: true };
    if (typeA !== typeB) {
      return { ok: false, reason: 'No conectes una señal analógica directamente a una bobina o contacto digital. Usa un comparador analógico.' };
    }
    if (typeA === 'analog') {
      const kinds = [String(pinA.kind || '').toLowerCase(), String(pinB.kind || '').toLowerCase()];
      if (kinds.indexOf('output') < 0 || kinds.indexOf('input') < 0) {
        return { ok: false, reason: 'Una conexión analógica debe unir una salida A con una entrada A.' };
      }
    }
    return { ok: true };
  }

  function wireSignalType(wire) {
    if (!wire) return 'digital';
    if (wire.signalType === 'analog') return 'analog';
    const first = pinById(wire.from);
    const second = pinById(wire.to);
    return signalTypeOf(first) === 'analog' && signalTypeOf(second) === 'analog' ? 'analog' : 'digital';
  }

  function mapScale(value, element) {
    let ratio = (value - element.inMin) / (element.inMax - element.inMin || 1);
    if (element.clamp) ratio = clamp(ratio, 0, 1);
    return element.outMin + ratio * (element.outMax - element.outMin);
  }

  function mapPhysicalOutput(value, element) {
    let ratio = (value - element.inMin) / (element.inMax - element.inMin || 1);
    if (element.clamp) ratio = clamp(ratio, 0, 1);
    return isPWM(element) ? ratio * 100 : element.voltageMin + ratio * (element.voltageMax - element.voltageMin);
  }

  function comparatorResult(type, input, element) {
    if (!Number.isFinite(input)) return false;
    if (type === TYPES.GT) return input > element.threshold;
    if (type === TYPES.LT) return input < element.threshold;
    if (type === TYPES.EQ) return Math.abs(input - element.threshold) <= element.tolerance;
    if (type === TYPES.GTE) return input >= element.threshold;
    if (type === TYPES.LTE) return input <= element.threshold;
    if (type === TYPES.HYST) {
      let current = !!element._hystRuntime;
      if (input >= element.high) current = true;
      else if (input <= element.low) current = false;
      element._hystRuntime = current;
      element.hystState = current ? 1 : 0;
      return current;
    }
    return false;
  }

  /**
   * Construye la red analógica desde el modelo persistente, no solamente desde
   * los pines visuales del frame actual. Esto evita perder el valor cuando el
   * canvas regenera state.proPins, al cargar proyectos antiguos o al ocultar
   * los terminales durante la simulación.
   */
  function buildAnalogTopology(elements) {
    const analogEndpointIds = new Set();
    const syntheticPins = [];
    const pinRecord = new Map();

    function addEndpoint(id, metadata) {
      const key = String(id || '');
      if (!key || analogEndpointIds.has(key)) return;
      analogEndpointIds.add(key);
      const visual = pinById(key);
      const record = Object.assign({ id: key, kind: 'terminal', signalType: 'analog', valueType: 'number' }, metadata || {}, visual || {});
      // La identidad lógica siempre prevalece sobre datos visuales obsoletos.
      record.id = key;
      record.signalType = 'analog';
      record.valueType = 'number';
      syntheticPins.push(record);
      pinRecord.set(key, record);
    }

    (elements || []).forEach(function (element) {
      if (!element) return;
      const type = normalizedType(element);
      if (type === TYPES.INPUT || type === TYPES.CONST) {
        addEndpoint(pinId(element, 'out'), { elementId: element.id, elementType: type, kind: 'output', side: 'out', role: 'A' });
      } else if (isProcessor(element)) {
        if(isPID(element)){addEndpoint(pinId(element,'pv'),{elementId:element.id,elementType:type,kind:'input',side:'pv',role:'PV'});addEndpoint(pinId(element,'sp'),{elementId:element.id,elementType:type,kind:'input',side:'sp',role:'SP'});} else addEndpoint(pinId(element, 'in'), { elementId: element.id, elementType: type, kind: 'input', side: 'in', role: 'A' });
        if(isSplit(element)){addEndpoint(pinId(element,'fill'),{elementId:element.id,elementType:type,kind:'output',side:'fill',role:'LLENAR'});addEndpoint(pinId(element,'drain'),{elementId:element.id,elementType:type,kind:'output',side:'drain',role:'VACIAR'});}
        else if (isScale(element)||isPID(element)) addEndpoint(pinId(element, 'out'), { elementId: element.id, elementType: type, kind: 'output', side: 'out', role: 'A' });
      }
    });

    const allWires = (state.proWires || []).filter(Boolean);
    const junctionMap = new Map((state.proJunctions || []).filter(Boolean).map(function (junction) { return [junction.id, junction]; }));
    const analogWireIds = new Set();
    const connectedIds = new Set(analogEndpointIds);

    // Expande la red a través de uniones y cables explícitamente analógicos.
    let changed = true;
    let passes = 0;
    while (changed && passes < 32) {
      changed = false;
      passes += 1;
      allWires.forEach(function (wire) {
        if (!wire || !wire.from || !wire.to) return;
        const explicitAnalog = String(wire.signalType || '').toLowerCase() === 'analog';
        const touchesAnalog = connectedIds.has(wire.from) || connectedIds.has(wire.to);
        const fromJunction = /^junction:/i.test(String(wire.from)) || junctionMap.has(wire.from);
        const toJunction = /^junction:/i.test(String(wire.to)) || junctionMap.has(wire.to);
        // Solo una unión puede extender la red; no atraviesa un terminal digital.
        const canExtend = explicitAnalog ||
          (connectedIds.has(wire.from) && (connectedIds.has(wire.to) || toJunction)) ||
          (connectedIds.has(wire.to) && (connectedIds.has(wire.from) || fromJunction));
        if (!canExtend) return;
        analogWireIds.add(wire.id);
        if (!connectedIds.has(wire.from)) { connectedIds.add(wire.from); changed = true; }
        if (!connectedIds.has(wire.to)) { connectedIds.add(wire.to); changed = true; }
      });
    }

    connectedIds.forEach(function (id) {
      if (analogEndpointIds.has(id)) return;
      const junction = junctionMap.get(id);
      if (junction || /^junction:/i.test(String(id))) {
        addEndpoint(id, { kind: 'junction', junction: true, x: junction && junction.x, y: junction && junction.y });
      }
    });

    const wires = allWires.filter(function (wire) { return wire && analogWireIds.has(wire.id); });
    wires.forEach(function (wire) { wire.signalType = 'analog'; });
    const junctions = (state.proJunctions || []).filter(function (junction) { return junction && connectedIds.has(junction.id); });
    return { pins: syntheticPins, wires: wires, junctions: junctions, endpointIds: analogEndpointIds, connectedIds: connectedIds, passes: passes };
  }

  function evaluateSplit(element,input){normalizeProcessor(element);let value=num(input,element.neutral);if(element.clamp)value=clamp(value,element.inMin,element.inMax);const half=Math.max(0,element.deadband)/2;const low=clamp(element.neutral-half,element.inMin,element.inMax),high=clamp(element.neutral+half,element.inMin,element.inMax);let fill=0,drain=0;if(value>high&&element.inMax>high)fill=(value-high)/(element.inMax-high)*element.outMax;else if(value<low&&low>element.inMin)drain=(low-value)/(low-element.inMin)*element.outMax;fill=clamp(fill,0,element.outMax);drain=clamp(drain,0,element.outMax);if(fill>0)drain=0;else if(drain>0)fill=0;element.lastAnalogInput=value;element.splitFill=fill;element.splitDrain=drain;element.analogValue=value;return{input:value,fill:fill,drain:drain,low:low,high:high};}

  function evaluatePID(element,pv,sp,now){if(element.mode==='manual')return clamp(element.manualOutput,element.outMin,element.outMax);now=Number.isFinite(now)?now:Date.now();if(element._pidLastAt&&now-element._pidLastAt<element.sampleMs)return element.analogValue;const dt=Math.max(element.sampleMs,element._pidLastAt?now-element._pidLastAt:element.sampleMs)/1000;const sign=element.direction==='cooling'?-1:1;const error=(sp-pv)*sign;const derivative=(error-element._pidPrevError)/Math.max(dt,.001);const candidate=element._pidIntegral+error*dt;const raw=element.kp*error+element.ki*candidate+element.kd*derivative;const out=clamp(raw,element.outMin,element.outMax);if(raw===out||Math.sign(error)!==Math.sign(raw-out))element._pidIntegral=candidate;element._pidPrevError=error;element._pidLastAt=now;element.analogValue=out;return out;}

  function evaluateNetworks() {
    diagnostics.evaluations += 1;
    const elements = allElements();
    const processors = processorElements();
    const topology = buildAnalogTopology(elements);
    const pins = topology.pins;
    const wires = topology.wires;
    const wiring = global.SimuPLCLadderWiring;
    const graph = wiring && typeof wiring.buildElectricalGraph === 'function'
      ? wiring.buildElectricalGraph({ pins: pins, wires: wires, junctions: topology.junctions })
      : null;
    const networkValues = new Map();
    const networkSources = new Map();
    const runtimeByElement = Object.create(null);
    const digitalSeeds = [];
    const conflicts = [];

    function networkIdFor(pinIdentifier) {
      if (!pinIdentifier) return null;
      if (!graph || !graph.nodeToNetwork) return pinIdentifier;
      return graph.nodeToNetwork.get(pinIdentifier) || pinIdentifier;
    }

    function setNetworkValue(networkId, value, sourceId) {
      if (!networkId || !Number.isFinite(value)) return false;
      if (!networkValues.has(networkId)) {
        networkValues.set(networkId, value);
        networkSources.set(networkId, sourceId || 'unknown');
        return true;
      }
      const previous = networkValues.get(networkId);
      if (Math.abs(previous - value) > 1e-7 && networkSources.get(networkId) !== sourceId) {
        conflicts.push({ networkId: networkId, firstSource: networkSources.get(networkId), secondSource: sourceId, firstValue: previous, secondValue: value });
      }
      return false;
    }

    function getNetworkValue(pinIdentifier) {
      const networkId = networkIdFor(pinIdentifier);
      return networkValues.has(networkId) ? networkValues.get(networkId) : NaN;
    }

    const aiService = global.SimuPLCLadderAnalogInput;
    elements.forEach(function (element) {
      if (!element || normalizedType(element) !== TYPES.INPUT || !aiService || typeof aiService.outputValue !== 'function') return;
      const value = aiService.outputValue(element);
      const outId = pinId(element, 'out');
      setNetworkValue(networkIdFor(outId), value, element.id);
      runtimeByElement[element.id] = { type: TYPES.INPUT, outputValue: value, hasInput: true };
    });

    elements.forEach(function (element) {
      if (!element || normalizedType(element) !== TYPES.CONST) return;
      normalizeProcessor(element);
      const value = num(element.constantValue, 50);
      setNetworkValue(networkIdFor(pinId(element, 'out')), value, element.id);
      runtimeByElement[element.id] = { type: TYPES.CONST, outputValue: value, hasInput: true, constant: true };
    });

    let changed = true;
    let passes = 0;
    while (changed && passes < 24) {
      changed = false;
      passes += 1;
      processors.forEach(function(element){if(!isPID(element))return;const pv=getNetworkValue(pinId(element,'pv')),sp=getNetworkValue(pinId(element,'sp'));if(!Number.isFinite(pv)||!Number.isFinite(sp)){runtimeByElement[element.id]={type:element.type,pv:pv,sp:sp,outputValue:NaN,hasInput:false};return;}const output=evaluatePID(element,pv,sp,Date.now());runtimeByElement[element.id]={type:element.type,pv:pv,sp:sp,inputValue:pv,outputValue:output,hasInput:true};if(setNetworkValue(networkIdFor(pinId(element,'out')),output,element.id))changed=true;});
      processors.forEach(function(element){if(!isSplit(element))return;const input=getNetworkValue(pinId(element,'in'));if(!Number.isFinite(input)){runtimeByElement[element.id]={type:element.type,inputValue:NaN,fill:NaN,drain:NaN,hasInput:false};return;}const r=evaluateSplit(element,input);runtimeByElement[element.id]={type:element.type,inputValue:r.input,outputValue:r.input,fill:r.fill,drain:r.drain,low:r.low,high:r.high,hasInput:true};if(setNetworkValue(networkIdFor(pinId(element,'fill')),r.fill,element.id+':fill'))changed=true;if(setNetworkValue(networkIdFor(pinId(element,'drain')),r.drain,element.id+':drain'))changed=true;});
      processors.forEach(function (element) {
        if (!isScale(element)) return;
        const input = getNetworkValue(pinId(element, 'in'));
        if (!Number.isFinite(input)) {
          runtimeByElement[element.id] = { type: element.type, inputValue: NaN, outputValue: NaN, hasInput: false };
          return;
        }
        const output = mapScale(input, element);
        runtimeByElement[element.id] = { type: element.type, inputValue: input, outputValue: output, hasInput: true };
        if (setNetworkValue(networkIdFor(pinId(element, 'out')), output, element.id)) changed = true;
      });
    }

    processors.forEach(function (element) {
      if (!isOutputSink(element)) return;
      const input = getNetworkValue(pinId(element, 'in'));
      const output = Number.isFinite(input) ? mapPhysicalOutput(input, element) : NaN;
      if (isPWM(element)) element.outputPercent = Number.isFinite(output) ? output : 0;
      else element.outputVoltage = Number.isFinite(output) ? output : element.voltageMin;
      runtimeByElement[element.id] = { type: element.type, inputValue: input, outputValue: output, physicalOutput: true, hasInput: Number.isFinite(input) };
    });

    processors.forEach(function (element) {
      if (!isComparator(element)) return;
      const input = getNetworkValue(pinId(element, 'in'));
      const output = comparatorResult(element.type, input, element);
      runtimeByElement[element.id] = {
        type: element.type,
        inputValue: input,
        outputValue: output ? 1 : 0,
        digitalOutput: !!output,
        hasInput: Number.isFinite(input)
      };
      if (output) digitalSeeds.push(pinId(element, 'out'));
    });

    const pinValues = Object.create(null);
    topology.connectedIds.forEach(function (pinIdentifier) {
      const value = getNetworkValue(pinIdentifier);
      if (Number.isFinite(value)) pinValues[pinIdentifier] = value;
    });
    const wireValues = Object.create(null);
    wires.forEach(function (wire) {
      let value = getNetworkValue(wire.from);
      if (!Number.isFinite(value)) value = getNetworkValue(wire.to);
      if (Number.isFinite(value)) wireValues[wire.id] = value;
      wire.signalType = 'analog';
    });

    state.analogPinValues = pinValues;
    state.analogWireValues = wireValues;
    state.analogElementRuntime = runtimeByElement;
    state.analogNetworkConflicts = conflicts;
    state.analogTopologyDiagnostics = {
      wireCount: wires.length,
      pinCount: pins.length,
      topologyPasses: topology.passes,
      evaluationPasses: passes
    };
    diagnostics.networkConflicts += conflicts.length;

    return {
      passes: passes,
      graph: graph,
      networkValues: networkValues,
      pinValues: pinValues,
      wireValues: wireValues,
      elements: runtimeByElement,
      digitalSeeds: digitalSeeds,
      conflicts: conflicts,
      topology: topology
    };
  }

  function applyToScan(scan, runtime) {
    scan = scan || { elements: {}, branches: {}, coils: {} };
    scan.elements = scan.elements || {}; scan.analog = scan.analog || {};
    runtime = runtime || { elements: {}, digitalSeeds: [], conflicts: [] };
    Object.keys(runtime.elements || {}).forEach(function (elementId) {
      const info=runtime.elements[elementId]||{}, element=elementById(elementId);
      if(!element||normalizedType(element)===TYPES.INPUT)return;
      if(isConstant(element)){
        scan.elements[elementId]={active:true,energized:true,inPower:true,analogOutput:info.outputValue,constant:true};
        if(element.label&&Number.isFinite(info.outputValue))scan.analog[element.label]=info.outputValue;
        return;
      }
      if(isScale(element)||isPID(element)||isOutputSink(element)){
        scan.elements[elementId]={active:Number.isFinite(info.outputValue),energized:Number.isFinite(info.outputValue),inPower:Number.isFinite(info.inputValue),analogInput:info.inputValue,analogOutput:info.outputValue,splitFill:info.fill,splitDrain:info.drain,physicalOutput:isOutputSink(element)};
        if(element.label&&Number.isFinite(info.outputValue))scan.analog[element.label]=info.outputValue;
      }else{
        scan.elements[elementId]={active:!!info.digitalOutput,energized:!!info.digitalOutput,inPower:Number.isFinite(info.inputValue),analogInput:info.inputValue,digitalOutput:!!info.digitalOutput};
      }
    });
    scan.analogDiagnostics={processorCount:processorElements().length,conflicts:(runtime.conflicts||[]).length,passes:runtime.passes||0};
    return scan;
  }

  function seedDigitalOutputs(runtime, energyMap) {
    const target = energyMap || (state && state.freePinEnergy) || {};
    (runtime && runtime.digitalSeeds || []).forEach(function (id) { target[id] = true; });
    return target;
  }

  function clearRuntime() {
    try {
      state.analogPinValues = {};
      state.analogWireValues = {};
      state.analogElementRuntime = {};
      state.analogNetworkConflicts = [];
    } catch (_) {}
    processorElements().forEach(function (element) {
      if(isSplit(element)){element.splitFill=0;element.splitDrain=0;element.lastAnalogInput=element.neutral||0;}
      if(isPID(element)){element._pidIntegral=0;element._pidPrevError=0;element._pidLastAt=0;element.analogValue=element.outMin||0;}
      if (normalizedType(element) === TYPES.HYST) {
        element._hystRuntime = false;
        element.hystState = 0;
      }
    });
  }

  function appendProcessorVariables() {
    if (typeof varsBox === 'undefined' || !varsBox) return;
    processorElements().forEach(function (element) {
      const runtime = runtimeFor(element) || {};
      const definition = definitionFor(element.type) || {};
      const row = document.createElement('div');
      row.className = 'var-row ladder-analog-runtime-row';
      row.dataset.analogProcessorId = element.id;
      const head = document.createElement('div');
      head.className = 'var-head';
      head.innerHTML = '<div class="var-name"></div><div class="var-type"></div>';
      head.querySelector('.var-name').textContent = element.label || definition.symbol || element.type;
      head.querySelector('.var-type').textContent = definition.name || 'Analógico';
      row.appendChild(head);
      const value = document.createElement('div');
      value.className = 'ladder-analog-runtime-value' + (runtime.digitalOutput ? ' on' : '');
      if (isConstant(element)) value.textContent = formatNumber(runtime.outputValue, element.decimals, element.unit);
      else if (isScale(element)) value.textContent = formatNumber(runtime.outputValue, element.decimals, element.unit);
      else if(isSplit(element)) value.textContent='▲ '+formatNumber(runtime.fill,element.decimals,element.unit)+' · ▼ '+formatNumber(runtime.drain,element.decimals,element.unit);
      else if(isPID(element)) value.textContent=formatNumber(runtime.outputValue,element.decimals,element.unit);
      else if (isPWM(element)) value.textContent = formatNumber(runtime.outputValue, element.decimals, '%');
      else if (isAO(element)) value.textContent = formatNumber(runtime.outputValue, element.decimals, element.outputUnit||'V');
      else value.textContent = runtime.digitalOutput ? 'ACTIVO' : 'INACTIVO';
      row.appendChild(value);
      const detail = document.createElement('div');
      detail.className = 'ladder-analog-runtime-detail';
      if (isConstant(element)) detail.textContent = 'Valor fijo interno · no requiere pin';
      else if (isScale(element)) detail.textContent = 'Entrada: ' + formatNumber(runtime.inputValue, element.decimals, '');
      else if(isSplit(element)) detail.textContent='IN '+formatNumber(runtime.inputValue,element.decimals,element.unit)+' · Neutro '+formatNumber(element.neutral,element.decimals,element.unit)+' · Zona ±'+formatNumber(element.deadband/2,element.decimals,element.unit);
      else if(isPID(element)) detail.textContent='PV '+formatNumber(runtime.pv,element.decimals,'')+' · SP '+formatNumber(runtime.sp,element.decimals,'')+' · '+String(element.mode||'auto').toUpperCase();
      else if (isPWM(element)) detail.textContent = 'Entrada: ' + formatNumber(runtime.inputValue, element.decimals, element.unit) + ' · ' + element.frequency + ' Hz / ' + element.resolution + ' bits';
      else if (isAO(element)) detail.textContent = 'Entrada: ' + formatNumber(runtime.inputValue, element.decimals, element.unit) + ' · salida ' + element.voltageMin + '…' + element.voltageMax + ' ' + (element.outputUnit||'V');
      else if (normalizedType(element) === TYPES.HYST) detail.textContent = 'Entrada: ' + formatNumber(runtime.inputValue, element.decimals, element.unit) + ' · OFF ' + element.low + ' / ON ' + element.high;
      else detail.textContent = 'Entrada: ' + formatNumber(runtime.inputValue, element.decimals, element.unit) + ' · ' + (definition.symbol || '') + ' ' + element.threshold;
      row.appendChild(detail);
      varsBox.appendChild(row);
    });
  }

  function patchFunctions() {
    try {
      const previousLabel = window.labelForType || labelForType;
      window.labelForType = labelForType = function (type) {
        if (isProcessor(type)) return (definitionFor(type) || {}).name || String(type);
        return previousLabel.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousDefault = window.defaultLabelForType || defaultLabelForType;
      window.defaultLabelForType = defaultLabelForType = function (type) {
        if (isProcessor(type)) return nextLabel(type);
        return previousDefault.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousBuild = window.buildPendingElement || buildPendingElement;
      window.buildPendingElement = buildPendingElement = function (type) {
        const element = previousBuild.apply(this, arguments);
        if (!isProcessor(type)) return element;
        element.type = normalizedType(type);
        element.label = nextLabel(type);
        Object.assign(element, defaultsFor(type));
        normalizeProcessor(element);
        diagnostics.created += 1;
        return element;
      };
    } catch (_) {}

    try {
      const previousNormalize = window.normalizeFreeElement || normalizeFreeElement;
      window.normalizeFreeElement = normalizeFreeElement = function (element, index) {
        const result = previousNormalize.apply(this, arguments);
        return isProcessor(result) ? normalizeProcessor(result) : result;
      };
    } catch (_) {}

    try {
      const previousPins = window.addFreePinsForElement || addFreePinsForElement;
      window.addFreePinsForElement = addFreePinsForElement = function (element) {
        if (!isProcessor(element)) return previousPins.apply(this, arguments);
        normalizeProcessor(element);
        if(isPID(element)){addProPin({id:pinId(element,'pv'),elementId:element.id,elementType:element.type,kind:'input',side:'pv',role:'PV',signalType:'analog',valueType:'number',x:element.x-scalePx(PRO.componentPinDx),y:element.y-scalePx(16),r:scalePx(9)});addProPin({id:pinId(element,'sp'),elementId:element.id,elementType:element.type,kind:'input',side:'sp',role:'SP',signalType:'analog',valueType:'number',x:element.x-scalePx(PRO.componentPinDx),y:element.y+scalePx(16),r:scalePx(9)});} else if (!isConstant(element)) addProPin({
          id: pinId(element, 'in'), elementId: element.id, elementType: element.type,
          kind: 'input', side: 'in', role: 'A', signalType: 'analog', valueType: 'number',
          x: element.x - scalePx(PRO.componentPinDx), y: element.y, r: scalePx(9)
        });
        if(isSplit(element)){
          addProPin({id:pinId(element,'fill'),elementId:element.id,elementType:element.type,kind:'output',side:'fill',role:'LLENAR',signalType:'analog',valueType:'number',x:element.x+scalePx(PRO.componentPinDx),y:element.y-scalePx(16),r:scalePx(9)});
          addProPin({id:pinId(element,'drain'),elementId:element.id,elementType:element.type,kind:'output',side:'drain',role:'VACIAR',signalType:'analog',valueType:'number',x:element.x+scalePx(PRO.componentPinDx),y:element.y+scalePx(16),r:scalePx(9)});
        }else if (!isOutputSink(element)) addProPin({
          id: pinId(element, 'out'), elementId: element.id, elementType: element.type,
          kind: 'output', side: 'out', role:(isScale(element)||isConstant(element)||isPID(element))?'A':'Q',
          signalType:(isScale(element)||isConstant(element)||isPID(element))?'analog':'digital',
          valueType:(isScale(element)||isConstant(element)||isPID(element))?'number':'boolean',
          x: element.x + scalePx(PRO.componentPinDx), y: element.y, r: scalePx(9)
        });
      };
    } catch (_) {}

    try {
      const previousDraw = window.drawBasicElement || drawBasicElement;
      window.drawBasicElement = drawBasicElement = function (element, x, y) {
        if (isProcessor(element)) {
          drawProcessor(element, x, y);
          return;
        }
        return previousDraw.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousOpen = window.openEditModalForElement || openEditModalForElement;
      window.openEditModalForElement = openEditModalForElement = function (element) {
        const result = previousOpen.apply(this, arguments);
        fillEditFields(element);
        return result;
      };
    } catch (_) {}

    try {
      const previousSave = window.saveEditModalChanges || saveEditModalChanges;
      window.saveEditModalChanges = saveEditModalChanges = function () {
        captureEditFields();
        const result = previousSave.apply(this, arguments);
        processorElements().forEach(normalizeProcessor);
        requestDraw(true);
        return result;
      };
    } catch (_) {}

    try {
      const previousRefresh = window.refreshVariablesPanel || refreshVariablesPanel;
      window.refreshVariablesPanel = refreshVariablesPanel = function () {
        const result = previousRefresh.apply(this, arguments);
        appendProcessorVariables();
        return result;
      };
    } catch (_) {}

    try {
      const previousValidate = window.validateProConnection || validateProConnection;
      window.validateProConnection = validateProConnection = function (pinA, pinB) {
        const result = validateConnection(pinA, pinB);
        if (!result.ok) return result;
        return previousValidate.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousSerializable = window.getSerializableLadder || getSerializableLadder;
      window.getSerializableLadder = getSerializableLadder = function () {
        processorElements().forEach(normalizeProcessor);
        const model = previousSerializable.apply(this, arguments);
        diagnostics.serializations += 1;
        return model;
      };
    } catch (_) {}

    try {
      const previousLoad = window.tryLoadModel || tryLoadModel;
      window.tryLoadModel = tryLoadModel = function (model) {
        const result = previousLoad.apply(this, arguments);
        processorElements().forEach(normalizeProcessor);
        migrateSplitOutputPins();
        diagnostics.loads += 1;
        requestDraw(true);
        return result;
      };
    } catch (_) {}
  }

  function bindSaveCapture() {
    const button = document.getElementById('saveEditModal');
    if (!button || button.dataset.ladderAnalogProcessingCapture === '1') return;
    button.dataset.ladderAnalogProcessingCapture = '1';
    const capture = function () {
      try { captureEditFields(); } catch (_) {}
    };
    button.addEventListener('pointerdown', capture, true);
    button.addEventListener('click', capture, true);
  }

  function init() {
    injectStyles();
    patchFunctions();
    const fields = createEditFields();
    if (fields) fields.style.display = 'none';
    ensureLibrary();
    bindSaveCapture();
    processorElements().forEach(normalizeProcessor);
    migrateSplitOutputPins();
    requestDraw(true);
  }

  global.SimuPLCLadderAnalogProcessing = Object.freeze({
    version: VERSION,
    types: Object.freeze(PROCESSOR_TYPES.slice()),
    isProcessor: isProcessor,
    isConstant: isConstant,
    isScale: isScale,
    isOutputSink: isOutputSink,
    isPWM: isPWM,
    isAO:isAO,isPID:isPID,isSplit:isSplit,evaluateSplit:evaluateSplit,
    isComparator: isComparator,
    normalize: normalizeProcessor,
    drawElement: drawProcessor,
    list: processorElements,
    validateConnection: validateConnection,
    wireSignalType: wireSignalType,
    evaluateNetworks: evaluateNetworks,
    applyToScan: applyToScan,
    seedDigitalOutputs: seedDigitalOutputs,
    clearRuntime: clearRuntime,
    getDiagnostics: function () {
      return {
        ok: true,
        module: 'ladder-analog-processing-service',
        version: VERSION,
        processorCount: processorElements().length,
        stats: Object.assign({}, diagnostics)
      };
    }
  });

  ready(init);
})(window);
