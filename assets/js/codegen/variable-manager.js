(function (global) {
  'use strict';

  if (global.SimuPLCVariableManager) return;

  const VERSION = '1.6.1-phase3';
  const PINMAP_KEY = 'simuplc_mcu_pinmap_v2';
  const META_KEY = 'simuplc_variable_catalog_v1';
  const BOARD_KEY = 'logicsoft_arduino_board_v1';
  const UNASSIGNED = null;

  let modal = null;
  let currentRows = [];
  let currentBoard = 'uno';
  let workingMaps = {};
  let workingMeta = { variables: {} };
  let currentFilter = 'all';
  let currentSearch = '';
  let dirty = false;
  let lastValidation = null;

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
  }

  function cleanType(value) {
    return String(value || '').trim().toLowerCase();
  }

  function upper(value) {
    return String(value == null ? '' : value).trim().toUpperCase();
  }

  function hasOwn(object, key) {
    return !!object && Object.prototype.hasOwnProperty.call(object, key);
  }

  function safeText(value) {
    return String(value == null ? '' : value);
  }

  function escapeHTML(value) {
    return safeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sortPLC(a, b) {
    const left = String(a && a.label || a || '');
    const right = String(b && b.label || b || '');
    const order = { I: 1, AI: 2, Q: 3, PWM: 4, AO: 5, CONST: 6, M: 7, T: 8, C: 9, B: 10 };
    const lp = (left.match(/^[A-Z]+/i) || ['Z'])[0].toUpperCase();
    const rp = (right.match(/^[A-Z]+/i) || ['Z'])[0].toUpperCase();
    const lo = order[lp] || 99;
    const ro = order[rp] || 99;
    const ln = Number((left.match(/\d+/) || [999999])[0]);
    const rn = Number((right.match(/\d+/) || [999999])[0]);
    return lo - ro || lp.localeCompare(rp) || ln - rn || left.localeCompare(right);
  }

  function getProfiles() {
    const profiles = global.SimuPLCMCUCodegen && global.SimuPLCMCUCodegen.boards;
    return profiles || {};
  }

  function getProfile(boardId) {
    const profiles = getProfiles();
    return profiles[boardId] || profiles.uno || {
      id: 'uno', name: 'Arduino UNO R3', family: 'avr',
      digitalInputs: [2,3,4,5,6,7,8,9,10,11,12,13],
      analogInputs: ['A0','A1','A2','A3','A4','A5'],
      outputs: [8,9,10,11,12,13,7,6,5,4,3,2],
      pwmOutputs: [3,5,6,9,10,11], analogOutputs: [],
      adcBits: 10, adcRawMax: 1023
    };
  }

  function loadJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : clone(fallback);
    } catch (_) { return clone(fallback); }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function emptyMap() {
    return { digitalInputs: {}, analogInputs: {}, outputs: {}, pwmOutputs: {}, analogOutputs: {} };
  }

  function normalizeAllMaps(value) {
    const output = value && typeof value === 'object' ? clone(value) : {};
    Object.keys(getProfiles()).forEach(function (boardId) {
      if (!output[boardId] || typeof output[boardId] !== 'object') output[boardId] = emptyMap();
      output[boardId].digitalInputs = output[boardId].digitalInputs && typeof output[boardId].digitalInputs === 'object' ? output[boardId].digitalInputs : {};
      output[boardId].analogInputs = output[boardId].analogInputs && typeof output[boardId].analogInputs === 'object' ? output[boardId].analogInputs : {};
      output[boardId].outputs = output[boardId].outputs && typeof output[boardId].outputs === 'object' ? output[boardId].outputs : {};
      output[boardId].pwmOutputs = output[boardId].pwmOutputs && typeof output[boardId].pwmOutputs === 'object' ? output[boardId].pwmOutputs : {};
      output[boardId].analogOutputs = output[boardId].analogOutputs && typeof output[boardId].analogOutputs === 'object' ? output[boardId].analogOutputs : {};
    });
    return output;
  }

  function loadWorkingState() {
    workingMaps = normalizeAllMaps(loadJSON(PINMAP_KEY, {}));
    workingMeta = loadJSON(META_KEY, { version: VERSION, variables: {} });
    if (!workingMeta.variables || typeof workingMeta.variables !== 'object') workingMeta.variables = {};
    try { currentBoard = localStorage.getItem(BOARD_KEY) || 'uno'; }
    catch (_) { currentBoard = 'uno'; }
    if (!getProfiles()[currentBoard]) currentBoard = 'uno';
    dirty = false;
  }

  function persistWorkingState() {
    workingMeta.version = VERSION;
    workingMeta.updatedAt = new Date().toISOString();
    saveJSON(PINMAP_KEY, workingMaps);
    saveJSON(META_KEY, workingMeta);
    try { localStorage.setItem(BOARD_KEY, currentBoard); } catch (_) {}
    dirty = false;
  }

  function firstDescription(object) {
    const candidates = [
      object && object.description,
      object && object.comment,
      object && object.referenceText,
      object && object.reference,
      object && object.ioLabel,
      object && object.tagDescription,
      object && object.title
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const text = safeText(candidates[i]).trim();
      if (text) return text;
    }
    return '';
  }

  function fbdValue(node, kind) {
    if (!node) return '—';
    if (kind === 'analogInput' || kind === 'analogConstant' || kind === 'pwmOutput' || kind === 'analogOutput') {
      const analog = Object.assign({}, node.params && node.params.analog || {}, node.analog || {});
      const candidates = kind === 'analogConstant' ? [analog.value,node.constantValue,node.analogValue,node.value] : (kind === 'pwmOutput' ? [analog.outputPercent,node.outputPercent,node.analogValue,node.value] : (kind === 'analogOutput' ? [analog.outputVoltage,node.outputVoltage,node.analogValue,node.value] : [analog.engineeringValue, analog.scaledValue, analog.engValue, analog.value, node.analogValue, node.value]));
      for (let i = 0; i < candidates.length; i += 1) {
        const n = Number(candidates[i]);
        if (Number.isFinite(n)) {
          const decimals = Number.isFinite(Number(analog.decimals)) ? Number(analog.decimals) : 1;
          const unit = kind === 'pwmOutput' ? '%' : (kind === 'analogOutput' ? 'V' : safeText(analog.unit || node.unit || '').trim());
          return n.toFixed(Math.max(0, Math.min(4, decimals))) + (unit ? ' ' + unit : '');
        }
      }
      return '—';
    }
    if (typeof node.active === 'boolean') return node.active ? '1' : '0';
    if (Number(node.active) === 1) return '1';
    if (Number(node.active) === 0) return '0';
    if (typeof node.value === 'boolean') return node.value ? '1' : '0';
    return '—';
  }

  function ladderValue(model, label) {
    const key = upper(label);
    const containers = [
      model && model.plcState && model.plcState.flat,
      model && model.simValues,
      model && model.coilStates,
      model && model.runtime && model.runtime.values
    ];
    for (let i = 0; i < containers.length; i += 1) {
      const source = containers[i];
      if (source && hasOwn(source, key)) {
        const value = source[key];
        if (typeof value === 'boolean') return value ? '1' : '0';
        if (Number.isFinite(Number(value))) return String(value);
      }
    }
    return '—';
  }

  function flattenLadder(model) {
    const output = [];
    function walk(list) {
      (list || []).forEach(function (element) {
        if (!element) return;
        output.push(element);
        if (Array.isArray(element.branches)) element.branches.forEach(walk);
      });
    }
    (model && model.rungs || []).forEach(function (rung) { walk(rung.elements || []); });
    return output;
  }

  function labelFromNode(node, fallback) {
    return upper(node && (node.name || node.label || node.code || node.ioLabel || node.reference) || fallback);
  }

  function typeInfo(kind) {
    const map = {
      digitalInput: { title: 'Entrada digital', group: 'digitalInputs', physical: true, prefix: 'I' },
      analogInput: { title: 'Entrada analógica', group: 'analogInputs', physical: true, prefix: 'AI' },
      digitalOutput: { title: 'Salida digital', group: 'outputs', physical: true, prefix: 'Q' },
      pwmOutput: { title: 'Salida PWM', group: 'pwmOutputs', physical: true, prefix: 'PWM' },
      analogConstant: { title: 'Constante analógica', group: null, physical: false, prefix: 'CONST' },
      analogOutput: { title: 'Salida analógica DAC', group: 'analogOutputs', physical: true, prefix: 'AO' },
      memory: { title: 'Memoria interna', group: null, physical: false, prefix: 'M' },
      timer: { title: 'Temporizador', group: null, physical: false, prefix: 'T' },
      counter: { title: 'Contador', group: null, physical: false, prefix: 'C' },
      internalAnalog: { title: 'Bloque analógico interno', group: null, physical: false, prefix: 'B' },
      internalDigital: { title: 'Bloque lógico interno', group: null, physical: false, prefix: 'B' }
    };
    return map[kind] || map.internalDigital;
  }

  function addVariable(store, data) {
    const label = upper(data.label);
    if (!label) return;
    const info = typeInfo(data.kind);
    let row = store.get(label);
    if (!row) {
      row = {
        label: label,
        kind: data.kind,
        typeTitle: info.title,
        group: info.group,
        physical: info.physical,
        origins: new Set(),
        descriptions: [],
        values: [],
        typeConflict: false
      };
      store.set(label, row);
    } else if (row.kind !== data.kind) {
      row.typeConflict = true;
    }
    row.origins.add(data.origin);
    const description = safeText(data.description).trim();
    if (description && row.descriptions.indexOf(description) < 0) row.descriptions.push(description);
    const value = safeText(data.value).trim();
    if (value && value !== '—' && row.values.indexOf(value) < 0) row.values.push(value);
  }

  function collectFBD(store, state) {
    let counters = { input: 0, analog: 0, constant: 0, output: 0, pwm: 0, ao: 0, memory: 0, timer: 0, counter: 0, block: 0 };
    (state && state.nodes || []).forEach(function (node) {
      const type = cleanType(node && node.type);
      let kind = null;
      let fallback = '';
      if (type === 'input') { kind = 'digitalInput'; fallback = 'I' + (++counters.input); }
      else if (type === 'analog_input') { kind = 'analogInput'; fallback = 'AI' + (++counters.analog); }
      else if (type === 'analog_constant') { kind = 'analogConstant'; fallback = 'CONST' + (++counters.constant); }
      else if (type === 'output') { kind = 'digitalOutput'; fallback = 'Q' + (++counters.output); }
      else if (type === 'pwm_output') { kind = 'pwmOutput'; fallback = 'PWM' + (++counters.pwm); }
      else if(type==='pid'){kind='internal';fallback='PID'+(++counters.internal);}
      else if (type === 'analog_output') { kind = 'analogOutput'; fallback = 'AO' + (++counters.ao); }
      else if (type === 'm' || type === 'memory') { kind = 'memory'; fallback = 'M' + (++counters.memory); }
      else if (type === 'ton' || type === 'toff') { kind = 'timer'; fallback = 'T' + (++counters.timer); }
      else if (type === 'cnt' || type === 'ctu' || type === 'counter') { kind = 'counter'; fallback = 'C' + (++counters.counter); }
      else if (['scale','gt','lt','eq','gte','lte','hyst','hys'].indexOf(type) >= 0) { kind = 'internalAnalog'; fallback = 'B' + (++counters.block); }
      else if (['and','or','not','nand','nor','xor','xnor','sr'].indexOf(type) >= 0) { kind = 'internalDigital'; fallback = 'B' + (++counters.block); }
      if (!kind) return;
      const resolvedLabel = (kind === 'digitalInput' || kind === 'analogInput' || kind === 'digitalOutput' || kind === 'analogConstant' || kind === 'pwmOutput' || kind === 'analogOutput' || kind === 'memory')
        ? labelFromNode(node, fallback)
        : upper(node && (node.code || node.label || node.name) || fallback);
      addVariable(store, {
        label: resolvedLabel,
        kind: kind,
        origin: 'FBD',
        description: firstDescription(node),
        value: fbdValue(node, kind)
      });
    });
  }

  function collectLadder(store, model) {
    let fallback = { analog: 0, constant: 0, pwm: 0, ao: 0, timer: 0, counter: 0, block: 0 };
    flattenLadder(model).forEach(function (element) {
      const type = upper(element && element.type);
      const label = upper(element && (element.label || element.name || element.code));
      const prefix = (label.match(/^[A-Z]+/) || [''])[0];
      let kind = null;
      let resolved = label;

      if (type === 'ANALOG_INPUT') { kind = 'analogInput'; resolved = resolved || ('AI' + (++fallback.analog)); }
      else if (type === 'ANALOG_CONSTANT') { kind = 'analogConstant'; resolved = resolved || ('CONST' + (++fallback.constant)); }
      else if (type === 'PWM_OUTPUT') { kind = 'pwmOutput'; resolved = resolved || ('PWM' + (++fallback.pwm)); }
      else if (type === 'ANALOG_OUTPUT') { kind = 'analogOutput'; resolved = resolved || ('AO' + (++fallback.ao)); }
      else if (type === 'NO' || type === 'NC') {
        if (prefix === 'I') kind = 'digitalInput';
        else if (prefix === 'M') kind = 'memory';
        else if (prefix === 'Q') kind = 'digitalOutput';
      }
      else if (type === 'COIL' || type === 'SET' || type === 'RESET') {
        if (prefix === 'Q') kind = 'digitalOutput';
        else if (prefix === 'M') kind = 'memory';
      }
      else if (type === 'TON' || type === 'TOFF') { kind = 'timer'; resolved = resolved || ('T' + (++fallback.timer)); }
      else if (type === 'CTU' || type === 'CNT' || type === 'COUNTER') { kind = 'counter'; resolved = resolved || ('C' + (++fallback.counter)); }
      else if (['SCALE','GT','LT','EQ','GTE','LTE','HYS','HYST'].indexOf(type) >= 0) { kind = 'internalAnalog'; resolved = resolved || ('B' + (++fallback.block)); }
      else if (type === 'SR') { kind = 'internalDigital'; resolved = resolved || ('B' + (++fallback.block)); }

      if (!kind || !resolved) return;
      addVariable(store, {
        label: resolved,
        kind: kind,
        origin: 'Ladder',
        description: firstDescription(element),
        value: kind === 'analogConstant' ? (Number.isFinite(Number(element.constantValue)) ? Number(element.constantValue).toFixed(Math.max(0, Math.min(4, Number.isFinite(Number(element.decimals)) ? Number(element.decimals) : 1))) + (element.unit ? ' ' + element.unit : '') : '—') : ladderValue(model, resolved)
      });
    });
  }

  async function collectVariables() {
    const store = new Map();
    let fbd = { nodes: [] };
    let ladder = { rungs: [] };
    try {
      if (global.SimuPLCEditors && typeof global.SimuPLCEditors.getFBDState === 'function') fbd = global.SimuPLCEditors.getFBDState() || fbd;
    } catch (_) {}
    try {
      if (global.SimuPLCEditors && typeof global.SimuPLCEditors.getLadderState === 'function') ladder = await global.SimuPLCEditors.getLadderState() || ladder;
    } catch (_) {}
    collectFBD(store, fbd);
    collectLadder(store, ladder);

    const rows = Array.from(store.values()).map(function (row) {
      const meta = workingMeta.variables[row.label] || {};
      const storedDescription = safeText(meta.description).trim();
      row.origin = Array.from(row.origins).sort().join(' + ');
      row.description = storedDescription || row.descriptions[0] || '';
      row.value = row.values.length ? row.values.join(' / ') : '—';
      delete row.origins;
      delete row.descriptions;
      delete row.values;
      return row;
    });
    return rows.sort(sortPLC);
  }

  function mapForBoard(boardId) {
    if (!workingMaps[boardId] || typeof workingMaps[boardId] !== 'object') workingMaps[boardId] = emptyMap();
    const map = workingMaps[boardId];
    map.digitalInputs = map.digitalInputs && typeof map.digitalInputs === 'object' ? map.digitalInputs : {};
    map.analogInputs = map.analogInputs && typeof map.analogInputs === 'object' ? map.analogInputs : {};
    map.outputs = map.outputs && typeof map.outputs === 'object' ? map.outputs : {};
    map.pwmOutputs = map.pwmOutputs && typeof map.pwmOutputs === 'object' ? map.pwmOutputs : {};
    map.analogOutputs = map.analogOutputs && typeof map.analogOutputs === 'object' ? map.analogOutputs : {};
    return map;
  }

  function candidateList(row, profile) {
    if (!row || !row.group) return [];
    return Array.from(profile[row.group] || []);
  }

  function samePin(a, b) {
    return String(a) === String(b);
  }

  function pinDisplay(value, profile, group) {
    if (value == null || value === '') return 'Sin asignar';
    if (profile.id === 'esp32') return 'GPIO ' + value;
    if (group === 'analogInputs' || /^A\d+$/i.test(String(value))) return String(value).toUpperCase();
    return 'D' + value;
  }

  function autoAssign(boardId, force) {
    const profile = getProfile(boardId);
    const map = mapForBoard(boardId);
    const used = new Set();

    currentRows.filter(function (row) { return row.physical; }).forEach(function (row) {
      const group = row.group;
      const current = map[group][row.label];
      if (!force && hasOwn(map[group], row.label) && current != null && current !== '') used.add(String(current));
    });

    currentRows.filter(function (row) { return row.physical; }).forEach(function (row) {
      const group = row.group;
      const candidates = candidateList(row, profile);
      if (!force && hasOwn(map[group], row.label)) return;
      const old = map[group][row.label];
      if (force && old != null) used.delete(String(old));
      let chosen = candidates.find(function (candidate) { return !used.has(String(candidate)); });
      if (chosen == null) chosen = UNASSIGNED;
      map[group][row.label] = chosen;
      if (chosen != null) used.add(String(chosen));
    });
    dirty = true;
  }

  function warningsForPin(row, value, profile) {
    const warnings = [];
    if (value == null || value === '') return warnings;
    const numeric = Number(value);
    if (profile.id === 'esp32') {
      if ((profile.strapping || []).indexOf(numeric) >= 0) warnings.push('Pin de arranque');
      if ((profile.serial || []).indexOf(numeric) >= 0) warnings.push('Usado normalmente por Serial');
      if (row.group === 'digitalInputs' && (profile.inputOnly || []).indexOf(numeric) >= 0) warnings.push('Sin INPUT_PULLUP interno');
      if ((row.group === 'outputs' || row.group === 'pwmOutputs' || row.group === 'analogOutputs') && (profile.inputOnly || []).indexOf(numeric) >= 0) warnings.push('GPIO solo de entrada');
    } else if (numeric === 0 || numeric === 1) {
      warnings.push('D0/D1 suelen usarse para Serial');
    }
    return warnings;
  }

  function validateRows(boardId) {
    const profile = getProfile(boardId);
    const map = mapForBoard(boardId);
    const states = {};
    const usage = new Map();
    const errors = [];
    const warnings = [];

    currentRows.forEach(function (row) {
      const rowErrors = [];
      const rowWarnings = [];
      if (row.typeConflict) rowErrors.push('La misma referencia aparece con tipos incompatibles.');
      if (row.physical) {
        const value = map[row.group][row.label];
        const candidates = candidateList(row, profile);
        if (value == null || value === '') rowErrors.push('Variable sin pin asignado.');
        else {
          if (!candidates.some(function (candidate) { return samePin(candidate, value); })) rowErrors.push('Pin incompatible con ' + profile.name + '.');
          const key = String(value);
          if (!usage.has(key)) usage.set(key, []);
          usage.get(key).push(row.label);
          rowWarnings.push.apply(rowWarnings, warningsForPin(row, value, profile));
        }
      }
      states[row.label] = { errors: rowErrors, warnings: rowWarnings, status: rowErrors.length ? 'error' : (rowWarnings.length ? 'warning' : 'ok') };
    });

    usage.forEach(function (labels, pin) {
      if (labels.length < 2) return;
      labels.forEach(function (label) {
        states[label].errors.push('Pin repetido con ' + labels.filter(function (other) { return other !== label; }).join(', ') + '.');
        states[label].status = 'error';
      });
    });

    currentRows.forEach(function (row) {
      const state = states[row.label];
      state.errors.forEach(function (message) { errors.push(row.label + ': ' + message); });
      state.warnings.forEach(function (message) { warnings.push(row.label + ': ' + message); });
      if (!row.physical && !state.errors.length) state.status = 'internal';
    });

    lastValidation = {
      ok: errors.length === 0,
      errors: Array.from(new Set(errors)),
      warnings: Array.from(new Set(warnings)),
      states: states
    };
    return lastValidation;
  }

  function ensureStyles() {
    if (document.getElementById('simuplc-variable-manager-style')) return;
    const style = document.createElement('style');
    style.id = 'simuplc-variable-manager-style';
    style.textContent = `
      #btnVariables{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      #variableManagerModal{position:fixed;inset:0;z-index:100120;background:rgba(15,23,42,.62);display:none;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(5px)}
      #variableManagerCard{width:min(1180px,98vw);max-height:94vh;overflow:hidden;display:flex;flex-direction:column;border-radius:20px;background:linear-gradient(180deg,#fff,#f7fbff);color:#0f172a;border:1px solid #cbddec;box-shadow:0 28px 72px rgba(15,23,42,.28)}
      .vm-head{display:flex;align-items:flex-start;gap:14px;padding:16px 18px 12px;border-bottom:1px solid #dbe7f0;background:linear-gradient(135deg,#effaff,#fff)}
      .vm-head-main{flex:1;min-width:0}.vm-head h2{margin:0;font-size:20px}.vm-head p{margin:4px 0 0;color:#567080;font-size:12px;line-height:1.4}
      .vm-close{border:0;background:#e8f1f7;border-radius:11px;width:38px;height:38px;font-size:20px;cursor:pointer;font-weight:900}
      .vm-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:9px;padding:11px 16px;border-bottom:1px solid #e1ebf2;background:#fff}
      .vm-field{display:flex;flex-direction:column;gap:4px;min-width:210px}.vm-field label{font-size:10px;font-weight:900;color:#55707f;text-transform:uppercase;letter-spacing:.05em}
      .vm-field select,.vm-search{height:38px;border:1px solid #b9cfdd;border-radius:10px;background:#fff;padding:0 10px;font-weight:800;color:#0f2940}
      .vm-search{min-width:190px;flex:1}
      .vm-btn{height:38px;border:1px solid #b9cfdd;border-radius:10px;padding:0 12px;background:#fff;color:#12344d;font-weight:900;cursor:pointer;white-space:nowrap}
      .vm-btn.primary{background:#087f5b;color:#fff;border-color:#087f5b}.vm-btn.blue{background:#0369a1;color:#fff;border-color:#0369a1}.vm-btn.danger{color:#b42318;border-color:#f1b5ad;background:#fff6f5}
      .vm-summary{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:8px;padding:10px 16px;background:#f6fbfe;border-bottom:1px solid #e1ebf2}
      .vm-stat{border:1px solid #d5e5ef;background:#fff;border-radius:12px;padding:8px 10px}.vm-stat b{display:block;font-size:18px}.vm-stat span{font-size:10px;color:#637b88;font-weight:800;text-transform:uppercase}
      .vm-message{padding:8px 16px;font-size:12px;font-weight:800;border-bottom:1px solid #e1ebf2}.vm-message.ok{background:#ecfdf3;color:#087f5b}.vm-message.error{background:#fff1f0;color:#b42318}.vm-message.warning{background:#fff8e6;color:#9a6700}
      .vm-filters{display:flex;flex-wrap:wrap;gap:6px;padding:9px 16px;border-bottom:1px solid #e1ebf2;background:#fff}.vm-filter{border:1px solid #c8d9e3;border-radius:999px;background:#fff;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer}.vm-filter.active{background:#0f6f92;color:#fff;border-color:#0f6f92}
      .vm-table-wrap{overflow:auto;flex:1;background:#fff}.vm-table{width:100%;border-collapse:separate;border-spacing:0;min-width:1010px}.vm-table th{position:sticky;top:0;z-index:3;background:#eaf5fb;color:#25485c;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:9px 8px;border-bottom:1px solid #cfe0ea}.vm-table td{padding:8px;border-bottom:1px solid #edf2f5;vertical-align:middle;font-size:12px}.vm-table tr:hover td{background:#f9fcfe}
      .vm-status-dot{display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:12px;font-weight:900}.vm-status-dot.ok{background:#dcfae6;color:#087f5b}.vm-status-dot.error{background:#fee4e2;color:#b42318}.vm-status-dot.warning{background:#fef0c7;color:#9a6700}.vm-status-dot.internal{background:#e6eff5;color:#456477}
      .vm-label{font-weight:1000;font-size:13px;color:#102a43}.vm-kind{font-weight:800;color:#36586b}.vm-origin{display:inline-flex;border-radius:999px;background:#e9f5fb;color:#11607d;padding:4px 7px;font-size:10px;font-weight:900}
      .vm-desc{width:100%;min-width:190px;height:34px;border:1px solid #c5d6e0;border-radius:8px;padding:0 9px;background:#fff}.vm-pin{width:150px;height:34px;border:1px solid #b9cfdd;border-radius:8px;background:#fff;padding:0 8px;font-weight:800}.vm-pin.invalid{border-color:#d92d20;background:#fff5f4}.vm-no-pin{font-weight:800;color:#617683}.vm-row-message{max-width:220px;font-size:10px;line-height:1.35;color:#667d89}.vm-row-message.error{color:#b42318;font-weight:800}.vm-row-message.warning{color:#9a6700;font-weight:800}
      .vm-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-top:1px solid #dbe7f0;background:#f8fbfd}.vm-footer-note{font-size:11px;color:#5c7481}.vm-footer-actions{display:flex;gap:8px}
      #vmToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100140;background:#0f2940;color:#fff;border-radius:999px;padding:10px 16px;font-size:12px;font-weight:900;box-shadow:0 10px 30px rgba(15,41,64,.28);display:none}
      @media(max-width:760px){
        #variableManagerModal{padding:4px;align-items:stretch;overflow:hidden}
        #variableManagerCard{width:100%;height:calc(100dvh - 8px);max-height:none;border-radius:14px;min-height:0}
        .vm-head{padding:10px 11px 8px;flex:0 0 auto}.vm-head h2{font-size:16px}.vm-head p{font-size:10px;line-height:1.28;margin-top:2px}.vm-close{width:34px;height:34px}
        .vm-toolbar{padding:7px;gap:5px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
        .vm-field{min-width:0;grid-column:1/-1}.vm-field select{width:100%}.vm-search{min-width:0;width:100%;grid-column:1/-1}
        .vm-btn{min-width:0;padding:0 6px;font-size:10px;height:34px}.vm-toolbar #vmCSV{grid-column:1/-1}
        .vm-summary{display:flex;grid-template-columns:none;gap:6px;padding:6px 7px;overflow-x:auto;scrollbar-width:thin;flex:0 0 auto}
        .vm-stat{min-width:86px;padding:5px 8px;border-radius:10px}.vm-stat b{font-size:15px}.vm-stat span{font-size:8px}
        .vm-message{padding:6px 8px;font-size:10px;flex:0 0 auto}.vm-filters{padding:6px 7px;flex-wrap:nowrap;overflow-x:auto;flex:0 0 auto}.vm-filter{padding:5px 9px;flex:0 0 auto}
        .vm-table-wrap{padding:0;overflow:auto;flex:1;min-height:0;background:#fff;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}
        .vm-table{min-width:100%;width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
        .vm-table thead{display:table-header-group}.vm-table tbody{display:table-row-group}.vm-table tr{display:table-row}.vm-table th,.vm-table td{display:table-cell;width:auto;box-sizing:border-box}
        .vm-table th{padding:7px 5px;font-size:8px;white-space:nowrap}.vm-table td{padding:6px 5px;font-size:10px;background:#fff}
        .vm-table th:nth-child(1),.vm-table td:nth-child(1){width:34px;text-align:center}
        .vm-table th:nth-child(2),.vm-table td:nth-child(2){width:48px}
        .vm-table th:nth-child(5),.vm-table td:nth-child(5){width:auto}
        .vm-table th:nth-child(7),.vm-table td:nth-child(7){width:104px}
        .vm-table th:nth-child(3),.vm-table td:nth-child(3),.vm-table th:nth-child(4),.vm-table td:nth-child(4),.vm-table th:nth-child(6),.vm-table td:nth-child(6),.vm-table th:nth-child(8),.vm-table td:nth-child(8){display:none}
        .vm-table td:before{content:none}.vm-label{font-size:11px}.vm-status-dot{width:22px;height:22px}.vm-desc,.vm-pin{min-width:0;width:100%;height:31px;font-size:10px}.vm-row-message{max-width:none}
        .vm-footer{padding:7px;flex:0 0 auto;position:sticky;bottom:0;z-index:5}.vm-footer-note{display:none}.vm-footer-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.vm-footer-actions .vm-btn{width:100%}
      }
      @media(min-width:520px) and (max-width:760px){
        .vm-table{min-width:850px}.vm-table th:nth-child(3),.vm-table td:nth-child(3),.vm-table th:nth-child(4),.vm-table td:nth-child(4),.vm-table th:nth-child(6),.vm-table td:nth-child(6),.vm-table th:nth-child(8),.vm-table td:nth-child(8){display:table-cell}
        .vm-table th:nth-child(3),.vm-table td:nth-child(3){width:135px}.vm-table th:nth-child(4),.vm-table td:nth-child(4){width:82px}.vm-table th:nth-child(6),.vm-table td:nth-child(6){width:76px}.vm-table th:nth-child(8),.vm-table td:nth-child(8){width:170px}
      }
      @media(orientation:landscape) and (max-height:540px){
        #variableManagerCard{height:calc(100dvh - 4px)}.vm-head{padding:6px 9px}.vm-head p{display:none}.vm-head h2{font-size:14px}.vm-close{width:30px;height:30px}
        .vm-toolbar{display:flex;flex-wrap:nowrap;padding:5px}.vm-field{min-width:180px}.vm-search{min-width:150px}.vm-btn{flex:0 0 auto;height:32px}.vm-toolbar #vmCSV{grid-column:auto}
        .vm-summary{padding:4px 6px}.vm-stat{min-width:76px;padding:3px 7px}.vm-stat b{font-size:13px}.vm-message{padding:4px 7px}.vm-filters{padding:4px 6px}.vm-footer{padding:5px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    if (document.getElementById('btnVariables')) return;
    const topbar = document.getElementById('topbar');
    if (!topbar) return;
    const button = document.createElement('button');
    button.id = 'btnVariables';
    button.type = 'button';
    button.title = 'Tabla profesional de variables y asignación de pines';
    button.innerHTML = '<span aria-hidden="true">📋</span><span>VARIABLES</span>';
    const arduino = document.getElementById('btnArduino');
    const spacer = document.getElementById('spacer');
    if (arduino && arduino.parentNode === topbar) topbar.insertBefore(button, arduino);
    else if (spacer && spacer.parentNode === topbar) topbar.insertBefore(button, spacer);
    else topbar.appendChild(button);
    button.addEventListener('click', function () { open(); });
  }

  function boardOptions() {
    const profiles = getProfiles();
    return Object.keys(profiles).map(function (id) {
      return '<option value="' + escapeHTML(id) + '"' + (id === currentBoard ? ' selected' : '') + '>' + escapeHTML(profiles[id].name || id) + '</option>';
    }).join('');
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'variableManagerModal';
    modal.innerHTML = `
      <section id="variableManagerCard" role="dialog" aria-modal="true" aria-labelledby="vmTitle">
        <header class="vm-head">
          <div class="vm-head-main"><h2 id="vmTitle">Tabla profesional de variables</h2><p>Administra I, AI, Q y variables internas de FBD y Ladder. Las asignaciones se guardan por placa y son utilizadas directamente por CÓDIGO MCU.</p></div>
          <button class="vm-close" id="vmClose" type="button" aria-label="Cerrar">×</button>
        </header>
        <div class="vm-toolbar">
          <div class="vm-field"><label for="vmBoard">Placa</label><select id="vmBoard"></select></div>
          <input id="vmSearch" class="vm-search" type="search" placeholder="Buscar variable o descripción..." />
          <button class="vm-btn blue" id="vmAuto" type="button">AUTOASIGNAR</button>
          <button class="vm-btn" id="vmValidate" type="button">VALIDAR</button>
          <button class="vm-btn danger" id="vmReset" type="button">RESTABLECER</button>
          <button class="vm-btn" id="vmCSV" type="button">EXPORTAR CSV</button>
        </div>
        <div class="vm-summary" id="vmSummary"></div>
        <div class="vm-message ok" id="vmMessage">Leyendo variables...</div>
        <div class="vm-filters" id="vmFilters">
          <button class="vm-filter active" data-filter="all" type="button">Todas</button>
          <button class="vm-filter" data-filter="physical" type="button">Físicas</button>
          <button class="vm-filter" data-filter="internal" type="button">Internas</button>
          <button class="vm-filter" data-filter="errors" type="button">Con errores</button>
        </div>
        <div class="vm-table-wrap">
          <table class="vm-table">
            <thead><tr><th>Estado</th><th>Variable</th><th>Tipo</th><th>Editor</th><th>Descripción</th><th>Valor</th><th>Pin</th><th>Diagnóstico</th></tr></thead>
            <tbody id="vmBody"></tbody>
          </table>
        </div>
        <footer class="vm-footer">
          <div class="vm-footer-note">Las memorias, temporizadores, contadores y resultados internos no necesitan pin físico.</div>
          <div class="vm-footer-actions"><button class="vm-btn" id="vmOpenCode" type="button">CÓDIGO MCU</button><button class="vm-btn primary" id="vmSave" type="button">GUARDAR</button></div>
        </footer>
      </section>
      <div id="vmToast"></div>
    `;
    document.body.appendChild(modal);
    bindModalEvents();
    return modal;
  }

  function showToast(message) {
    const toast = document.getElementById('vmToast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.style.display = 'none'; }, 2400);
  }

  function close(force) {
    if (!modal) return;
    if (dirty && !force) {
      const discard = confirm('Hay cambios sin guardar en la tabla de variables. ¿Cerrar y descartarlos?');
      if (!discard) return;
    }
    modal.style.display = 'none';
    document.body.style.overflow = '';
    dirty = false;
  }

  function setFilter(filter) {
    currentFilter = filter || 'all';
    document.querySelectorAll('#vmFilters .vm-filter').forEach(function (button) {
      button.classList.toggle('active', button.dataset.filter === currentFilter);
    });
    renderTable();
  }

  function pinOptions(row, profile, current) {
    const candidates = candidateList(row, profile);
    let html = '<option value=""' + (current == null || current === '' ? ' selected' : '') + '>Sin asignar</option>';
    const validCurrent = candidates.some(function (candidate) { return samePin(candidate, current); });
    if (current != null && current !== '' && !validCurrent) {
      html += '<option value="' + escapeHTML(current) + '" selected>⚠ ' + escapeHTML(pinDisplay(current, profile, row.group)) + ' (incompatible)</option>';
    }
    candidates.forEach(function (candidate) {
      html += '<option value="' + escapeHTML(candidate) + '"' + (samePin(candidate, current) ? ' selected' : '') + '>' + escapeHTML(pinDisplay(candidate, profile, row.group)) + '</option>';
    });
    return html;
  }

  function filteredRows(validation) {
    const query = currentSearch.trim().toLowerCase();
    return currentRows.filter(function (row) {
      const state = validation.states[row.label] || { status: 'ok' };
      if (currentFilter === 'physical' && !row.physical) return false;
      if (currentFilter === 'internal' && row.physical) return false;
      if (currentFilter === 'errors' && state.status !== 'error') return false;
      if (query) {
        const haystack = [row.label, row.typeTitle, row.origin, row.description].join(' ').toLowerCase();
        if (haystack.indexOf(query) < 0) return false;
      }
      return true;
    });
  }

  function renderSummary(validation) {
    const physical = currentRows.filter(function (row) { return row.physical; }).length;
    const internal = currentRows.length - physical;
    const assigned = currentRows.filter(function (row) {
      if (!row.physical) return false;
      const map = mapForBoard(currentBoard);
      return map[row.group][row.label] != null && map[row.group][row.label] !== '';
    }).length;
    const errorCount = Object.keys(validation.states).filter(function (label) { return validation.states[label].status === 'error'; }).length;
    const warningCount = Object.keys(validation.states).filter(function (label) { return validation.states[label].status === 'warning'; }).length;
    const target = document.getElementById('vmSummary');
    if (!target) return;
    target.innerHTML = [
      ['Variables', currentRows.length], ['Físicas', physical], ['Asignadas', assigned + '/' + physical], ['Errores', errorCount], ['Advertencias', warningCount]
    ].map(function (item) { return '<div class="vm-stat"><b>' + item[1] + '</b><span>' + item[0] + '</span></div>'; }).join('');
  }

  function renderMessage(validation) {
    const target = document.getElementById('vmMessage');
    if (!target) return;
    if (validation.errors.length) {
      target.className = 'vm-message error';
      target.textContent = validation.errors.length + ' error(es). Corrige los pines marcados antes de generar código.';
    } else if (validation.warnings.length) {
      target.className = 'vm-message warning';
      target.textContent = 'Asignación válida con ' + validation.warnings.length + ' advertencia(s).';
    } else {
      target.className = 'vm-message ok';
      target.textContent = 'Asignación válida para ' + getProfile(currentBoard).name + '.';
    }
  }

  function renderTable() {
    const validation = validateRows(currentBoard);
    const profile = getProfile(currentBoard);
    const map = mapForBoard(currentBoard);
    renderSummary(validation);
    renderMessage(validation);
    const body = document.getElementById('vmBody');
    if (!body) return;
    const rows = filteredRows(validation);
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" style="padding:24px;text-align:center;color:#6b7f8b">No hay variables para este filtro.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (row) {
      const state = validation.states[row.label] || { status: 'ok', errors: [], warnings: [] };
      const icon = state.status === 'ok' ? '✓' : (state.status === 'error' ? '!' : (state.status === 'warning' ? '⚠' : '•'));
      const current = row.physical ? map[row.group][row.label] : null;
      const messages = state.errors.concat(state.warnings);
      const messageClass = state.errors.length ? 'error' : (state.warnings.length ? 'warning' : '');
      return '<tr data-variable="' + escapeHTML(row.label) + '">' +
        '<td data-label="Estado"><span class="vm-status-dot ' + state.status + '" title="' + escapeHTML(messages.join(' ')) + '">' + icon + '</span></td>' +
        '<td data-label="Variable"><span class="vm-label">' + escapeHTML(row.label) + '</span></td>' +
        '<td data-label="Tipo"><span class="vm-kind">' + escapeHTML(row.typeTitle) + '</span></td>' +
        '<td data-label="Editor"><span class="vm-origin">' + escapeHTML(row.origin) + '</span></td>' +
        '<td data-label="Descripción"><input class="vm-desc" data-variable="' + escapeHTML(row.label) + '" value="' + escapeHTML(row.description) + '" placeholder="Ej.: Motor principal" /></td>' +
        '<td data-label="Valor"><span>' + escapeHTML(row.value) + '</span></td>' +
        '<td data-label="Pin">' + (row.physical ? '<select class="vm-pin ' + (state.errors.length ? 'invalid' : '') + '" data-group="' + row.group + '" data-variable="' + escapeHTML(row.label) + '">' + pinOptions(row, profile, current) + '</select>' : '<span class="vm-no-pin">No requerido</span>') + '</td>' +
        '<td data-label="Diagnóstico"><div class="vm-row-message ' + messageClass + '">' + escapeHTML(messages.length ? messages.join(' ') : (row.physical ? 'Correcto' : 'Variable interna')) + '</div></td>' +
      '</tr>';
    }).join('');
  }

  function bindModalEvents() {
    document.getElementById('vmClose').addEventListener('click', function () { close(false); });
    modal.addEventListener('click', function (event) { if (event.target === modal) close(false); });
    document.getElementById('vmBoard').addEventListener('change', function (event) {
      currentBoard = event.target.value;
      try { localStorage.setItem(BOARD_KEY, currentBoard); } catch (_) {}
      if (!workingMaps[currentBoard]) workingMaps[currentBoard] = emptyMap();
      autoAssign(currentBoard, false);
      renderTable();
    });
    document.getElementById('vmSearch').addEventListener('input', function (event) { currentSearch = event.target.value || ''; renderTable(); });
    document.getElementById('vmFilters').addEventListener('click', function (event) {
      const button = event.target.closest('[data-filter]');
      if (button) setFilter(button.dataset.filter);
    });
    document.getElementById('vmBody').addEventListener('input', function (event) {
      const input = event.target.closest('.vm-desc');
      if (!input) return;
      const label = upper(input.dataset.variable);
      if (!workingMeta.variables[label]) workingMeta.variables[label] = {};
      workingMeta.variables[label].description = input.value;
      const row = currentRows.find(function (item) { return item.label === label; });
      if (row) row.description = input.value;
      dirty = true;
    });
    document.getElementById('vmBody').addEventListener('change', function (event) {
      const select = event.target.closest('.vm-pin');
      if (!select) return;
      const group = select.dataset.group;
      const label = upper(select.dataset.variable);
      const raw = select.value;
      mapForBoard(currentBoard)[group][label] = raw === '' ? UNASSIGNED : (/^-?\d+$/.test(raw) ? Number(raw) : raw);
      dirty = true;
      renderTable();
    });
    document.getElementById('vmAuto').addEventListener('click', function () { autoAssign(currentBoard, true); renderTable(); showToast('Pines autoasignados para ' + getProfile(currentBoard).name); });
    document.getElementById('vmValidate').addEventListener('click', function () { renderTable(); showToast(lastValidation && lastValidation.ok ? 'Asignación válida' : 'Hay errores por corregir'); });
    document.getElementById('vmReset').addEventListener('click', function () {
      if (!confirm('¿Restablecer la asignación de pines para ' + getProfile(currentBoard).name + '?')) return;
      workingMaps[currentBoard] = emptyMap();
      autoAssign(currentBoard, false);
      renderTable();
      showToast('Asignación restablecida');
    });
    document.getElementById('vmCSV').addEventListener('click', exportCSV);
    document.getElementById('vmSave').addEventListener('click', function () {
      persistWorkingState();
      renderTable();
      showToast(lastValidation && lastValidation.ok ? 'Variables y pines guardados' : 'Guardado; aún hay errores por corregir');
    });
    document.getElementById('vmOpenCode').addEventListener('click', function () {
      persistWorkingState();
      renderTable();
      if (!lastValidation || !lastValidation.ok) { showToast('Corrige los errores antes de generar código'); return; }
      close(true);
      const button = document.getElementById('btnArduino');
      if (button) button.click();
    });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && modal && modal.style.display === 'flex') close(false); });
  }

  function csvCell(value) {
    const text = safeText(value).replace(/"/g, '""');
    return '"' + text + '"';
  }

  function exportCSV() {
    const validation = validateRows(currentBoard);
    const profile = getProfile(currentBoard);
    const map = mapForBoard(currentBoard);
    const lines = [['Variable','Tipo','Editor','Descripción','Valor','Placa','Pin','Estado','Diagnóstico'].map(csvCell).join(',')];
    currentRows.forEach(function (row) {
      const state = validation.states[row.label];
      const pin = row.physical ? pinDisplay(map[row.group][row.label], profile, row.group) : 'No requerido';
      lines.push([
        row.label, row.typeTitle, row.origin, row.description, row.value, profile.name, pin,
        state.status, state.errors.concat(state.warnings).join(' ')
      ].map(csvCell).join(','));
    });
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'simuplc_variables_' + currentBoard + '.csv';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(anchor.href); anchor.remove(); }, 0);
  }

  async function refresh() {
    currentRows = await collectVariables();
    autoAssign(currentBoard, false);
    const boardSelect = document.getElementById('vmBoard');
    if (boardSelect) { boardSelect.innerHTML = boardOptions(); boardSelect.value = currentBoard; }
    renderTable();
    return clone(currentRows);
  }

  async function open() {
    ensureStyles();
    ensureModal();
    loadWorkingState();
    currentFilter = 'all';
    currentSearch = '';
    const search = document.getElementById('vmSearch');
    if (search) search.value = '';
    document.querySelectorAll('#vmFilters .vm-filter').forEach(function (button) { button.classList.toggle('active', button.dataset.filter === 'all'); });
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    const message = document.getElementById('vmMessage');
    if (message) { message.className = 'vm-message ok'; message.textContent = 'Leyendo variables de FBD y Ladder...'; }
    await refresh();
  }

  async function ensureDefaults(boardId) {
    loadWorkingState();
    if (boardId && getProfiles()[boardId]) currentBoard = boardId;
    currentRows = await collectVariables();
    autoAssign(currentBoard, false);
    persistWorkingState();
    return {
      board: currentBoard,
      rows: clone(currentRows),
      validation: clone(validateRows(currentBoard)),
      pinMap: clone(mapForBoard(currentBoard))
    };
  }

  function exportConfig() {
    return {
      type: 'simuplc-hardware-config',
      version: 1,
      appVersion: VERSION,
      selectedBoard: currentBoard || (function () { try { return localStorage.getItem(BOARD_KEY) || 'uno'; } catch (_) { return 'uno'; } })(),
      pinMaps: normalizeAllMaps(loadJSON(PINMAP_KEY, workingMaps || {})),
      metadata: loadJSON(META_KEY, workingMeta || { variables: {} })
    };
  }

  function importConfig(config) {
    if (!config || typeof config !== 'object') return false;
    const pinMaps = config.pinMaps || config.maps || config.pinAssignments;
    const metadata = config.metadata || config.variablesMeta || config.catalog;
    if (pinMaps && typeof pinMaps === 'object') saveJSON(PINMAP_KEY, normalizeAllMaps(pinMaps));
    if (metadata && typeof metadata === 'object') saveJSON(META_KEY, metadata);
    if (config.selectedBoard && getProfiles()[config.selectedBoard]) {
      try { localStorage.setItem(BOARD_KEY, config.selectedBoard); } catch (_) {}
    }
    if (modal && modal.style.display === 'flex') { loadWorkingState(); refresh(); }
    return true;
  }

  function init() {
    ensureStyles();
    ensureButton();
    setTimeout(ensureButton, 120);
    setTimeout(ensureButton, 600);
  }

  global.SimuPLCVariableManager = Object.freeze({
    version: VERSION,
    open: open,
    close: function () { close(false); },
    refresh: refresh,
    collectVariables: async function () { loadWorkingState(); return collectVariables(); },
    ensureDefaults: ensureDefaults,
    validate: async function (boardId) {
      loadWorkingState();
      currentBoard = boardId && getProfiles()[boardId] ? boardId : currentBoard;
      currentRows = await collectVariables();
      autoAssign(currentBoard, false);
      return clone(validateRows(currentBoard));
    },
    exportConfig: exportConfig,
    importConfig: importConfig,
    getMetadata: function () { return loadJSON(META_KEY, { variables: {} }); },
    getPinMaps: function () { return normalizeAllMaps(loadJSON(PINMAP_KEY, {})); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
