(function (global) {
  'use strict';

  if (global.SimuPLCLadderAnalogInput) return;

  const VERSION = '1.6.0-phase3';
  const TYPE = 'analog_input';
  const CATALOG = global.SimuPLCAnalogCatalog || null;
  const diagnostics = {
    normalized: 0,
    created: 0,
    modalOpens: 0,
    quickControls: 0,
    valueChanges: 0,
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

  function catalogDefaults() {
    return CATALOG && typeof CATALOG.defaultParamsFor === 'function'
      ? CATALOG.defaultParamsFor(TYPE)
      : { rawMin: 0, rawMax: 4095, engMin: 0, engMax: 100, rawValue: 0, unit: '%', decimals: 1, clamp: true };
  }

  function isAI(elementOrType) {
    const value = elementOrType && typeof elementOrType === 'object' ? elementOrType.type : elementOrType;
    return String(value || '').toLowerCase() === TYPE;
  }

  function normalizeAI(element) {
    if (!element || !isAI(element)) return element;
    const defaults = catalogDefaults();
    element.type = TYPE;
    element.rawMin = num(element.rawMin, defaults.rawMin);
    element.rawMax = num(element.rawMax, defaults.rawMax);
    if (element.rawMax === element.rawMin) element.rawMax = element.rawMin + 1;
    element.engMin = num(element.engMin, defaults.engMin);
    element.engMax = num(element.engMax, defaults.engMax);
    element.rawValue = num(element.rawValue, defaults.rawValue);
    element.unit = cleanText(element.unit, defaults.unit, 12);
    element.decimals = integer(element.decimals, defaults.decimals, 0, 4);
    element.clamp = element.clamp !== false;
    element.outputMode = String(element.outputMode || element.analogOutputMode || 'scaled').toLowerCase() === 'raw' ? 'raw' : 'scaled';
    element.signalType = 'analog';
    element.analogVersion = 1;
    element.reference = element.reference == null ? '' : String(element.reference);
    element.description = element.description == null ? element.reference : String(element.description);
    if (element.clamp) element.rawValue = clamp(element.rawValue, element.rawMin, element.rawMax);
    diagnostics.normalized += 1;
    return element;
  }

  function scaleValue(raw, rawMin, rawMax, engMin, engMax, shouldClamp) {
    let ratio = (raw - rawMin) / (rawMax - rawMin || 1);
    if (shouldClamp) ratio = clamp(ratio, 0, 1);
    return engMin + ratio * (engMax - engMin);
  }

  function rawValue(element) {
    normalizeAI(element);
    return element.clamp ? clamp(element.rawValue, element.rawMin, element.rawMax) : element.rawValue;
  }

  function scaledValue(element) {
    normalizeAI(element);
    return scaleValue(rawValue(element), element.rawMin, element.rawMax, element.engMin, element.engMax, element.clamp);
  }

  function outputValue(element) {
    normalizeAI(element);
    return element.outputMode === 'raw' ? rawValue(element) : scaledValue(element);
  }

  function formattedValue(element) {
    const value = outputValue(element);
    const suffix = element.outputMode === 'raw' ? ' RAW' : (element.unit ? ' ' + element.unit : '');
    return Number(value).toFixed(element.outputMode === 'raw' ? 0 : element.decimals) + suffix;
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

  function analogElements() {
    return allElements().filter(isAI).map(normalizeAI);
  }

  function nextLabel() {
    let max = 0;
    analogElements().forEach(function (element) {
      const match = String(element.label || '').toUpperCase().match(/^AI(\d+)$/);
      if (match) max = Math.max(max, parseInt(match[1], 10) || 0);
    });
    return 'AI' + (max + 1);
  }

  function requestDraw(modelChanged) {
    try { if (modelChanged && typeof markModelDirty === 'function') markModelDirty(); } catch (_) {}
    try {
      if (typeof scheduleDraw === 'function') scheduleDraw(!!modelChanged);
      else if (typeof draw === 'function') draw();
    } catch (_) {}
  }

  function setStatus(message) {
    try { if (typeof statusText !== 'undefined' && statusText) statusText.textContent = message; } catch (_) {}
  }

  function scalePx(value) {
    try { if (typeof px === 'function') return px(value); } catch (_) {}
    try { if (typeof S === 'function') return S(value); } catch (_) {}
    return value;
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

  function drawAI(element, x, y) {
    normalizeAI(element);
    const w = scalePx(116);
    const h = scalePx(88);
    const left = x - w / 2;
    const top = y - h / 2;
    const active = !!(typeof state !== 'undefined' && state.simulationOn);

    ctx.save();
    roundedRect(ctx, left, top, w, h, scalePx(10));
    ctx.fillStyle = active ? '#e8fbff' : '#f5fbff';
    ctx.strokeStyle = active ? '#008aa6' : '#426b82';
    ctx.lineWidth = scalePx(active ? 3 : 2.3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#087e9a';
    ctx.font = '900 ' + Math.round(scalePx(22)) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', x, y - scalePx(18));

    ctx.fillStyle = '#132a38';
    ctx.font = '800 ' + Math.round(scalePx(15)) + 'px Arial';
    ctx.fillText(formattedValue(element), x, y + scalePx(8));

    ctx.fillStyle = '#55717f';
    ctx.font = '700 ' + Math.round(scalePx(9.5)) + 'px Arial';
    ctx.fillText('RAW ' + Math.round(rawValue(element)), x, y + scalePx(29));

    ctx.fillStyle = '#087e9a';
    ctx.font = '800 ' + Math.round(scalePx(10)) + 'px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('A', x + w / 2 - scalePx(8), y + scalePx(3));
    ctx.restore();
  }

  function injectStyles() {
    if (document.getElementById('simuplc-ladder-ai-style')) return;
    const style = document.createElement('style');
    style.id = 'simuplc-ladder-ai-style';
    style.textContent = `
      .ladder-lib-section[data-family="analog"] .ladder-lib-item{border-color:#9fd5df;background:#f2fcff}
      .ladder-lib-section[data-family="analog"] .ladder-lib-symbol{color:#087e9a;background:#e7f9fd;border-color:#a9dce5;font-size:18px}
      .ladder-analog-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;padding:12px;border:1px solid #b8dce5;border-radius:12px;background:#f5fcfe}
      .ladder-analog-edit-grid label{display:grid;gap:5px;font-size:12px;font-weight:800;color:#244553}
      .ladder-analog-edit-grid .wide{grid-column:1/-1}
      .ladder-analog-edit-help{grid-column:1/-1;padding:8px 10px;border-radius:9px;background:#e6f7fb;color:#285563;font-size:11px;line-height:1.35}
      .ladder-ai-var-value{font-size:18px;font-weight:900;color:#087e9a;margin:4px 0}
      .ladder-ai-var-reference{font-size:11px;color:#65727f;margin-bottom:8px}
      .ladder-ai-controls{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:8px;align-items:center}
      .ladder-ai-controls input[type="range"]{width:100%;accent-color:#008aa6}
      .ladder-ai-controls input[type="number"]{width:100%;padding:8px;border:1px solid #b8c5cf;border-radius:8px;font-weight:800}
      #ladderAiQuickOverlay{position:fixed;inset:0;z-index:10030;display:none;pointer-events:none;background:transparent}
      #ladderAiQuickOverlay.show{display:block}
      body.ladder-ai-quick-open .btn-soporte,body.ladder-ai-quick-open #btnSoporte,body.ladder-ai-quick-open #supportButton,body.ladder-ai-quick-open #ladderPremiumBtn{display:none!important}
      .ladder-ai-quick-card{position:fixed;width:min(330px,calc(100vw - 16px));max-height:none;overflow:visible;background:rgba(255,255,255,.98);border:1px solid #8fcbd8;border-radius:14px;padding:10px 12px;box-shadow:0 12px 30px rgba(0,0,0,.24);pointer-events:auto;backdrop-filter:blur(8px)}
      .ladder-ai-quick-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}
      .ladder-ai-quick-head h3{margin:0;color:#144050;font-size:13px;line-height:1.2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ladder-ai-quick-close{border:0;background:#edf6f8;color:#24505d;border-radius:999px;width:30px;height:30px;display:grid;place-items:center;font-weight:900;cursor:pointer;flex:0 0 auto}
      .ladder-ai-quick-summary{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:2px 0 8px}
      .ladder-ai-quick-display{font-size:22px;font-weight:900;color:#087e9a;line-height:1.05;white-space:nowrap}
      .ladder-ai-quick-raw{color:#637583;font-size:11px;font-weight:800;white-space:nowrap}
      .ladder-ai-quick-card .ladder-ai-controls{grid-template-columns:minmax(0,1fr) 78px;gap:8px}
      .ladder-ai-quick-card input[type="range"]{height:30px;margin:0}
      .ladder-ai-quick-card input[type="number"]{padding:7px 6px;font-size:13px}
      @media(max-width:520px){
        .ladder-analog-edit-grid{grid-template-columns:1fr}
        .ladder-analog-edit-grid .wide{grid-column:auto}
        .ladder-ai-controls{grid-template-columns:1fr 82px}
        .ladder-ai-quick-card{left:8px!important;right:8px!important;top:auto!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto;transform:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function addLibraryItem() {
    const library = document.getElementById('ladderComponentLibrary');
    if (!library || library.querySelector('[data-ladder-type="' + TYPE + '"]')) return false;
    const section = document.createElement('div');
    section.className = 'ladder-lib-section';
    section.dataset.family = 'analog';
    section.innerHTML = '<p class="ladder-lib-section-title">Analógico</p>'
      + '<div class="ladder-lib-grid">'
      + '<button type="button" class="ladder-lib-item" data-premium="1" data-ladder-type="' + TYPE + '" title="Entrada analógica: simula una señal RAW o escalada">'
      + '<span class="ladder-lib-symbol">AI</span>'
      + '<span class="ladder-lib-text"><strong>Entrada analógica</strong><span>Valor RAW o escalado</span></span>'
      + '</button></div>';
    const note = library.querySelector('.ladder-lib-note');
    if (note) library.insertBefore(section, note);
    else library.appendChild(section);
    return true;
  }

  function ensureLibrary() {
    if (addLibraryItem()) return;
    const observer = new MutationObserver(function () {
      if (addLibraryItem()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); addLibraryItem(); }, 5000);
  }

  function createEditFields() {
    const grid = document.querySelector('#editOverlay .edit-grid');
    if (!grid) return null;
    let wrap = document.getElementById('ladderAnalogEditFields');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'ladderAnalogEditFields';
    wrap.className = 'ladder-analog-edit-grid';
    wrap.innerHTML = `
      <label>Valor RAW actual<input class="edit-input" id="ladderAiRawValue" type="number" step="1"></label>
      <label>Modo de salida<select class="edit-select" id="ladderAiOutputMode"><option value="scaled">Valor escalado</option><option value="raw">Valor RAW</option></select></label>
      <label>RAW mínimo<input class="edit-input" id="ladderAiRawMin" type="number" step="any"></label>
      <label>RAW máximo<input class="edit-input" id="ladderAiRawMax" type="number" step="any"></label>
      <label>Ingeniería mínima<input class="edit-input" id="ladderAiEngMin" type="number" step="any"></label>
      <label>Ingeniería máxima<input class="edit-input" id="ladderAiEngMax" type="number" step="any"></label>
      <label>Unidad<input class="edit-input" id="ladderAiUnit" type="text" maxlength="12" placeholder="%, °C, bar..."></label>
      <label>Decimales<input class="edit-input" id="ladderAiDecimals" type="number" min="0" max="4" step="1"></label>
      <label class="wide">Limitar al rango<select class="edit-select" id="ladderAiClamp"><option value="1">Sí</option><option value="0">No</option></select></label>
      <div class="ladder-analog-edit-help">La entrada AI conserva el valor RAW y calcula el valor de ingeniería. En simulación podrás modificarla desde la tabla de variables o tocando el bloque.</div>
    `;
    const actions = grid.querySelector('.storage-actions');
    if (actions) grid.insertBefore(wrap, actions);
    else grid.appendChild(wrap);
    return wrap;
  }

  function setGenericEditVisibility(show) {
    const behaviorLabel = document.getElementById('editBehaviorSelect')?.closest('label');
    const physicalLabel = document.getElementById('editPhysicalTypeSelect')?.closest('label');
    const note = document.querySelector('#editOverlay .edit-grid > .insert-note');
    [behaviorLabel, physicalLabel, note].forEach(function (node) { if (node) node.style.display = show ? '' : 'none'; });
  }

  function fillEditFields(element) {
    const wrap = createEditFields();
    if (!wrap || !element || !isAI(element)) {
      if (wrap) wrap.style.display = 'none';
      setGenericEditVisibility(true);
      return;
    }
    normalizeAI(element);
    wrap.style.display = 'grid';
    setGenericEditVisibility(false);
    document.getElementById('ladderAiRawValue').value = element.rawValue;
    document.getElementById('ladderAiOutputMode').value = element.outputMode;
    document.getElementById('ladderAiRawMin').value = element.rawMin;
    document.getElementById('ladderAiRawMax').value = element.rawMax;
    document.getElementById('ladderAiEngMin').value = element.engMin;
    document.getElementById('ladderAiEngMax').value = element.engMax;
    document.getElementById('ladderAiUnit').value = element.unit;
    document.getElementById('ladderAiDecimals').value = element.decimals;
    document.getElementById('ladderAiClamp').value = element.clamp ? '1' : '0';
    diagnostics.modalOpens += 1;
  }

  function captureEditFields() {
    const element = elementById(state.editTargetId);
    if (!element || !isAI(element)) return;
    element.rawValue = num(document.getElementById('ladderAiRawValue')?.value, element.rawValue);
    element.outputMode = document.getElementById('ladderAiOutputMode')?.value === 'raw' ? 'raw' : 'scaled';
    element.rawMin = num(document.getElementById('ladderAiRawMin')?.value, element.rawMin);
    element.rawMax = num(document.getElementById('ladderAiRawMax')?.value, element.rawMax);
    element.engMin = num(document.getElementById('ladderAiEngMin')?.value, element.engMin);
    element.engMax = num(document.getElementById('ladderAiEngMax')?.value, element.engMax);
    element.unit = cleanText(document.getElementById('ladderAiUnit')?.value, element.unit, 12);
    element.decimals = integer(document.getElementById('ladderAiDecimals')?.value, element.decimals, 0, 4);
    element.clamp = document.getElementById('ladderAiClamp')?.value !== '0';
    normalizeAI(element);
  }

  function appendAnalogVariables() {
    if (!varsBox) return;
    analogElements().forEach(function (element) {
      const row = document.createElement('div');
      row.className = 'var-row ladder-ai-var-row';
      row.dataset.analogElementId = element.id;

      const head = document.createElement('div');
      head.className = 'var-head';
      head.innerHTML = '<div class="var-name"></div><div class="var-type">Entrada analógica</div>';
      head.querySelector('.var-name').textContent = element.label || 'AI';
      row.appendChild(head);

      const reference = document.createElement('div');
      reference.className = 'ladder-ai-var-reference';
      reference.textContent = element.description || element.reference || 'Sin referencia';
      row.appendChild(reference);

      const display = document.createElement('div');
      display.className = 'ladder-ai-var-value';
      display.textContent = formattedValue(element);
      row.appendChild(display);

      const controls = document.createElement('div');
      controls.className = 'ladder-ai-controls';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(Math.min(element.rawMin, element.rawMax));
      slider.max = String(Math.max(element.rawMin, element.rawMax));
      slider.step = '1';
      slider.value = String(rawValue(element));
      slider.setAttribute('aria-label', 'Valor RAW de ' + (element.label || 'AI'));
      const number = document.createElement('input');
      number.type = 'number';
      number.min = slider.min;
      number.max = slider.max;
      number.step = '1';
      number.value = slider.value;

      function update(value) {
        element.rawValue = num(value, element.rawValue);
        normalizeAI(element);
        slider.value = String(rawValue(element));
        number.value = slider.value;
        display.textContent = formattedValue(element);
        diagnostics.valueChanges += 1;
        requestDraw(true);
      }
      slider.addEventListener('input', function () { update(slider.value); });
      number.addEventListener('change', function () { update(number.value); });
      controls.appendChild(slider);
      controls.appendChild(number);
      row.appendChild(controls);
      varsBox.appendChild(row);
    });
  }

  let quickElementId = null;
  function ensureQuickModal() {
    let overlay = document.getElementById('ladderAiQuickOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'ladderAiQuickOverlay';
    overlay.innerHTML = `
      <div class="ladder-ai-quick-card" role="dialog" aria-modal="false" aria-label="Control rápido de entrada analógica">
        <div class="ladder-ai-quick-head"><h3 id="ladderAiQuickTitle">Entrada analógica</h3><button class="ladder-ai-quick-close" id="ladderAiQuickClose" type="button" aria-label="Cerrar">×</button></div>
        <div class="ladder-ai-quick-summary"><div class="ladder-ai-quick-display" id="ladderAiQuickDisplay"></div><div class="ladder-ai-quick-raw" id="ladderAiQuickRaw"></div></div>
        <div class="ladder-ai-controls"><input id="ladderAiQuickSlider" type="range" aria-label="Variar señal analógica"><input id="ladderAiQuickNumber" type="number" aria-label="Valor RAW"></div>
      </div>`;
    document.body.appendChild(overlay);
    function close() { overlay.classList.remove('show'); document.body.classList.remove('ladder-ai-quick-open'); quickElementId = null; }
    overlay._closeQuickControl = close;
    document.getElementById('ladderAiQuickClose').addEventListener('click', close);
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && overlay.classList.contains('show')) close(); });
    document.addEventListener('pointerdown', function (event) {
      if (!overlay.classList.contains('show')) return;
      const card = overlay.querySelector('.ladder-ai-quick-card');
      if (card && !card.contains(event.target) && event.target !== canvas) close();
    }, true);
    const slider = document.getElementById('ladderAiQuickSlider');
    const number = document.getElementById('ladderAiQuickNumber');
    function update(value) {
      const element = elementById(quickElementId);
      if (!element) return close();
      element.rawValue = num(value, element.rawValue);
      normalizeAI(element);
      slider.value = String(rawValue(element));
      number.value = slider.value;
      document.getElementById('ladderAiQuickDisplay').textContent = formattedValue(element);
      document.getElementById('ladderAiQuickRaw').textContent = 'RAW ' + Math.round(rawValue(element));
      diagnostics.valueChanges += 1;
      requestDraw(true);
    }
    slider.addEventListener('input', function () { update(slider.value); });
    number.addEventListener('input', function () { update(number.value); });
    return overlay;
  }

  function positionQuickControl(anchor) {
    const overlay = document.getElementById('ladderAiQuickOverlay');
    const card = overlay && overlay.querySelector('.ladder-ai-quick-card');
    if (!card || matchMedia('(max-width: 520px)').matches) return;
    const margin = 10;
    const rect = card.getBoundingClientRect();
    const x = anchor && Number.isFinite(anchor.clientX) ? anchor.clientX : innerWidth / 2;
    const y = anchor && Number.isFinite(anchor.clientY) ? anchor.clientY : innerHeight / 2;
    let left = x + 14;
    let top = y + 14;
    if (left + rect.width > innerWidth - margin) left = x - rect.width - 14;
    if (top + rect.height > innerHeight - margin) top = y - rect.height - 14;
    left = Math.max(margin, Math.min(left, innerWidth - rect.width - margin));
    top = Math.max(margin, Math.min(top, innerHeight - rect.height - margin));
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.right = 'auto';
    card.style.bottom = 'auto';
  }

  function openQuickControl(element, anchor) {
    if (!element || !isAI(element)) return;
    normalizeAI(element);
    const overlay = ensureQuickModal();
    quickElementId = element.id;
    document.getElementById('ladderAiQuickTitle').textContent = (element.label || 'AI') + (element.description || element.reference ? ' · ' + (element.description || element.reference) : '');
    document.getElementById('ladderAiQuickDisplay').textContent = formattedValue(element);
    document.getElementById('ladderAiQuickRaw').textContent = 'RAW ' + Math.round(rawValue(element));
    const slider = document.getElementById('ladderAiQuickSlider');
    const number = document.getElementById('ladderAiQuickNumber');
    slider.min = number.min = String(Math.min(element.rawMin, element.rawMax));
    slider.max = number.max = String(Math.max(element.rawMin, element.rawMax));
    slider.step = number.step = '1';
    slider.value = number.value = String(rawValue(element));
    overlay.classList.add('show');
    document.body.classList.add('ladder-ai-quick-open');
    requestAnimationFrame(function () { positionQuickControl(anchor); });
    diagnostics.quickControls += 1;
  }

  function findAIAtPointer(event) {
    if (!state || !state.simulationOn) return null;
    let point;
    try { point = typeof getPointerPos === 'function' ? getPointerPos(event) : { x: event.offsetX, y: event.offsetY }; }
    catch (_) { point = { x: event.offsetX, y: event.offsetY }; }
    const map = state.freeElementHitMap || [];
    for (let index = map.length - 1; index >= 0; index -= 1) {
      const hit = map[index];
      if (point.x >= hit.x && point.x <= hit.x + hit.w && point.y >= hit.y && point.y <= hit.y + hit.h && isAI(hit.element)) return hit.element;
    }
    return null;
  }

  function enrichSimulation(scan) {
    scan = scan || { elements: {}, branches: {}, coils: {} };
    scan.elements = scan.elements || {};
    scan.analog = scan.analog || {};
    state.analogValues = state.analogValues || {};
    analogElements().forEach(function (element) {
      const value = outputValue(element);
      const key = element.label || element.id;
      scan.analog[key] = value;
      state.analogValues[key] = value;
      try { state.analogValues[proPinId(element, 'out')] = value; } catch (_) {}
      scan.elements[element.id] = { active: true, energized: !!state.simulationOn, inPower: true, analogValue: value };
    });
    return scan;
  }

  function validateConnection(pinA, pinB) {
    const analogA = !!(pinA && pinA.signalType === 'analog');
    const analogB = !!(pinB && pinB.signalType === 'analog');
    if (analogA !== analogB) {
      return { ok: false, reason: 'No conectes AI directamente a una bobina o contacto digital. Usa SCALE o un comparador analógico.' };
    }
    return { ok: true };
  }

  function patchFunctions() {
    try {
      const previousLabel = window.labelForType || labelForType;
      window.labelForType = labelForType = function (type) {
        if (isAI(type)) return 'Entrada analógica';
        return previousLabel.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousDefault = window.defaultLabelForType || defaultLabelForType;
      window.defaultLabelForType = defaultLabelForType = function (type) {
        if (isAI(type)) return nextLabel();
        return previousDefault.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousBuild = window.buildPendingElement || buildPendingElement;
      window.buildPendingElement = buildPendingElement = function (type) {
        const element = previousBuild.apply(this, arguments);
        if (!isAI(type)) return element;
        element.type = TYPE;
        element.label = nextLabel();
        Object.assign(element, catalogDefaults());
        normalizeAI(element);
        diagnostics.created += 1;
        return element;
      };
    } catch (_) {}

    try {
      const previousNormalize = window.normalizeFreeElement || normalizeFreeElement;
      window.normalizeFreeElement = normalizeFreeElement = function (element, index) {
        const result = previousNormalize.apply(this, arguments);
        return isAI(result) ? normalizeAI(result) : result;
      };
    } catch (_) {}

    try {
      const previousPins = window.addFreePinsForElement || addFreePinsForElement;
      window.addFreePinsForElement = addFreePinsForElement = function (element) {
        if (!isAI(element)) return previousPins.apply(this, arguments);
        normalizeAI(element);
        addProPin({
          id: proPinId(element, 'out'),
          elementId: element.id,
          elementType: element.type,
          kind: 'output',
          side: 'out',
          role: 'A',
          signalType: 'analog',
          valueType: 'number',
          x: element.x + scalePx(PRO.componentPinDx),
          y: element.y,
          r: scalePx(9)
        });
      };
    } catch (_) {}

    try {
      const previousDraw = window.drawBasicElement || drawBasicElement;
      window.drawBasicElement = drawBasicElement = function (element, x, y) {
        if (isAI(element)) {
          drawAI(element, x, y);
          return;
        }
        return previousDraw.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousGather = window.gatherVariables || gatherVariables;
      window.gatherVariables = gatherVariables = function () {
        const aiNames = new Set(analogElements().map(function (element) { return element.label; }));
        return (previousGather.apply(this, arguments) || []).filter(function (item) { return !aiNames.has(item.name); });
      };
    } catch (_) {}

    try {
      const previousRefresh = window.refreshVariablesPanel || refreshVariablesPanel;
      window.refreshVariablesPanel = refreshVariablesPanel = function () {
        const result = previousRefresh.apply(this, arguments);
        appendAnalogVariables();
        return result;
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
        analogElements().forEach(normalizeAI);
        requestDraw(true);
        return result;
      };
    } catch (_) {}

    try {
      const previousValidate = window.validateProConnection || validateProConnection;
      window.validateProConnection = validateProConnection = function (pinA, pinB) {
        const analogA = pinA && pinA.signalType === 'analog';
        const analogB = pinB && pinB.signalType === 'analog';
        if (analogA !== analogB) return { ok: false, reason: 'No conectes AI directamente a una bobina o contacto digital. Usa SCALE o un comparador analógico.' };
        return previousValidate.apply(this, arguments);
      };
    } catch (_) {}

    try {
      const previousCompute = window.computeFreeSimulation || computeFreeSimulation;
      window.computeFreeSimulation = computeFreeSimulation = function () {
        const scan = previousCompute.apply(this, arguments) || { elements: {}, branches: {}, coils: {} };
        return enrichSimulation(scan);
      };
    } catch (_) {}

    try {
      const previousSerializable = window.getSerializableLadder || getSerializableLadder;
      window.getSerializableLadder = getSerializableLadder = function () {
        analogElements().forEach(normalizeAI);
        const model = previousSerializable.apply(this, arguments);
        diagnostics.serializations += 1;
        return model;
      };
    } catch (_) {}

    try {
      const previousLoad = window.tryLoadModel || tryLoadModel;
      window.tryLoadModel = tryLoadModel = function (model) {
        const result = previousLoad.apply(this, arguments);
        analogElements().forEach(normalizeAI);
        diagnostics.loads += 1;
        requestDraw(true);
        return result;
      };
    } catch (_) {}
  }

  function bindSaveCapture() {
    const button = document.getElementById('saveEditModal');
    if (!button || button.dataset.ladderAiCapture === '1') return;
    button.dataset.ladderAiCapture = '1';
    const capture = function () {
      try {
        captureEditFields();
        const element = elementById(state.editTargetId);
        if (element && isAI(element)) { normalizeAI(element); requestDraw(true); }
      } catch (_) {}
    };
    button.addEventListener('pointerdown', capture, true);
    button.addEventListener('click', capture, true);
  }

  function bindDirectControl() {
    canvas.addEventListener('pointerdown', function (event) {
      const element = findAIAtPointer(event);
      if (!element) {
        const overlay = document.getElementById('ladderAiQuickOverlay');
        if (overlay && overlay.classList.contains('show') && typeof overlay._closeQuickControl === 'function') overlay._closeQuickControl();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      openQuickControl(element, event);
    }, true);
  }

  function init() {
    injectStyles();
    patchFunctions();
    const fields = createEditFields();
    if (fields) fields.style.display = 'none';
    ensureLibrary();
    ensureQuickModal();
    bindSaveCapture();
    bindDirectControl();
    analogElements().forEach(normalizeAI);
    requestDraw(true);
  }

  global.SimuPLCLadderAnalogInput = Object.freeze({
    version: VERSION,
    type: TYPE,
    normalize: normalizeAI,
    rawValue: rawValue,
    scaledValue: scaledValue,
    outputValue: outputValue,
    formattedValue: formattedValue,
    enrichSimulation: enrichSimulation,
    validateConnection: validateConnection,
    list: analogElements,
    openQuickControl: openQuickControl,
    getDiagnostics: function () {
      return {
        ok: true,
        module: 'ladder-analog-input-service',
        version: VERSION,
        elementCount: analogElements().length,
        stats: Object.assign({}, diagnostics)
      };
    }
  });

  ready(init);
})(window);
