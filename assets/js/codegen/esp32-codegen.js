(function (global) {
  'use strict';

  if (global.SimuPLCESP32Codegen) return;

  const VERSION = '1.7.0-split-range-v10';
  const BOARD_KEY = 'logicsoft_arduino_board_v1';
  const PINMAP_KEY = 'simuplc_esp32_pinmap_v1';
  const BOARD_ID = 'esp32';

  const BOARD = Object.freeze({
    id: BOARD_ID,
    name: 'ESP32 DevKit V1 / WROOM-32',
    validPins: Object.freeze([0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39]),
    digitalInputPins: Object.freeze([13, 14, 27, 26, 25, 32, 33, 4, 16, 17, 18, 19, 21, 22, 23]),
    analogInputPins: Object.freeze([36, 39, 34, 35, 32, 33]),
    outputPins: Object.freeze([23, 22, 21, 19, 18, 17, 16, 25, 26, 27, 32, 33, 13, 14, 4]),
    inputOnlyPins: Object.freeze([34, 35, 36, 39]),
    strappingPins: Object.freeze([0, 2, 5, 12, 15]),
    serialPins: Object.freeze([1, 3]),
    flashPins: Object.freeze([6, 7, 8, 9, 10, 11]),
    adcBits: 12,
    adcRawMax: 4095
  });

  const ANALOG_TYPES = new Set(['analog_constant', 'analog_input', 'scale', 'pid', 'split_range']);
  const COMPARATOR_TYPES = new Set(['gt', 'lt', 'eq', 'gte', 'lte', 'hyst']);
  const STATEFUL_FBD = new Set(['sr', 'ton', 'toff', 'cnt', 'hyst']);

  const diagnostics = {
    version: VERSION,
    generated: 0,
    fbdGenerated: 0,
    ladderGenerated: 0,
    uiEnhancements: 0,
    validationRuns: 0,
    lastEditor: null,
    lastError: null
  };

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
  }

  function num(value, fallback) {
    const parsed = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function integer(value, fallback, min, max) {
    let parsed = Math.round(num(value, fallback));
    if (Number.isFinite(min)) parsed = Math.max(min, parsed);
    if (Number.isFinite(max)) parsed = Math.min(max, parsed);
    return parsed;
  }

  function boolValue(value, fallback) {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    return !!fallback;
  }

  function cleanType(value) {
    return String(value || '').trim().toLowerCase();
  }

  function safeName(value, fallback) {
    let output = String(value == null ? '' : value).trim();
    output = output.normalize ? output.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : output;
    output = output.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_');
    if (!output) output = fallback || 'X';
    if (/^[0-9]/.test(output)) output = '_' + output;
    return output;
  }

  function cFloat(value, fallback) {
    const result = num(value, fallback == null ? 0 : fallback);
    if (!Number.isFinite(result)) return '0.0f';
    let text = String(Math.round(result * 1000000) / 1000000);
    if (!/[.eE]/.test(text)) text += '.0';
    return text + 'f';
  }

  function cppArray(values, fallback, formatter) {
    const list = Array.isArray(values) && values.length ? values : [fallback];
    return list.map(formatter || String).join(', ');
  }

  function cString(value) {
    return '"' + String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function generatedControlMode() {
    try {
      const mode = String(localStorage.getItem('simuplc_global_control_mode_v21') || 'both').toLowerCase();
      return mode === 'hmi' ? 1 : mode === 'physical' ? 2 : 0;
    } catch (_) { return 0; }
  }

  function likelyNcInput(label, source) {
    const text = String(label || '') + ' ' + String(source && (source.label || source.name || source.description || '') || '');
    const mode = String(source && (source.contactType || source.inputMode || source.mode || source.params && source.params.inputMode) || '').toLowerCase();
    return mode === 'nc' || /(?:^|[-_ ])nc(?:$|[-_ ])|STOP|PARADA|EMERGENCIA|E-?STOP|GUARDAMOTOR|PROTECCI(?:O|Ó)N|T[EÉ]RMICO|SOBRECARGA/i.test(text);
  }

  function pinLabel(pin) {
    return 'GPIO ' + pin;
  }

  function activeEditor() {
    try {
      if (global.SimuPLCEditors && typeof global.SimuPLCEditors.activeEditor === 'function') {
        return global.SimuPLCEditors.activeEditor();
      }
    } catch (_) {}
    return document.body && document.body.classList.contains('mode-ladder') ? 'ladder' : 'fbd';
  }

  function selectedBoard() {
    const select = document.getElementById('arduinoBoardSelect');
    if (select && select.value) return select.value;
    try { return localStorage.getItem(BOARD_KEY) || 'uno'; }
    catch (_) { return 'uno'; }
  }

  function isESP32Selected() {
    return selectedBoard() === BOARD_ID;
  }

  function getOutputActiveLow(label) {
    try {
      if (typeof global.isArduinoOutputActiveLowForLabel === 'function') return !!global.isArduinoOutputActiveLowForLabel(label);
      if (typeof global.isArduinoOutputActiveLow === 'function') return !!global.isArduinoOutputActiveLow();
    } catch (_) {}
    return true;
  }

  function loadPinMap() {
    try {
      const raw = localStorage.getItem(PINMAP_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        parsed.digitalInputs = parsed.digitalInputs && typeof parsed.digitalInputs === 'object' ? parsed.digitalInputs : {};
        parsed.analogInputs = parsed.analogInputs && typeof parsed.analogInputs === 'object' ? parsed.analogInputs : {};
        parsed.outputs = parsed.outputs && typeof parsed.outputs === 'object' ? parsed.outputs : {};
        parsed.pwmOutputs = parsed.pwmOutputs && typeof parsed.pwmOutputs === 'object' ? parsed.pwmOutputs : {};
        parsed.analogOutputs = parsed.analogOutputs && typeof parsed.analogOutputs === 'object' ? parsed.analogOutputs : {};
        return parsed;
      }
    } catch (_) {}
    return { digitalInputs: {}, analogInputs: {}, outputs: {}, pwmOutputs: {}, analogOutputs: {} };
  }

  function savePinMap(map) {
    try { localStorage.setItem(PINMAP_KEY, JSON.stringify(map || { digitalInputs: {}, analogInputs: {}, outputs: {}, pwmOutputs: {}, analogOutputs: {} })); }
    catch (_) {}
  }

  function sortPLC(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    const lPrefix = left.charAt(0).toUpperCase();
    const rPrefix = right.charAt(0).toUpperCase();
    const lMatch = left.match(/\d+/);
    const rMatch = right.match(/\d+/);
    const lNumber = lMatch ? parseInt(lMatch[0], 10) : 99999;
    const rNumber = rMatch ? parseInt(rMatch[0], 10) : 99999;
    return lPrefix.localeCompare(rPrefix) || lNumber - rNumber || left.localeCompare(right);
  }

  function uniqueSorted(values) {
    return Array.from(new Set((values || []).filter(Boolean).map(String))).sort(sortPLC);
  }

  function defaultAssign(labels, candidates, used) {
    const result = {};
    let cursor = 0;
    labels.forEach(function (label) {
      while (cursor < candidates.length && used.has(candidates[cursor])) cursor += 1;
      let pin = candidates[cursor];
      if (pin == null) {
        pin = candidates.find(function (candidate) { return !used.has(candidate); });
      }
      if (pin == null) pin = candidates[labels.indexOf(label) % Math.max(1, candidates.length)] || 0;
      result[label] = pin;
      used.add(pin);
      cursor += 1;
    });
    return result;
  }

  function normalizePinMap(signals, existing, forceDefaults) {
    const used = new Set();
    const output = { digitalInputs: {}, analogInputs: {}, outputs: {}, pwmOutputs: {}, analogOutputs: {} };
    const groups = [
      ['digitalInputs', signals.digitalInputs, BOARD.digitalInputPins],
      ['analogInputs', signals.analogInputs, BOARD.analogInputPins],
      ['outputs', signals.outputs, BOARD.outputPins]
    ];

    groups.forEach(function (entry) {
      const key = entry[0];
      const labels = entry[1];
      const candidates = entry[2];
      const defaults = defaultAssign(labels, candidates, used);
      labels.forEach(function (label) {
        const current = existing && existing[key] ? parseInt(existing[key][label], 10) : NaN;
        const allowed = candidates.indexOf(current) >= 0;
        const pin = !forceDefaults && allowed && !used.has(current) ? current : defaults[label];
        output[key][label] = pin;
        used.add(pin);
      });
    });
    return output;
  }

  function validatePinMap(signals, map) {
    diagnostics.validationRuns += 1;
    const warnings = [];
    const errors = [];
    const used = new Map();

    function register(label, pin, group) {
      const parsed = parseInt(pin, 10);
      if (!BOARD.validPins.includes(parsed)) errors.push(label + ': GPIO no válido para ESP32 clásico.');
      if (!used.has(parsed)) used.set(parsed, []);
      used.get(parsed).push(label);
      if (group === 'analogInputs' && !BOARD.analogInputPins.includes(parsed)) {
        errors.push(label + ': usa un GPIO ADC1 (' + BOARD.analogInputPins.join(', ') + ').');
      }
      if (group === 'digitalInputs' && BOARD.inputOnlyPins.includes(parsed)) {
        errors.push(label + ': GPIO ' + parsed + ' no tiene pull-up interno; usa otro pin para INPUT_PULLUP.');
      }
      if (group === 'outputs' && BOARD.inputOnlyPins.includes(parsed)) {
        errors.push(label + ': GPIO ' + parsed + ' es solo entrada.');
      }
      if (BOARD.strappingPins.includes(parsed)) warnings.push(label + ': GPIO ' + parsed + ' es pin de arranque; úsalo con cuidado.');
      if (BOARD.serialPins.includes(parsed)) warnings.push(label + ': GPIO ' + parsed + ' se usa normalmente para Serial.');
    }

    ['digitalInputs', 'analogInputs', 'outputs'].forEach(function (group) {
      (signals[group] || []).forEach(function (label) { register(label, map[group] && map[group][label], group); });
    });
    used.forEach(function (labels, pin) {
      if (labels.length > 1) errors.push('GPIO ' + pin + ' está repetido: ' + labels.join(', ') + '.');
    });

    return { ok: errors.length === 0, errors: uniqueSorted(errors), warnings: uniqueSorted(warnings) };
  }

  function fbdAnalogParams(node) {
    return Object.assign({}, node && node.params && node.params.analog || {}, node && node.analog || {});
  }

  function collectFBDSignals(state) {
    const nodes = state && Array.isArray(state.nodes) ? state.nodes : [];
    return {
      digitalInputs: uniqueSorted(nodes.filter(function (node) { return cleanType(node.type) === 'input'; }).map(function (node, index) { return node.name || ('I' + (index + 1)); })),
      analogInputs: uniqueSorted(nodes.filter(function (node) { return cleanType(node.type) === 'analog_input'; }).map(function (node, index) { return node.name || ('AI' + (index + 1)); })),
      outputs: uniqueSorted(nodes.filter(function (node) { return cleanType(node.type) === 'output'; }).map(function (node, index) { return node.name || ('Q' + (index + 1)); })),
      pwmOutputs: uniqueSorted(nodes.filter(function (node) { return cleanType(node.type) === 'pwm_output'; }).map(function (node, index) { return node.name || ('PWM' + (index + 1)); })),
      analogOutputs: uniqueSorted(nodes.filter(function (node) { return cleanType(node.type) === 'analog_output'; }).map(function (node, index) { return node.name || ('AO' + (index + 1)); }))
    };
  }

  function flattenLadderElements(model) {
    const output = [];
    function walk(list) {
      (list || []).forEach(function (element) {
        if (!element) return;
        output.push(element);
        if (String(element.type || '').toUpperCase() === 'BRANCH') {
          (element.branches || []).forEach(walk);
        }
      });
    }
    (model && model.rungs || []).forEach(function (rung) { walk(rung.elements || []); });
    return output;
  }

  function collectLadderSignals(model) {
    const elements = flattenLadderElements(model);
    const digitalInputs = [];
    const analogInputs = [];
    const outputs = [];
    const pwmOutputs = [];
    const analogOutputs = [];
    elements.forEach(function (element) {
      const type = cleanType(element.type);
      const label = String(element.label || '').trim();
      if (type === 'analog_input') analogInputs.push(label || ('AI' + (analogInputs.length + 1)));
      if ((type === 'no' || type === 'nc') && /^I\d+/i.test(label)) digitalInputs.push(label);
      if ((type === 'coil' || type === 'set' || type === 'reset') && /^Q\d+/i.test(label)) outputs.push(label);
      if (type === 'pwm_output') pwmOutputs.push(label || ('PWM' + (pwmOutputs.length + 1)));
      if (type === 'analog_output') analogOutputs.push(label || ('AO' + (analogOutputs.length + 1)));
    });
    return { digitalInputs: uniqueSorted(digitalInputs), analogInputs: uniqueSorted(analogInputs), outputs: uniqueSorted(outputs), pwmOutputs: uniqueSorted(pwmOutputs), analogOutputs: uniqueSorted(analogOutputs) };
  }

  async function currentStateAndSignals() {
    const editor = activeEditor();
    if (editor === 'ladder') {
      const model = global.SimuPLCEditors && typeof global.SimuPLCEditors.getLadderState === 'function'
        ? await global.SimuPLCEditors.getLadderState()
        : null;
      return { editor: editor, state: model || { rungs: [], proWires: [] }, signals: collectLadderSignals(model || {}) };
    }
    const state = global.SimuPLCEditors && typeof global.SimuPLCEditors.getFBDState === 'function'
      ? global.SimuPLCEditors.getFBDState()
      : (typeof global.serializeFBD === 'function' ? global.serializeFBD() : { nodes: [], connections: [] });
    return { editor: editor, state: state, signals: collectFBDSignals(state) };
  }

  function fbdTypeId(type) {
    switch (cleanType(type)) {
      case 'input': return 1;
      case 'output': return 2;
      case 'm': return 3;
      case 'and': return 10;
      case 'or': return 11;
      case 'not': return 12;
      case 'nand': return 13;
      case 'nor': return 14;
      case 'xor': return 15;
      case 'xnor': return 16;
      case 'sr': return 20;
      case 'ton': return 21;
      case 'toff': return 22;
      case 'cnt': return 30;
      case 'analog_input': return 40;
      case 'analog_constant': return 50;
      case 'scale': return 41;
      case 'gt': return 42;
      case 'lt': return 43;
      case 'eq': return 44;
      case 'gte': return 45;
      case 'lte': return 46;
      case 'hyst': return 47;
      case 'pwm_output': return 48;
      case 'pid': return 51;
      case 'split_range': return 52;
      case 'analog_output': return 49;
      default: return 0;
    }
  }

  function generateFBDESP32(state, pinMap) {
    const nodes = state && Array.isArray(state.nodes) ? state.nodes : [];
    const connections = state && Array.isArray(state.connections) ? state.connections : [];
    if (!nodes.length) return '// No hay bloques FBD para generar.';

    const byId = new Map();
    nodes.forEach(function (node, index) { byId.set(String(node.id), { node: node, index: index }); });

    const digitalInputs = nodes.filter(function (node) { return cleanType(node.type) === 'input'; });
    const analogInputs = nodes.filter(function (node) { return cleanType(node.type) === 'analog_input'; });
    const outputs = nodes.filter(function (node) { return cleanType(node.type) === 'output'; });
    const pwmOutputs = nodes.filter(function (node) { return cleanType(node.type) === 'pwm_output'; });
    const analogOutputs = nodes.filter(function (node) { return cleanType(node.type) === 'analog_output'; });
    const pidNodes = nodes.filter(function (node) { return cleanType(node.type) === 'pid'; });
    const digitalInputLabels = digitalInputs.map(function (node, index) { return String(node.name || ('I' + (index + 1))); });
    const analogInputLabels = analogInputs.map(function (node, index) { return String(node.name || ('AI' + (index + 1))); });
    const outputLabels = outputs.map(function (node, index) { return String(node.name || ('Q' + (index + 1))); });
    const pwmOutputLabels = pwmOutputs.map(function (node, index) { return String(node.name || ('PWM' + (index + 1))); });
    const analogOutputLabels = analogOutputs.map(function (node, index) { return String(node.name || ('AO' + (index + 1))); });
    const pidLabels = pidNodes.map(function (node, index) { return String(node.name || ('PID' + (index + 1))); });
    const pidNodeIndices = pidNodes.map(function (node) { return nodes.indexOf(node); });
    const digitalInputNcFlags = digitalInputs.map(function (node, index) { return likelyNcInput(digitalInputLabels[index], node); });
    const digitalInputIndex = new Map();
    const analogInputIndex = new Map();
    const outputIndex = new Map();
    const pwmOutputIndex = new Map();
    const analogOutputIndex = new Map();
    digitalInputs.forEach(function (node, index) { digitalInputIndex.set(String(node.id), index); });
    analogInputs.forEach(function (node, index) { analogInputIndex.set(String(node.id), index); });
    outputs.forEach(function (node, index) { outputIndex.set(String(node.id), index); });
    pwmOutputs.forEach(function (node, index) { pwmOutputIndex.set(String(node.id), index); });
    analogOutputs.forEach(function (node, index) { analogOutputIndex.set(String(node.id), index); });

    const typeIds = [];
    const pinCounts = [];
    const digitalIndices = [];
    const analogIndices = [];
    const outputIndices = [];
    const pwmOutputIndices = [];
    const analogOutputIndices = [];
    const p1 = [], p2 = [], p3 = [], p4 = [], p5 = [];
    const clampFlags = [];
    const pidSample=[], pidManual=[], pidFlags=[];
    const nodeComments = [];

    nodes.forEach(function (node, index) {
      const type = cleanType(node.type);
      const analog = fbdAnalogParams(node);
      const reference = String(node.reference || node.params && (node.params.reference || node.params.ioLabel) || '').trim();
      typeIds.push(fbdTypeId(type));
      pinCounts.push(Array.isArray(node.inputsNot) ? node.inputsNot.length : (type === 'sr' ? 2 : type === 'pid' ? 2 : type === 'cnt' ? 3 : (type === 'input' || type === 'analog_input' || type === 'analog_constant' ? 0 : 1)));
      digitalIndices.push(type === 'input' ? digitalInputIndex.get(String(node.id)) : 255);
      analogIndices.push(type === 'analog_input' ? analogInputIndex.get(String(node.id)) : 255);
      outputIndices.push(type === 'output' ? outputIndex.get(String(node.id)) : 255);
      pwmOutputIndices.push(type === 'pwm_output' ? pwmOutputIndex.get(String(node.id)) : 255);
      analogOutputIndices.push(type === 'analog_output' ? analogOutputIndex.get(String(node.id)) : 255);
      let a = 0, b = 0, c = 0, d = 0, e = 0, clampFlag = 0;
      if (type === 'analog_constant') {
        a = num(analog.value !== undefined ? analog.value : node.constantValue, 50);
      } else if (type === 'analog_input') {
        a = num(analog.rawMin, 0); b = num(analog.rawMax, 4095);
        c = num(analog.engMin, 0); d = num(analog.engMax, 100);
        clampFlag = analog.clamp !== false ? 1 : 0;
      } else if (type === 'scale') {
        a = num(analog.inMin, 0); b = num(analog.inMax, 100);
        c = num(analog.outMin, 0); d = num(analog.outMax, 100);
        clampFlag = analog.clamp !== false ? 1 : 0;
      } else if (type === 'hyst') {
        a = num(analog.low, 40); b = num(analog.high, 60);
      } else if (COMPARATOR_TYPES.has(type)) {
        a = num(analog.threshold, 50); b = num(analog.tolerance, 0.1);
      } else if(type==='pid'){
        a=num(analog.kp!==undefined?analog.kp:node.kp,2);
        b=num(analog.ki!==undefined?analog.ki:node.ki,0.5);
        c=num(analog.kd!==undefined?analog.kd:node.kd,0.1);
        d=num(analog.outMin!==undefined?analog.outMin:node.outMin,0);
        e=num(analog.outMax!==undefined?analog.outMax:node.outMax,100);
      } else if (type === 'split_range') {
        a=num(analog.inMin!==undefined?analog.inMin:node.inMin,0);b=num(analog.inMax!==undefined?analog.inMax:node.inMax,100);c=num(analog.neutral!==undefined?analog.neutral:node.neutral,50);d=Math.max(0,num(analog.deadband!==undefined?analog.deadband:node.deadband,2));e=Math.max(0,num(analog.outMax!==undefined?analog.outMax:node.outMax,100));clampFlag=analog.clamp!==false?1:0;
      } else if (type === 'pwm_output') {
        a = num(analog.inMin, 0); b = num(analog.inMax, 100); c = num(analog.frequency, 1000); d = integer(analog.resolution, 8, 1, 16); clampFlag = analog.clamp !== false ? 1 : 0;
      } else if (type === 'analog_output') {
        a = num(analog.inMin, 0); b = num(analog.inMax, 100); c = num(analog.voltageMin, 0); d = num(analog.voltageMax, 3.3); clampFlag = analog.clamp !== false ? 1 : 0;
      } else if (type === 'ton' || type === 'toff') {
        a = num(node.params && node.params.delayMs, 1000);
      } else if (type === 'cnt') {
        a = num(node.params && node.params.cntOn, 1); b = num(node.params && node.params.cntOff, 0);
      }
      p1.push(a);p2.push(b);p3.push(c);p4.push(d);p5.push(e);clampFlags.push(clampFlag);pidSample.push(type==='pid'?Math.max(20,integer(analog.sampleMs!==undefined?analog.sampleMs:node.sampleMs,100)):0);pidManual.push(type==='pid'?num(analog.manualOutput!==undefined?analog.manualOutput:node.manualOutput,0):0);pidFlags.push(type==='pid'?((String(analog.mode||node.mode)==='manual'?1:0)|(String(analog.direction||node.direction)==='cooling'?2:0)):0);
      nodeComments.push('// [' + index + '] ' + (node.name || node.code || node.type || 'Bloque') + (reference ? ' - ' + reference : ''));
    });

    const connSrc = [], connSrcPin = [], connDst = [], connPin = [], connInv = [], connSignal = [];
    connections.forEach(function (connection) {
      const source = byId.get(String(connection.fromId));
      const target = byId.get(String(connection.toId));
      if (!source || !target) return;
      const pin = Math.max(0, integer(connection.toPin, 1, 1, 255) - 1);
      const sourceType = cleanType(source.node.type);
      const inversion = Array.isArray(target.node.inputsNot) && target.node.inputsNot[pin] ? 1 : 0;
      connSrc.push(source.index);
      connSrcPin.push(Math.max(0,integer(String(connection.fromPin||'out1').replace(/\D/g,''),1,1,255)-1));
      connDst.push(target.index);
      connPin.push(pin);
      connInv.push(inversion);
      connSignal.push(ANALOG_TYPES.has(sourceType) ? 1 : 0);
    });

    const digitalPins = digitalInputLabels.map(function (label) { return pinMap.digitalInputs[label]; });
    const analogPins = analogInputLabels.map(function (label) { return pinMap.analogInputs[label]; });
    const outputPins = outputLabels.map(function (label) { return pinMap.outputs[label]; });
    const pwmPins = pwmOutputLabels.map(function (label) { return pinMap.pwmOutputs && pinMap.pwmOutputs[label]; });
    const analogOutputPins = analogOutputLabels.map(function (label) { return pinMap.analogOutputs && pinMap.analogOutputs[label]; });
    const activeLow = outputLabels.map(function (label) { return getOutputActiveLow(label); });

    const N = nodes.length;
    const K = connSrc.length;
    const SAFE_N = Math.max(1, N);
    const SAFE_K = Math.max(1, K);
    const SAFE_DI = Math.max(1, digitalPins.length);
    const SAFE_AI = Math.max(1, analogPins.length);
    const SAFE_Q = Math.max(1, outputPins.length);
    const SAFE_PWM = Math.max(1, pwmPins.length);
    const SAFE_AO = Math.max(1, analogOutputPins.length);
    const SAFE_PID = Math.max(1, pidNodes.length);
    const defaultControlMode = generatedControlMode();
    const lines = [];
    lines.push('/*');
    lines.push('  SimuPLC Lab ' + VERSION + ' - ESP32 desde FBD');
    lines.push('  Placa objetivo: ESP32 DevKit V1 / WROOM-32');
    lines.push('  Entradas digitales: INPUT_PULLUP (LOW = contacto cerrado a GND).');
    lines.push('  Entradas analogicas: ADC de 12 bits (0..4095).');
    lines.push('*/');
    lines.push('');
    lines.push('#if defined(ARDUINO_ARCH_ESP32)');
    lines.push('  #if __has_include(<esp_arduino_version.h>)');
    lines.push('    #include <esp_arduino_version.h>');
    lines.push('  #endif');
    lines.push('#endif');
    lines.push('#if defined(ARDUINO_ARCH_ESP32) && defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)');
    lines.push('  #define SIMUPLC_ESP_CORE3 1');
    lines.push('#else');
    lines.push('  #define SIMUPLC_ESP_CORE3 0');
    lines.push('#endif');
    lines.push('');
    lines.push(...nodeComments);
    lines.push('');
    lines.push('const bool INPUT_ACTIVE_LOW = true;');
    lines.push('const uint16_t SCAN_MS = 20;');
    lines.push('const uint16_t N_NODES = ' + N + ';');
    lines.push('const uint16_t N_CONNS = ' + K + ';');
    lines.push('const uint8_t N_DIGITAL_INPUTS = ' + digitalPins.length + ';');
    lines.push('const uint8_t N_ANALOG_INPUTS = ' + analogPins.length + ';');
    lines.push('const uint8_t N_OUTPUTS = ' + outputPins.length + ';');
    lines.push('const uint8_t N_PWM_OUTPUTS = ' + pwmPins.length + ';');
    lines.push('const uint8_t N_ANALOG_OUTPUTS = ' + analogOutputPins.length + ';');
    lines.push('const uint16_t SAFE_NODES = ' + SAFE_N + ';');
    lines.push('const uint16_t SAFE_CONNS = ' + SAFE_K + ';');
    lines.push('const uint8_t SAFE_DIGITAL_INPUTS = ' + SAFE_DI + ';');
    lines.push('const uint8_t SAFE_ANALOG_INPUTS = ' + SAFE_AI + ';');
    lines.push('const uint8_t SAFE_OUTPUTS = ' + SAFE_Q + ';');
    lines.push('const uint8_t SAFE_PWM_OUTPUTS = ' + SAFE_PWM + ';');
    lines.push('const uint8_t SAFE_ANALOG_OUTPUTS = ' + SAFE_AO + ';');
    lines.push('const uint8_t N_PID_NODES = ' + pidNodes.length + ';');
    lines.push('const uint8_t SAFE_PID_NODES = ' + SAFE_PID + ';');
    lines.push('const uint32_t SIMUPLC_SERIAL_BAUD = 115200UL;');
    lines.push('const uint16_t SIMUPLC_STATE_PERIOD_MS = 250;');
    lines.push('');
    lines.push('const uint8_t digitalInputPins[SAFE_DIGITAL_INPUTS] = { ' + cppArray(digitalPins, 13, String) + ' };');
    lines.push('const uint8_t analogInputPins[SAFE_ANALOG_INPUTS] = { ' + cppArray(analogPins, 36, String) + ' };');
    lines.push('const uint8_t outputPins[SAFE_OUTPUTS] = { ' + cppArray(outputPins, 23, String) + ' };');
    lines.push('const uint8_t pwmOutputPins[SAFE_PWM_OUTPUTS] = { ' + cppArray(pwmPins, 23, String) + ' };');
    lines.push('const uint8_t analogOutputPins[SAFE_ANALOG_OUTPUTS] = { ' + cppArray(analogOutputPins, 25, String) + ' };');
    lines.push('const bool outputActiveLow[SAFE_OUTPUTS] = { ' + cppArray(activeLow, false, function (value) { return value ? 'true' : 'false'; }) + ' };');
    lines.push('const bool digitalInputIsNc[SAFE_DIGITAL_INPUTS] = { ' + cppArray(digitalInputNcFlags, false, function (value) { return value ? 'true' : 'false'; }) + ' };');
    lines.push('const char* const digitalInputTags[SAFE_DIGITAL_INPUTS] = { ' + cppArray(digitalInputLabels, '', cString) + ' };');
    lines.push('const char* const analogInputTags[SAFE_ANALOG_INPUTS] = { ' + cppArray(analogInputLabels, '', cString) + ' };');
    lines.push('const char* const outputTags[SAFE_OUTPUTS] = { ' + cppArray(outputLabels, '', cString) + ' };');
    lines.push('const char* const pwmOutputTags[SAFE_PWM_OUTPUTS] = { ' + cppArray(pwmOutputLabels, '', cString) + ' };');
    lines.push('const char* const analogOutputTags[SAFE_ANALOG_OUTPUTS] = { ' + cppArray(analogOutputLabels, '', cString) + ' };');
    lines.push('const uint16_t pidNodeIndices[SAFE_PID_NODES] = { ' + cppArray(pidNodeIndices, 0, String) + ' };');
    lines.push('const char* const pidTags[SAFE_PID_NODES] = { ' + cppArray(pidLabels, '', cString) + ' };');
    lines.push('');
    lines.push('enum NodeType : uint8_t {');
    lines.push('  T_NONE=0,T_INPUT=1,T_OUTPUT=2,T_M=3,');
    lines.push('  T_AND=10,T_OR=11,T_NOT=12,T_NAND=13,T_NOR=14,T_XOR=15,T_XNOR=16,');
    lines.push('  T_SR=20,T_TON=21,T_TOFF=22,T_CNT=30,');
    lines.push('  T_AI=40,T_SCALE=41,T_GT=42,T_LT=43,T_EQ=44,T_GTE=45,T_LTE=46,T_HYST=47,T_PWM=48,T_AO=49,T_CONST=50,T_PID=51,T_SPLIT=52');
    lines.push('};');
    lines.push('');
    lines.push('const uint8_t nodeType[SAFE_NODES] = { ' + cppArray(typeIds, 0, String) + ' };');
    lines.push('const uint8_t nodePins[SAFE_NODES] = { ' + cppArray(pinCounts, 0, String) + ' };');
    lines.push('const uint8_t nodeDigitalInputIndex[SAFE_NODES] = { ' + cppArray(digitalIndices, 255, String) + ' };');
    lines.push('const uint8_t nodeAnalogInputIndex[SAFE_NODES] = { ' + cppArray(analogIndices, 255, String) + ' };');
    lines.push('const uint8_t nodeOutputIndex[SAFE_NODES] = { ' + cppArray(outputIndices, 255, String) + ' };');
    lines.push('const uint8_t nodePWMOutputIndex[SAFE_NODES] = { ' + cppArray(pwmOutputIndices, 255, String) + ' };');
    lines.push('const uint8_t nodeAnalogOutputIndex[SAFE_NODES] = { ' + cppArray(analogOutputIndices, 255, String) + ' };');
    lines.push('const float nodeP1[SAFE_NODES] = { ' + cppArray(p1, 0, function (value) { return cFloat(value); }) + ' };');
    lines.push('const float nodeP2[SAFE_NODES] = { ' + cppArray(p2, 0, function (value) { return cFloat(value); }) + ' };');
    lines.push('const float nodeP3[SAFE_NODES] = { ' + cppArray(p3, 0, function (value) { return cFloat(value); }) + ' };');
    lines.push('const float nodeP4[SAFE_NODES] = { ' + cppArray(p4,0,function(value){return cFloat(value);}) + ' };');
    lines.push('const float nodeP5[SAFE_NODES] = { ' + cppArray(p5,0,function(value){return cFloat(value);}) + ' };');
    lines.push('const uint32_t nodePidSample[SAFE_NODES] = { ' + cppArray(pidSample,0,String) + ' };');
    lines.push('const float nodePidManual[SAFE_NODES] = { ' + cppArray(pidManual,0,function(value){return cFloat(value);}) + ' };');
    lines.push('const uint8_t nodePidFlags[SAFE_NODES] = { ' + cppArray(pidFlags,0,String) + ' };');
    lines.push('const uint8_t nodeClamp[SAFE_NODES] = { ' + cppArray(clampFlags, 0, String) + ' };');
    lines.push('');
    lines.push('const uint16_t connSrc[SAFE_CONNS] = { ' + cppArray(connSrc, 0, String) + ' };');
    lines.push('const uint8_t connSrcPin[SAFE_CONNS] = { ' + cppArray(connSrcPin, 0, String) + ' }; // 0=salida principal/LLENAR, 1=VACIAR');
    lines.push('const uint16_t connDst[SAFE_CONNS] = { ' + cppArray(connDst, 0, String) + ' };');
    lines.push('const uint8_t connPin[SAFE_CONNS] = { ' + cppArray(connPin, 0, String) + ' };');
    lines.push('const uint8_t connInv[SAFE_CONNS] = { ' + cppArray(connInv, 0, String) + ' };');
    lines.push('const uint8_t connSignal[SAFE_CONNS] = { ' + cppArray(connSignal, 0, String) + ' }; // 0=digital,1=analogica');
    lines.push('');
    lines.push('bool bValue[SAFE_NODES] = {false};');
    lines.push('float aValue[SAFE_NODES] = {0};');
    lines.push('float splitFill[SAFE_NODES] = {0};');
    lines.push('float splitDrain[SAFE_NODES] = {0};');
    lines.push('int analogRaw[SAFE_NODES] = {0};');
    lines.push('bool srState[SAFE_NODES] = {false};');
    lines.push('bool hystState[SAFE_NODES] = {false};');
    lines.push('float pidIntegral[SAFE_NODES]={0}; float pidPrevError[SAFE_NODES]={0}; float pidOutput[SAFE_NODES]={0}; uint32_t pidLastAt[SAFE_NODES]={0};');
    lines.push('uint32_t tonStart[SAFE_NODES];');
    lines.push('uint32_t toffStart[SAFE_NODES];');
    lines.push('bool toffSeenHigh[SAFE_NODES] = {false};');
    lines.push('long counterValue[SAFE_NODES] = {0};');
    lines.push('bool counterPrev[SAFE_NODES] = {false};');
    lines.push('uint32_t lastScan = 0;');
    lines.push('enum SimuPLCControlMode : uint8_t { SIMUPLC_BOTH=0, SIMUPLC_HMI=1, SIMUPLC_PHYSICAL=2 };');
    lines.push('uint8_t simuplcControlMode = ' + defaultControlMode + ';');
    lines.push('bool simuplcRunning = true;');
    lines.push('bool simuplcProtocolActive = false;');
    lines.push('bool simuplcScanRequested = true;');
    lines.push('bool simuplcStateRequested = false;');
    lines.push('bool physicalDigitalInputs[SAFE_DIGITAL_INPUTS] = {false};');
    lines.push('bool hmiDigitalInputs[SAFE_DIGITAL_INPUTS] = {false};');
    lines.push('float physicalAnalogInputs[SAFE_ANALOG_INPUTS] = {0};');
    lines.push('float hmiAnalogInputs[SAFE_ANALOG_INPUTS] = {0};');
    lines.push('bool hmiAnalogValid[SAFE_ANALOG_INPUTS] = {false};');
    lines.push('char simuplcRxLine[128];');
    lines.push('uint8_t simuplcRxLength = 0;');
    lines.push('uint32_t simuplcLastStateAt = 0;');
    lines.push('');
    lines.push('float clampFloat(float value,float a,float b){ float lo=min(a,b),hi=max(a,b); return max(lo,min(hi,value)); }');
    lines.push('bool invalidFloat(float value){ return value != value; }');
    lines.push('float runPidNode(uint16_t n,float pv,float sp,uint32_t now){bool manual=nodePidFlags[n]&1,cooling=nodePidFlags[n]&2;if(manual){pidOutput[n]=clampFloat(nodePidManual[n],nodeP4[n],nodeP5[n]);return pidOutput[n];}uint32_t sample=max((uint32_t)20,nodePidSample[n]);if(pidLastAt[n]&&now-pidLastAt[n]<sample)return pidOutput[n];float dt=max((float)sample,(float)(pidLastAt[n]?now-pidLastAt[n]:sample))/1000.0f;float error=(sp-pv)*(cooling?-1.0f:1.0f);float derivative=(error-pidPrevError[n])/max(dt,0.001f);float candidate=pidIntegral[n]+error*dt;float raw=nodeP1[n]*error+nodeP2[n]*candidate+nodeP3[n]*derivative;float limited=clampFloat(raw,nodeP4[n],nodeP5[n]);if(raw==limited||((error>0)!=(raw-limited>0)))pidIntegral[n]=candidate;pidPrevError[n]=error;pidLastAt[n]=now;pidOutput[n]=limited;return limited;}');
    lines.push('float mapFloat(float value,float inMin,float inMax,float outMin,float outMax,bool limit){');
    lines.push('  if(inMax==inMin) return outMin;');
    lines.push('  if(limit) value=clampFloat(value,inMin,inMax);');
    lines.push('  return outMin + ((value-inMin)/(inMax-inMin))*(outMax-outMin);');
    lines.push('}');
    lines.push('');
    lines.push('void setupPWMOutput(uint8_t pin,uint8_t channel,uint32_t frequency,uint8_t resolution){');
    lines.push('#if defined(ARDUINO_ARCH_ESP32)');
    lines.push('  #if SIMUPLC_ESP_CORE3');
    lines.push('    ledcAttach(pin,frequency,resolution);');
    lines.push('  #else');
    lines.push('    ledcSetup(channel,frequency,resolution); ledcAttachPin(pin,channel);');
    lines.push('  #endif');
    lines.push('#else');
    lines.push('  (void)channel; (void)frequency; (void)resolution; pinMode(pin,OUTPUT);');
    lines.push('#endif');
    lines.push('}');
    lines.push('void writePWMOutput(uint8_t pin,uint8_t channel,float percent,uint8_t resolution){');
    lines.push('  percent=clampFloat(percent,0.0f,100.0f);');
    lines.push('#if defined(ARDUINO_ARCH_ESP32)');
    lines.push('  uint8_t bits=min((uint8_t)16,max((uint8_t)1,resolution)); uint32_t maxDuty=(1UL<<bits)-1UL; uint32_t duty=(uint32_t)roundf(percent*maxDuty/100.0f);');
    lines.push('  #if SIMUPLC_ESP_CORE3');
    lines.push('    ledcWrite(pin,duty);');
    lines.push('  #else');
    lines.push('    ledcWrite(channel,duty);');
    lines.push('  #endif');
    lines.push('#else');
    lines.push('  (void)channel; (void)resolution; analogWrite(pin,(int)roundf(percent*255.0f/100.0f));');
    lines.push('#endif');
    lines.push('}');
    lines.push('void writeAnalogOutput(uint8_t pin,float volts,float minV,float maxV){');
    lines.push('#if defined(ARDUINO_ARCH_ESP32)');
    lines.push('  float ratio=(volts-minV)/(maxV-minV==0?1:(maxV-minV)); ratio=clampFloat(ratio,0.0f,1.0f); dacWrite(pin,(uint8_t)roundf(ratio*255.0f));');
    lines.push('#else');
    lines.push('  (void)pin;(void)volts;(void)minV;(void)maxV;');
    lines.push('#endif');
    lines.push('}');
    lines.push('');
    lines.push('bool pinConnected(uint16_t node,uint8_t pin,uint8_t signal){');
    lines.push('  for(uint16_t k=0;k<N_CONNS;k++) if(connDst[k]==node && connPin[k]==pin && connSignal[k]==signal) return true;');
    lines.push('  return false;');
    lines.push('}');
    lines.push('bool readBoolPin(uint16_t node,uint8_t pin){');
    lines.push('  bool value=false;');
    lines.push('  for(uint16_t k=0;k<N_CONNS;k++){');
    lines.push('    if(connDst[k]!=node || connPin[k]!=pin || connSignal[k]!=0) continue;');
    lines.push('    bool part=bValue[connSrc[k]]; if(connInv[k]) part=!part; value=value||part;');
    lines.push('  }');
    lines.push('  return value;');
    lines.push('}');
    lines.push('float analogSourceValue(uint16_t source,uint8_t sourcePin){if(source>=N_NODES)return NAN;if(nodeType[source]==T_SPLIT)return sourcePin==1?splitDrain[source]:splitFill[source];return aValue[source];}');
    lines.push('float readAnalogPin(uint16_t node,uint8_t pin){');
    lines.push('  for(uint16_t k=0;k<N_CONNS;k++) if(connDst[k]==node && connPin[k]==pin && connSignal[k]==1) return analogSourceValue(connSrc[k],connSrcPin[k]);');
    lines.push('  return NAN;');
    lines.push('}');
    lines.push('int findTagIndex(const char* tag,const char* const* tags,uint8_t count){for(uint8_t i=0;i<count;i++)if(strcmp(tag,tags[i])==0)return i;return -1;}');
    lines.push('bool effectiveDigitalInput(uint8_t ix){if(ix>=N_DIGITAL_INPUTS)return false;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalDigitalInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):hmiDigitalInputs[ix];return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):(physicalDigitalInputs[ix]||hmiDigitalInputs[ix]);}');
    lines.push('float effectiveAnalogInput(uint8_t ix){if(ix>=N_ANALOG_INPUTS)return 0.0f;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalAnalogInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:0.0f;return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:physicalAnalogInputs[ix];}');
    lines.push('const char* simuplcModeName(){return simuplcControlMode==SIMUPLC_HMI?"HMI":(simuplcControlMode==SIMUPLC_PHYSICAL?"PHYSICAL":"BOTH");}');
    lines.push('');
    lines.push('void readHardwareInputs(){');
    lines.push('  for(uint16_t n=0;n<N_NODES;n++){');
    lines.push('    if(nodeType[n]==T_INPUT){ uint8_t ix=nodeDigitalInputIndex[n]; bool physical=(ix<N_DIGITAL_INPUTS)?(digitalRead(digitalInputPins[ix])==(INPUT_ACTIVE_LOW?LOW:HIGH)):false; if(ix<N_DIGITAL_INPUTS)physicalDigitalInputs[ix]=physical; bValue[n]=(ix<N_DIGITAL_INPUTS)?effectiveDigitalInput(ix):false; }');
    lines.push('    else if(nodeType[n]==T_CONST){ aValue[n]=nodeP1[n]; }');
    lines.push('    else if(nodeType[n]==T_AI){');
    lines.push('      uint8_t ix=nodeAnalogInputIndex[n]; int raw=(ix<N_ANALOG_INPUTS)?analogRead(analogInputPins[ix]):0; analogRaw[n]=raw;');
    lines.push('      float physical=mapFloat(raw,nodeP1[n],nodeP2[n],nodeP3[n],nodeP4[n],nodeClamp[n]); if(ix<N_ANALOG_INPUTS)physicalAnalogInputs[ix]=physical; aValue[n]=(ix<N_ANALOG_INPUTS)?effectiveAnalogInput(ix):physical;');
    lines.push('    }');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push('bool gateValue(uint8_t type,uint16_t node){');
    lines.push('  bool any=false,all=true; uint8_t connected=0,sum=0;');
    lines.push('  for(uint8_t p=0;p<nodePins[node];p++){ if(!pinConnected(node,p,0)) continue; bool v=readBoolPin(node,p); connected++; any=any||v; all=all&&v; if(v) sum++; }');
    lines.push('  if(type==T_NOT) return connected? !readBoolPin(node,0):true;');
    lines.push('  if(type==T_AND) return connected?all:true; if(type==T_OR) return any;');
    lines.push('  if(type==T_NAND) return !(connected?all:true); if(type==T_NOR) return !any;');
    lines.push('  if(type==T_XOR) return (sum%2)==1; if(type==T_XNOR) return (sum%2)==0; return any;');
    lines.push('}');
    lines.push('');
    lines.push('void propagateCombinational(){');
    lines.push('  for(uint8_t pass=0;pass<8;pass++){');
    lines.push('    bool changed=false;');
    lines.push('    for(uint16_t n=0;n<N_NODES;n++){');
    lines.push('      uint8_t t=nodeType[n]; if(t==T_INPUT||t==T_AI||t==T_CONST||t==T_SR||t==T_TON||t==T_TOFF||t==T_CNT||t==T_HYST||t==T_PID) continue;');
    lines.push('      bool oldB=bValue[n]; float oldA=aValue[n];');
    lines.push('      if(t==T_OUTPUT||t==T_M) bValue[n]=readBoolPin(n,0);');
    lines.push('      else if(t>=T_AND && t<=T_XNOR) bValue[n]=gateValue(t,n);');
    lines.push('      else if(t==T_SPLIT){float input=readAnalogPin(n,0);if(invalidFloat(input)){splitFill[n]=0.0f;splitDrain[n]=0.0f;aValue[n]=nodeP3[n];}else{if(nodeClamp[n])input=clampFloat(input,nodeP1[n],nodeP2[n]);float half=max(0.0f,nodeP4[n])*0.5f;float low=clampFloat(nodeP3[n]-half,nodeP1[n],nodeP2[n]);float high=clampFloat(nodeP3[n]+half,nodeP1[n],nodeP2[n]);float fill=0.0f,drain=0.0f;if(input>high&&nodeP2[n]>high)fill=mapFloat(input,high,nodeP2[n],0.0f,nodeP5[n],true);else if(input<low&&low>nodeP1[n])drain=mapFloat(input,low,nodeP1[n],0.0f,nodeP5[n],true);splitFill[n]=clampFloat(fill,0.0f,nodeP5[n]);splitDrain[n]=clampFloat(drain,0.0f,nodeP5[n]);if(splitFill[n]>0.0f)splitDrain[n]=0.0f;else if(splitDrain[n]>0.0f)splitFill[n]=0.0f;aValue[n]=input;}}');
    lines.push('      else if(t==T_SCALE){ float input=readAnalogPin(n,0); aValue[n]=invalidFloat(input)?nodeP3[n]:mapFloat(input,nodeP1[n],nodeP2[n],nodeP3[n],nodeP4[n],nodeClamp[n]); }');
    lines.push('      else if(t==T_PWM){ float input=readAnalogPin(n,0); aValue[n]=invalidFloat(input)?0.0f:mapFloat(input,nodeP1[n],nodeP2[n],0.0f,100.0f,nodeClamp[n]); }');
    lines.push('      else if(t==T_AO){ float input=readAnalogPin(n,0); aValue[n]=invalidFloat(input)?nodeP3[n]:mapFloat(input,nodeP1[n],nodeP2[n],nodeP3[n],nodeP4[n],nodeClamp[n]); }');
    lines.push('      else if(t>=T_GT && t<=T_LTE){ float input=readAnalogPin(n,0);');
    lines.push('        if(invalidFloat(input)) bValue[n]=false; else if(t==T_GT)bValue[n]=input>nodeP1[n]; else if(t==T_LT)bValue[n]=input<nodeP1[n]; else if(t==T_EQ)bValue[n]=fabs(input-nodeP1[n])<=fabs(nodeP2[n]); else if(t==T_GTE)bValue[n]=input>=nodeP1[n]; else bValue[n]=input<=nodeP1[n];');
    lines.push('      }');
    lines.push('      if(oldB!=bValue[n] || fabs(oldA-aValue[n])>0.0001f) changed=true;');
    lines.push('    }');
    lines.push('    if(!changed) break;');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push('void evaluateStateful(uint32_t now){');
    lines.push('  for(uint16_t n=0;n<N_NODES;n++){');
    lines.push('    uint8_t t=nodeType[n];');
    lines.push('    if(t==T_PID){float pv=readAnalogPin(n,0),sp=readAnalogPin(n,1);aValue[n]=(invalidFloat(pv)||invalidFloat(sp))?pidOutput[n]:runPidNode(n,pv,sp,now);}');
    lines.push('    else if(t==T_SR){ bool S=readBoolPin(n,0),R=readBoolPin(n,1); if(R)srState[n]=false; else if(S)srState[n]=true; bValue[n]=srState[n]; }');
    lines.push('    else if(t==T_TON){ bool input=readBoolPin(n,0); uint32_t delayMs=(uint32_t)max(0.0f,nodeP1[n]); if(input){ if(tonStart[n]==0xFFFFFFFFUL)tonStart[n]=now; bValue[n]=(uint32_t)(now-tonStart[n])>=delayMs; }else{ tonStart[n]=0xFFFFFFFFUL;bValue[n]=false; } }');
    lines.push('    else if(t==T_TOFF){ bool input=readBoolPin(n,0); uint32_t delayMs=(uint32_t)max(0.0f,nodeP1[n]); if(input){toffSeenHigh[n]=true;toffStart[n]=0xFFFFFFFFUL;bValue[n]=true;}else if(!toffSeenHigh[n])bValue[n]=false;else{if(toffStart[n]==0xFFFFFFFFUL)toffStart[n]=now;bValue[n]=(uint32_t)(now-toffStart[n])<delayMs;} }');
    lines.push('    else if(t==T_CNT){ bool reset=readBoolPin(n,0),pulse=readBoolPin(n,1),down=readBoolPin(n,2); if(reset){counterValue[n]=0;bValue[n]=false;counterPrev[n]=false;}else{if(pulse&&!counterPrev[n]){if(down){if(counterValue[n]>0)counterValue[n]--;}else counterValue[n]++;}counterPrev[n]=pulse;if(counterValue[n]>=(long)nodeP1[n])bValue[n]=true;else if(counterValue[n]<(long)nodeP2[n])bValue[n]=false;} }');
    lines.push('    else if(t==T_HYST){ float input=readAnalogPin(n,0); if(!invalidFloat(input)){if(input>=nodeP2[n])hystState[n]=true;else if(input<=nodeP1[n])hystState[n]=false;} bValue[n]=hystState[n]; }');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push('void writeHardwareOutputs(){');
    lines.push('  for(uint16_t n=0;n<N_NODES;n++) if(nodeType[n]==T_OUTPUT){ uint8_t ix=nodeOutputIndex[n]; if(ix<N_OUTPUTS) digitalWrite(outputPins[ix],bValue[n]?(outputActiveLow[ix]?LOW:HIGH):(outputActiveLow[ix]?HIGH:LOW)); }');
    lines.push('  for(uint16_t n=0;n<N_NODES;n++){ if(nodeType[n]==T_PWM){uint8_t ix=nodePWMOutputIndex[n];if(ix<N_PWM_OUTPUTS)writePWMOutput(pwmOutputPins[ix],ix,aValue[n],(uint8_t)nodeP4[n]);} else if(nodeType[n]==T_AO){uint8_t ix=nodeAnalogOutputIndex[n];if(ix<N_ANALOG_OUTPUTS)writeAnalogOutput(analogOutputPins[ix],aValue[n],nodeP3[n],nodeP4[n]);} }');
    lines.push('}');
    lines.push('void forceHardwareOutputsOff(){for(uint16_t n=0;n<N_NODES;n++){if(nodeType[n]==T_OUTPUT)bValue[n]=false;else if(nodeType[n]==T_PWM||nodeType[n]==T_AO)aValue[n]=0.0f;}writeHardwareOutputs();}');
    lines.push('void controllerScan(uint32_t now){readHardwareInputs();if(simuplcRunning){propagateCombinational();evaluateStateful(now);propagateCombinational();writeHardwareOutputs();}else forceHardwareOutputsOff();}');
    lines.push('');
    lines.push('void printBoolPair(const char* tag,bool value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value?1:0);}');
    lines.push('void printFloatPair(const char* tag,float value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value,3);}');
    lines.push('void sendSimuPLCState(){');
    lines.push('  Serial.print(F("STATE"));');
    lines.push('  for(uint8_t i=0;i<N_DIGITAL_INPUTS;i++){printBoolPair(digitalInputTags[i],effectiveDigitalInput(i));Serial.print(char(44));Serial.print(digitalInputTags[i]);Serial.print(F("_PHYSICAL,"));Serial.print(physicalDigitalInputs[i]?1:0);Serial.print(char(44));Serial.print(digitalInputTags[i]);Serial.print(F("_HMI,"));Serial.print(hmiDigitalInputs[i]?1:0);}');
    lines.push('  for(uint8_t i=0;i<N_ANALOG_INPUTS;i++){printFloatPair(analogInputTags[i],effectiveAnalogInput(i));Serial.print(char(44));Serial.print(analogInputTags[i]);Serial.print(F("_PHYSICAL,"));Serial.print(physicalAnalogInputs[i],3);Serial.print(char(44));Serial.print(analogInputTags[i]);Serial.print(F("_HMI,"));Serial.print(hmiAnalogInputs[i],3);}');
    lines.push('  for(uint16_t n=0;n<N_NODES;n++){if(nodeType[n]==T_OUTPUT){uint8_t ix=nodeOutputIndex[n];if(ix<N_OUTPUTS)printBoolPair(outputTags[ix],bValue[n]);}else if(nodeType[n]==T_PWM){uint8_t ix=nodePWMOutputIndex[n];if(ix<N_PWM_OUTPUTS)printFloatPair(pwmOutputTags[ix],aValue[n]);}else if(nodeType[n]==T_AO){uint8_t ix=nodeAnalogOutputIndex[n];if(ix<N_ANALOG_OUTPUTS)printFloatPair(analogOutputTags[ix],aValue[n]);}}');
    lines.push('  for(uint8_t i=0;i<N_PID_NODES;i++)printFloatPair(pidTags[i],aValue[pidNodeIndices[i]]);');
    lines.push('  Serial.print(F(",RUNNING,"));Serial.print(simuplcRunning?1:0);Serial.print(F(",CONTROL_MODE,"));Serial.println(simuplcModeName());');
    lines.push('  simuplcLastStateAt=millis();simuplcStateRequested=false;');
    lines.push('}');
    lines.push('void processSimuPLCCommand(char* line){');
    lines.push("  for(char* p=line;*p;p++)if(*p>='a'&&*p<='z')*p=(char)(*p-32);");
    lines.push('  char* save=nullptr;char* cmd=strtok_r(line,",",&save);if(!cmd)return;simuplcProtocolActive=true;');
    lines.push('  if(strcmp(cmd,"HELLO")==0){Serial.println(F("OK,SIMUPLC,READY_ANALOG_V1,1"));simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"PING")==0){Serial.println(F("PONG"));return;}');
    lines.push('  if(strcmp(cmd,"GET_STATE")==0){simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"RUN")==0){char* value=strtok_r(nullptr,",",&save);simuplcRunning=!(value&&strcmp(value,"0")==0);simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"STOP")==0){simuplcRunning=false;simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"MODE")==0){char* value=strtok_r(nullptr,",",&save);if(value){if(strcmp(value,"HMI")==0)simuplcControlMode=SIMUPLC_HMI;else if(strcmp(value,"PHYSICAL")==0||strcmp(value,"FISICO")==0)simuplcControlMode=SIMUPLC_PHYSICAL;else simuplcControlMode=SIMUPLC_BOTH;}simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"SET")==0||strcmp(cmd,"SETA")==0){char* tag=strtok_r(nullptr,",",&save);char* value=strtok_r(nullptr,",",&save);if(!tag||!value)return;int dix=findTagIndex(tag,digitalInputTags,N_DIGITAL_INPUTS);if(dix>=0){hmiDigitalInputs[dix]=atoi(value)!=0;simuplcScanRequested=true;simuplcStateRequested=true;return;}int aix=findTagIndex(tag,analogInputTags,N_ANALOG_INPUTS);if(aix>=0){hmiAnalogInputs[aix]=(float)atof(value);hmiAnalogValid[aix]=true;simuplcScanRequested=true;simuplcStateRequested=true;return;}Serial.println(F("ERROR,TAG_NO_ENCONTRADO"));return;}');
    lines.push('  if(strcmp(cmd,"RELEASE")==0){char* tag=strtok_r(nullptr,",",&save);if(tag){int aix=findTagIndex(tag,analogInputTags,N_ANALOG_INPUTS);if(aix>=0){hmiAnalogValid[aix]=false;simuplcScanRequested=true;simuplcStateRequested=true;return;}}return;}');
    lines.push('  Serial.println(F("ERROR,COMANDO_NO_RECONOCIDO"));');
    lines.push('}');
    lines.push("void pollSimuPLCSerial(){while(Serial.available()>0){char c=(char)Serial.read();if(c=='\\n'||c=='\\r'){if(simuplcRxLength){simuplcRxLine[simuplcRxLength]=0;processSimuPLCCommand(simuplcRxLine);simuplcRxLength=0;}}else if(c>=32&&c<=126){if(simuplcRxLength<sizeof(simuplcRxLine)-1)simuplcRxLine[simuplcRxLength++]=c;else simuplcRxLength=0;}}}");
    lines.push('');
    lines.push('void setup(){');
    lines.push('  Serial.begin(SIMUPLC_SERIAL_BAUD);');
    lines.push('  analogReadResolution(12);');
    lines.push('  for(uint8_t i=0;i<N_DIGITAL_INPUTS;i++) pinMode(digitalInputPins[i],INPUT_PULLUP);');
    lines.push('  for(uint8_t i=0;i<N_OUTPUTS;i++){ pinMode(outputPins[i],OUTPUT); digitalWrite(outputPins[i],outputActiveLow[i]?HIGH:LOW); }');
    lines.push('  for(uint16_t n=0;n<N_NODES;n++) if(nodeType[n]==T_PWM){uint8_t ix=nodePWMOutputIndex[n];if(ix<N_PWM_OUTPUTS)setupPWMOutput(pwmOutputPins[ix],ix,(uint32_t)nodeP3[n],(uint8_t)nodeP4[n]);}');
    lines.push('  for(uint16_t n=0;n<N_NODES;n++){tonStart[n]=0xFFFFFFFFUL;toffStart[n]=0xFFFFFFFFUL;}');
    lines.push('}');
    lines.push('');
    lines.push('void loop(){');
    lines.push('  pollSimuPLCSerial();');
    lines.push('  uint32_t now=millis();if(simuplcScanRequested||(uint32_t)(now-lastScan)>=SCAN_MS){simuplcScanRequested=false;lastScan=now;controllerScan(now);}');
    lines.push('  if(simuplcProtocolActive&&(simuplcStateRequested||(uint32_t)(now-simuplcLastStateAt)>=SIMUPLC_STATE_PERIOD_MS))sendSimuPLCState();');
    lines.push('}');
    return lines.join('\n');
  }

  function endpointParts(id) {
    const value = String(id || '');
    const index = value.lastIndexOf(':');
    return index < 0 ? { elementId: value, side: '' } : { elementId: value.slice(0, index), side: value.slice(index + 1) };
  }

  function isLeftRail(id) { return /^rail:left:/i.test(String(id || '')) || /^rail:\d+:left$/i.test(String(id || '')); }
  function isRightRail(id) { return /^rail:right:/i.test(String(id || '')) || /^rail:\d+:right$/i.test(String(id || '')); }
  function isJunction(id) { return /^junction:/i.test(String(id || '')); }

  function ladderWireType(wire, byId) {
    if (wire && wire.signalType === 'analog') return 'analog';
    const endpoints = [wire && wire.from, wire && wire.to];
    for (const endpoint of endpoints) {
      const parts = endpointParts(endpoint);
      const element = byId.get(parts.elementId);
      const type = cleanType(element && element.type);
      if (type === 'analog_constant' || type === 'analog_input' || type === 'scale' || type === 'pid' || type === 'split_range') return 'analog';
      if ((type === 'pwm_output' || type === 'analog_output') && parts.side === 'in') return 'analog';
      if (COMPARATOR_TYPES.has(type) && parts.side === 'in') return 'analog';
    }
    return 'digital';
  }

  function generateLadderESP32(model, pinMap) {
    const elements = flattenLadderElements(model);
    const wires = model && Array.isArray(model.proWires) ? model.proWires : [];
    if (!elements.length) return '// No hay elementos Ladder para generar.';
    if (!wires.length) return '// El proyecto Ladder no contiene el grafo proWires. Abre y vuelve a guardar el proyecto antes de generar ESP32.';

    const byId = new Map();
    elements.forEach(function (element) { if (element && element.id) byId.set(String(element.id), element); });
    const adjacency = new Map();
    function link(a, b, type) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push({ id: b, type: type });
    }
    wires.forEach(function (wire) {
      if (!wire || !wire.from || !wire.to) return;
      const type = ladderWireType(wire, byId);
      link(String(wire.from), String(wire.to), type);
      link(String(wire.to), String(wire.from), type);
    });

    function network(start, wantedType) {
      const output = new Set();
      const queue = [String(start)];
      while (queue.length) {
        const current = queue.shift();
        if (output.has(current)) continue;
        output.add(current);
        (adjacency.get(current) || []).forEach(function (edge) {
          if (edge.type === wantedType && !output.has(edge.id)) queue.push(edge.id);
        });
      }
      return output;
    }

    function pinId(element, side) { return String(element.id) + ':' + side; }
    const names = new Map();
    const usedNames = new Set();
    function variableFor(element, fallback) {
      if (names.has(element.id)) return names.get(element.id);
      let base = safeName(element.label || fallback || element.type || 'X');
      let candidate = base;
      let suffix = 2;
      while (usedNames.has(candidate)) candidate = base + '_' + suffix++;
      usedNames.add(candidate);
      names.set(element.id, candidate);
      return candidate;
    }
    elements.forEach(function (element, index) { variableFor(element, 'E' + (index + 1)); });

    function analogSourceFor(inputPin) {
      const endpoints = Array.from(network(inputPin, 'analog')).sort();
      for (const endpoint of endpoints) {
        const parts = endpointParts(endpoint);
        if (parts.side !== 'out' && parts.side !== 'fill' && parts.side !== 'drain') continue;
        const element = byId.get(parts.elementId);
        const type = cleanType(element && element.type);
        if (type === 'analog_constant' || type === 'analog_input' || type === 'scale' || type === 'pid' || type === 'split_range') return {element:element,side:parts.side};
      }
      return null;
    }
    function analogSourceElementFor(inputPin){const source=analogSourceFor(inputPin);return source&&source.element;}
    function analogExpressionFor(inputPin){const source=analogSourceFor(inputPin);if(!source)return '0.0f';const variable=variableFor(source.element);if(cleanType(source.element.type)==='split_range')return variable+(source.side==='drain'?'_drain':'_fill');return variable;}

    const memoDigitalInput = new Map();
    const memoDigitalOutput = new Map();
    function orExpr(parts) {
      const unique = Array.from(new Set((parts || []).filter(Boolean)));
      if (!unique.length) return 'false';
      if (unique.length === 1) return unique[0];
      return '(' + unique.join(' || ') + ')';
    }
    function contactCondition(element) {
      const variable = safeName(element.label || 'I0');
      return cleanType(element.type) === 'nc' ? '!(' + variable + ')' : variable;
    }
    function digitalInputExpr(pin, visiting) {
      if (memoDigitalInput.has(pin)) return memoDigitalInput.get(pin);
      visiting = visiting || new Set();
      const key = 'in:' + pin;
      if (visiting.has(key)) return 'false';
      visiting.add(key);
      const parts = [];
      network(pin, 'digital').forEach(function (endpoint) {
        if (endpoint === pin || isRightRail(endpoint) || isJunction(endpoint)) return;
        if (isLeftRail(endpoint)) { parts.push('true'); return; }
        const parsed = endpointParts(endpoint);
        if (parsed.side === 'out') parts.push(digitalOutputExpr(endpoint, visiting));
      });
      visiting.delete(key);
      const result = orExpr(parts);
      memoDigitalInput.set(pin, result);
      return result;
    }
    function digitalOutputExpr(pin, visiting) {
      if (memoDigitalOutput.has(pin)) return memoDigitalOutput.get(pin);
      if (isLeftRail(pin)) return 'true';
      if (isRightRail(pin)) return 'false';
      visiting = visiting || new Set();
      const key = 'out:' + pin;
      if (visiting.has(key)) return 'false';
      visiting.add(key);
      const parsed = endpointParts(pin);
      const element = byId.get(parsed.elementId);
      if (!element) { visiting.delete(key); return 'false'; }
      const type = cleanType(element.type);
      const variable = variableFor(element);
      let result = 'false';
      if (type === 'no' || type === 'nc') result = '(' + digitalInputExpr(pinId(element, 'in'), visiting) + ' && ' + contactCondition(element) + ')';
      else if (COMPARATOR_TYPES.has(type) || ['ton', 'toff', 'ctu', 'sr', 'coil', 'set', 'reset'].includes(type)) result = variable;
      else result = digitalInputExpr(pinId(element, 'in'), visiting);
      visiting.delete(key);
      memoDigitalOutput.set(pin, result);
      return result;
    }
    function powerTo(element, side) { return digitalInputExpr(pinId(element, side || 'in'), new Set()); }

    const analogConstants = elements.filter(function (element) { return cleanType(element.type) === 'analog_constant'; });
    const analogInputs = elements.filter(function (element) { return cleanType(element.type) === 'analog_input'; });
    const processors = elements.filter(function (element) { const type = cleanType(element.type); return type === 'scale' || type === 'pid' || type === 'split_range' || type === 'pwm_output' || type === 'analog_output' || COMPARATOR_TYPES.has(type); });
    const dependencies = new Map();
    processors.forEach(function (processor) {
      const type=cleanType(processor.type);
      const sources=type==='pid'
        ? [analogSourceElementFor(pinId(processor,'pv')),analogSourceElementFor(pinId(processor,'sp'))]
        : [analogSourceElementFor(pinId(processor,'in'))];
      dependencies.set(processor.id,sources.filter(Boolean).map(function(source){return source.id;}));
    });
    const orderedProcessors = [];
    const remaining = new Set(processors.map(function (element) { return element.id; }));
    let guard = processors.length + 2;
    while (remaining.size && guard-- > 0) {
      let moved = false;
      Array.from(remaining).forEach(function (id) {
        const dependency = dependencies.get(id) || [];
        if (!dependency.some(function(sourceId){return remaining.has(sourceId);})) {
          orderedProcessors.push(byId.get(id));
          remaining.delete(id);
          moved = true;
        }
      });
      if (!moved) break;
    }
    remaining.forEach(function (id) { orderedProcessors.push(byId.get(id)); });

    const digitalInputLabels = uniqueSorted(elements.filter(function (element) {
      return (cleanType(element.type) === 'no' || cleanType(element.type) === 'nc') && /^I\d+/i.test(String(element.label || ''));
    }).map(function (element) { return element.label; }));
    const pwmOutputElements = elements.filter(function (element) { return cleanType(element.type) === 'pwm_output'; });
    const analogOutputElements = elements.filter(function (element) { return cleanType(element.type) === 'analog_output'; });
    const analogInputLabels = analogInputs.map(function (element, index) { return String(element.label || ('AI' + (index + 1))); });
    const pwmOutputLabels = pwmOutputElements.map(function (element, index) { return String(element.label || ('PWM' + (index + 1))); });
    const analogOutputLabels = analogOutputElements.map(function (element, index) { return String(element.label || ('AO' + (index + 1))); });
    const pidElements = elements.filter(function (element) { return cleanType(element.type) === 'pid'; });
    const pidLabels = pidElements.map(function (element, index) { return String(element.label || ('PID' + (index + 1))); });
    const digitalInputNcFlags = digitalInputLabels.map(function (label) { return elements.some(function (element) { return String(element.label || '').toUpperCase() === String(label).toUpperCase() && (cleanType(element.type) === 'nc' || likelyNcInput(label, element)); }); });
    const defaultControlMode = generatedControlMode();
    const outputLabels = uniqueSorted(elements.filter(function (element) {
      return ['coil', 'set', 'reset'].includes(cleanType(element.type)) && /^Q\d+/i.test(String(element.label || ''));
    }).map(function (element) { return element.label; }));
    const memoryLabels = uniqueSorted(elements.filter(function (element) {
      return String(element.label || '').match(/^M\d+/i);
    }).map(function (element) { return element.label; }));

    const outputActiveLow = outputLabels.map(getOutputActiveLow);
    const lines = [];
    lines.push('/*');
    lines.push('  SimuPLC Lab ' + VERSION + ' - ESP32 desde LADDER PRO');
    lines.push('  Serie/paralelo calculado desde proWires.');
    lines.push('  CONST/AI/SCALE transportan float; comparadores entregan bool.');
    lines.push('*/');
    lines.push('');
    lines.push('#if defined(ARDUINO_ARCH_ESP32)');
    lines.push('  #if __has_include(<esp_arduino_version.h>)');
    lines.push('    #include <esp_arduino_version.h>');
    lines.push('  #endif');
    lines.push('#endif');
    lines.push('#if defined(ARDUINO_ARCH_ESP32) && defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)');
    lines.push('  #define SIMUPLC_ESP_CORE3 1');
    lines.push('#else');
    lines.push('  #define SIMUPLC_ESP_CORE3 0');
    lines.push('#endif');
    lines.push('');
    digitalInputLabels.forEach(function (label) { lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + pinMap.digitalInputs[label] + ';'); });
    analogInputs.forEach(function (element, index) {
      const label = String(element.label || ('AI' + (index + 1)));
      lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + pinMap.analogInputs[label] + ';');
    });
    outputLabels.forEach(function (label) { lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + pinMap.outputs[label] + ';'); });
    pwmOutputElements.forEach(function (element,index){const label=String(element.label||('PWM'+(index+1)));lines.push('const uint8_t PIN_'+safeName(label)+' = '+pinMap.pwmOutputs[label]+';');});
    analogOutputElements.forEach(function (element,index){const label=String(element.label||('AO'+(index+1)));lines.push('const uint8_t PIN_'+safeName(label)+' = '+pinMap.analogOutputs[label]+';');});
    lines.push('');
    lines.push('const uint8_t N_DIGITAL_INPUTS = ' + digitalInputLabels.length + ';');
    lines.push('const uint8_t N_ANALOG_INPUTS = ' + analogInputLabels.length + ';');
    lines.push('const uint8_t N_OUTPUTS = ' + outputLabels.length + ';');
    lines.push('const uint8_t N_PWM_OUTPUTS = ' + pwmOutputLabels.length + ';');
    lines.push('const uint8_t N_ANALOG_OUTPUTS = ' + analogOutputLabels.length + ';');
    lines.push('const uint8_t N_PID_VALUES = ' + pidLabels.length + ';');
    lines.push('const uint8_t SAFE_DIGITAL_INPUTS = ' + Math.max(1,digitalInputLabels.length) + ';');
    lines.push('const uint8_t SAFE_ANALOG_INPUTS = ' + Math.max(1,analogInputLabels.length) + ';');
    lines.push('const uint8_t SAFE_OUTPUTS = ' + Math.max(1,outputLabels.length) + ';');
    lines.push('const uint8_t SAFE_PWM_OUTPUTS = ' + Math.max(1,pwmOutputLabels.length) + ';');
    lines.push('const uint8_t SAFE_ANALOG_OUTPUTS = ' + Math.max(1,analogOutputLabels.length) + ';');
    lines.push('const uint8_t SAFE_PID_VALUES = ' + Math.max(1,pidLabels.length) + ';');
    lines.push('const uint32_t SIMUPLC_SERIAL_BAUD = 115200UL;');
    lines.push('const uint16_t SIMUPLC_STATE_PERIOD_MS = 250;');
    lines.push('const bool digitalInputIsNc[SAFE_DIGITAL_INPUTS] = { ' + cppArray(digitalInputNcFlags,false,function(value){return value?'true':'false';}) + ' };');
    lines.push('const char* const digitalInputTags[SAFE_DIGITAL_INPUTS] = { ' + cppArray(digitalInputLabels,'',cString) + ' };');
    lines.push('const char* const analogInputTags[SAFE_ANALOG_INPUTS] = { ' + cppArray(analogInputLabels,'',cString) + ' };');
    lines.push('const char* const outputTags[SAFE_OUTPUTS] = { ' + cppArray(outputLabels,'',cString) + ' };');
    lines.push('const char* const pwmOutputTags[SAFE_PWM_OUTPUTS] = { ' + cppArray(pwmOutputLabels,'',cString) + ' };');
    lines.push('const char* const analogOutputTags[SAFE_ANALOG_OUTPUTS] = { ' + cppArray(analogOutputLabels,'',cString) + ' };');
    lines.push('const char* const pidTags[SAFE_PID_VALUES] = { ' + cppArray(pidLabels,'',cString) + ' };');
    lines.push('');
    lines.push('typedef struct PIDState{float integral;float prevError;uint32_t lastAt;float output;} PIDState;');
    lines.push('float runPID(float &integral,float &prevError,uint32_t &lastAt,float &output,float pv,float sp,float kp,float ki,float kd,uint32_t sampleMs,float outMin,float outMax,bool cooling,bool manualMode,float manualOutput,uint32_t now);');
    digitalInputLabels.forEach(function (label) { lines.push('bool ' + safeName(label) + ' = false;'); });
    memoryLabels.forEach(function (label) { if (!digitalInputLabels.includes(label)) lines.push('bool ' + safeName(label) + ' = false;'); });
    outputLabels.forEach(function (label) { lines.push('bool ' + safeName(label) + ' = false;'); });
    analogConstants.forEach(function (element) {
      const variable = variableFor(element);
      lines.push('const float ' + variable + ' = ' + cFloat(element.constantValue !== undefined ? element.constantValue : element.value, 50) + ';');
    });
    analogInputs.forEach(function (element) {
      const variable = variableFor(element);
      lines.push('int ' + variable + '_raw = 0;');
      lines.push('float ' + variable + ' = 0.0f;');
    });
    orderedProcessors.forEach(function (element) {
      const variable = variableFor(element);
      if(cleanType(element.type)==='pid'){lines.push('float '+variable+' = 0.0f;');lines.push('PIDState '+variable+'_state = {0.0f,0.0f,0,0.0f};');} else if(cleanType(element.type)==='split_range'){lines.push('float '+variable+' = 0.0f;');lines.push('float '+variable+'_fill = 0.0f;');lines.push('float '+variable+'_drain = 0.0f;');} else if (cleanType(element.type) === 'scale' || cleanType(element.type) === 'pwm_output' || cleanType(element.type) === 'analog_output') lines.push('float ' + variable + ' = 0.0f;');
      else lines.push('bool ' + variable + ' = false;');
    });
    elements.forEach(function (element) {
      const type = cleanType(element.type);
      const variable = variableFor(element);
      if (type === 'ton' || type === 'toff') { lines.push('bool ' + variable + ' = false;'); lines.push('uint32_t ' + variable + '_start = 0;'); lines.push('bool ' + variable + '_prev = false;'); }
      else if (type === 'ctu') { lines.push('bool ' + variable + ' = false;'); lines.push('long ' + variable + '_count = 0;'); lines.push('bool ' + variable + '_prev = false;'); }
      else if (type === 'sr' && !outputLabels.includes(element.label) && !memoryLabels.includes(element.label)) lines.push('bool ' + variable + ' = false;');
    });
    lines.push('const bool OUTPUT_ACTIVE_LOW[' + Math.max(1, outputLabels.length) + '] = { ' + cppArray(outputActiveLow, false, function (value) { return value ? 'true' : 'false'; }) + ' };');
    lines.push('uint32_t lastScan = 0;');
    lines.push('enum SimuPLCControlMode : uint8_t { SIMUPLC_BOTH=0, SIMUPLC_HMI=1, SIMUPLC_PHYSICAL=2 };');
    lines.push('uint8_t simuplcControlMode = ' + defaultControlMode + ';');
    lines.push('bool simuplcRunning = true;');
    lines.push('bool simuplcProtocolActive = false;');
    lines.push('bool simuplcScanRequested = true;');
    lines.push('bool simuplcStateRequested = false;');
    lines.push('bool physicalDigitalInputs[SAFE_DIGITAL_INPUTS] = {false};');
    lines.push('bool hmiDigitalInputs[SAFE_DIGITAL_INPUTS] = {false};');
    lines.push('float physicalAnalogInputs[SAFE_ANALOG_INPUTS] = {0};');
    lines.push('float hmiAnalogInputs[SAFE_ANALOG_INPUTS] = {0};');
    lines.push('bool hmiAnalogValid[SAFE_ANALOG_INPUTS] = {false};');
    lines.push('char simuplcRxLine[128];');
    lines.push('uint8_t simuplcRxLength = 0;');
    lines.push('uint32_t simuplcLastStateAt = 0;');
    lines.push('');
    lines.push('float clampFloat(float value,float a,float b){float lo=min(a,b),hi=max(a,b);return max(lo,min(hi,value));}');
    lines.push('float mapFloat(float value,float inMin,float inMax,float outMin,float outMax,bool limit){if(inMax==inMin)return outMin;if(limit)value=clampFloat(value,inMin,inMax);return outMin+((value-inMin)/(inMax-inMin))*(outMax-outMin);}');
    lines.push('float runPID(float &integral,float &prevError,uint32_t &lastAt,float &output,float pv,float sp,float kp,float ki,float kd,uint32_t sampleMs,float outMin,float outMax,bool cooling,bool manualMode,float manualOutput,uint32_t now){if(manualMode){output=clampFloat(manualOutput,outMin,outMax);return output;}sampleMs=max((uint32_t)20,sampleMs);if(lastAt&&now-lastAt<sampleMs)return output;float dt=max((float)sampleMs,(float)(lastAt?now-lastAt:sampleMs))/1000.0f;float error=(sp-pv)*(cooling?-1.0f:1.0f);float derivative=(error-prevError)/max(dt,0.001f);float candidate=integral+error*dt;float raw=kp*error+ki*candidate+kd*derivative;float limited=clampFloat(raw,outMin,outMax);if(raw==limited||((error>0)!=(raw-limited>0)))integral=candidate;prevError=error;lastAt=now;output=limited;return limited;}');
    lines.push('');
    lines.push('void setupPWMOutput(uint8_t pin,uint8_t channel,uint32_t frequency,uint8_t resolution){');
    lines.push('#if defined(ARDUINO_ARCH_ESP32)'); lines.push('  #if SIMUPLC_ESP_CORE3'); lines.push('    ledcAttach(pin,frequency,resolution);'); lines.push('  #else'); lines.push('    ledcSetup(channel,frequency,resolution);ledcAttachPin(pin,channel);'); lines.push('  #endif'); lines.push('#else'); lines.push('  (void)channel;(void)frequency;(void)resolution;pinMode(pin,OUTPUT);'); lines.push('#endif'); lines.push('}');
    lines.push('void writePWMOutput(uint8_t pin,uint8_t channel,float percent,uint8_t resolution){'); lines.push('  percent=clampFloat(percent,0.0f,100.0f);');
    lines.push('#if defined(ARDUINO_ARCH_ESP32)'); lines.push('  uint8_t bits=min((uint8_t)16,max((uint8_t)1,resolution));uint32_t maxDuty=(1UL<<bits)-1UL;uint32_t duty=(uint32_t)roundf(percent*maxDuty/100.0f);'); lines.push('  #if SIMUPLC_ESP_CORE3'); lines.push('    ledcWrite(pin,duty);'); lines.push('  #else'); lines.push('    ledcWrite(channel,duty);'); lines.push('  #endif'); lines.push('#else'); lines.push('  (void)channel;(void)resolution;analogWrite(pin,(int)roundf(percent*255.0f/100.0f));'); lines.push('#endif'); lines.push('}');
    lines.push('void writeAnalogOutput(uint8_t pin,float volts,float minV,float maxV){'); lines.push('#if defined(ARDUINO_ARCH_ESP32)'); lines.push('  float ratio=(volts-minV)/(maxV-minV==0?1:(maxV-minV));ratio=clampFloat(ratio,0.0f,1.0f);dacWrite(pin,(uint8_t)roundf(ratio*255.0f));'); lines.push('#else'); lines.push('  (void)pin;(void)volts;(void)minV;(void)maxV;'); lines.push('#endif'); lines.push('}');
    lines.push('int findTagIndex(const char* tag,const char* const* tags,uint8_t count){for(uint8_t i=0;i<count;i++)if(strcmp(tag,tags[i])==0)return i;return -1;}');
    lines.push('bool effectiveDigitalInput(uint8_t ix){if(ix>=N_DIGITAL_INPUTS)return false;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalDigitalInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):hmiDigitalInputs[ix];return digitalInputIsNc[ix]?(physicalDigitalInputs[ix]&&hmiDigitalInputs[ix]):(physicalDigitalInputs[ix]||hmiDigitalInputs[ix]);}');
    lines.push('float effectiveAnalogInput(uint8_t ix){if(ix>=N_ANALOG_INPUTS)return 0.0f;if(simuplcControlMode==SIMUPLC_PHYSICAL)return physicalAnalogInputs[ix];if(simuplcControlMode==SIMUPLC_HMI)return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:0.0f;return hmiAnalogValid[ix]?hmiAnalogInputs[ix]:physicalAnalogInputs[ix];}');
    lines.push('const char* simuplcModeName(){return simuplcControlMode==SIMUPLC_HMI?"HMI":(simuplcControlMode==SIMUPLC_PHYSICAL?"PHYSICAL":"BOTH");}');
    lines.push('');
    lines.push('void setup(){');
    lines.push('  Serial.begin(SIMUPLC_SERIAL_BAUD);');
    lines.push('  analogReadResolution(12);');
    digitalInputLabels.forEach(function (label) { lines.push('  pinMode(PIN_' + safeName(label) + ', INPUT_PULLUP);'); });
    outputLabels.forEach(function (label, index) { lines.push('  pinMode(PIN_' + safeName(label) + ', OUTPUT); digitalWrite(PIN_' + safeName(label) + ', OUTPUT_ACTIVE_LOW[' + index + '] ? HIGH : LOW);'); });
    pwmOutputElements.forEach(function(element,index){lines.push('  setupPWMOutput(PIN_'+safeName(element.label)+','+index+','+Math.max(1,integer(element.frequency,1000))+','+integer(element.resolution,8,1,16)+');');});
    lines.push('}');
    lines.push('');
    lines.push('void readInputs(){');
    digitalInputLabels.forEach(function (label,index) { lines.push('  physicalDigitalInputs['+index+'] = (digitalRead(PIN_' + safeName(label) + ') == LOW); ' + safeName(label) + ' = effectiveDigitalInput('+index+');'); });
    analogInputs.forEach(function (element, index) {
      const variable = variableFor(element);
      const label = String(element.label || ('AI' + (index + 1)));
      const rawMin = num(element.rawMin, 0), rawMax = num(element.rawMax, 4095);
      const engMin = num(element.engMin, 0), engMax = num(element.engMax, 100);
      const clampFlag = element.clamp !== false;
      const rawMode = String(element.outputMode || 'scaled').toLowerCase() === 'raw';
      lines.push('  ' + variable + '_raw = analogRead(PIN_' + safeName(label) + ');');
      if (rawMode) lines.push('  physicalAnalogInputs['+index+'] = (float)' + variable + '_raw; ' + variable + ' = effectiveAnalogInput('+index+');');
      else lines.push('  physicalAnalogInputs['+index+'] = mapFloat(' + variable + '_raw,' + cFloat(rawMin) + ',' + cFloat(rawMax) + ',' + cFloat(engMin) + ',' + cFloat(engMax) + ',' + (clampFlag ? 'true' : 'false') + '); ' + variable + ' = effectiveAnalogInput('+index+');');
    });
    lines.push('}');
    lines.push('');
    lines.push('void plcScan(){');
    lines.push('  uint32_t now = millis();');
    orderedProcessors.forEach(function (element) {
      const type = cleanType(element.type);
      const variable = variableFor(element);
      const input = analogExpressionFor(pinId(element, 'in'));
      if(type==='pid'){
        const pv=analogExpressionFor(pinId(element,'pv')),sp=analogExpressionFor(pinId(element,'sp'));
        lines.push('  '+variable+' = runPID('+variable+'_state.integral,'+variable+'_state.prevError,'+variable+'_state.lastAt,'+variable+'_state.output,'+pv+','+sp+','+cFloat(element.kp,2)+','+cFloat(element.ki,.5)+','+cFloat(element.kd,.1)+','+Math.max(20,integer(element.sampleMs,100))+'UL,'+cFloat(element.outMin,0)+','+cFloat(element.outMax,100)+','+(String(element.direction)==='cooling'?'true':'false')+','+(String(element.mode)==='manual'?'true':'false')+','+cFloat(element.manualOutput,0)+',now);');
      } else if(type==='split_range'){
        const inMin=cFloat(element.inMin,0),inMax=cFloat(element.inMax,100),neutral=cFloat(element.neutral,50),deadband=cFloat(Math.max(0,num(element.deadband,2))),outMax=cFloat(Math.max(0,num(element.outMax,100)));
        lines.push('  '+variable+' = '+(element.clamp!==false?'clampFloat('+input+','+inMin+','+inMax+')':input)+';');
        lines.push('  {float half='+deadband+'*0.5f;float low=clampFloat('+neutral+'-half,'+inMin+','+inMax+');float high=clampFloat('+neutral+'+half,'+inMin+','+inMax+');'+variable+'_fill=0.0f;'+variable+'_drain=0.0f;if('+variable+'>high&&'+inMax+'>high)'+variable+'_fill=mapFloat('+variable+',high,'+inMax+',0.0f,'+outMax+',true);else if('+variable+'<low&&low>'+inMin+')'+variable+'_drain=mapFloat('+variable+',low,'+inMin+',0.0f,'+outMax+',true);'+variable+'_fill=clampFloat('+variable+'_fill,0.0f,'+outMax+');'+variable+'_drain=clampFloat('+variable+'_drain,0.0f,'+outMax+');if('+variable+'_fill>0.0f)'+variable+'_drain=0.0f;else if('+variable+'_drain>0.0f)'+variable+'_fill=0.0f;}');
      } else if (type === 'scale') {
        lines.push('  ' + variable + ' = mapFloat(' + input + ',' + cFloat(element.inMin, 0) + ',' + cFloat(element.inMax, 100) + ',' + cFloat(element.outMin, 0) + ',' + cFloat(element.outMax, 100) + ',' + (element.clamp !== false ? 'true' : 'false') + ');');
      } else if (type === 'pwm_output') {
        lines.push('  ' + variable + ' = mapFloat(' + input + ',' + cFloat(element.inMin, 0) + ',' + cFloat(element.inMax, 100) + ',0.0f,100.0f,' + (element.clamp !== false ? 'true' : 'false') + ');');
      } else if (type === 'analog_output') {
        lines.push('  ' + variable + ' = mapFloat(' + input + ',' + cFloat(element.inMin, 0) + ',' + cFloat(element.inMax, 100) + ',' + cFloat(element.voltageMin, 0) + ',' + cFloat(element.voltageMax, 3.3) + ',' + (element.clamp !== false ? 'true' : 'false') + ');');
      } else if (type === 'gt') lines.push('  ' + variable + ' = (' + input + ' > ' + cFloat(element.threshold, 50) + ');');
      else if (type === 'lt') lines.push('  ' + variable + ' = (' + input + ' < ' + cFloat(element.threshold, 50) + ');');
      else if (type === 'eq') lines.push('  ' + variable + ' = (fabs(' + input + ' - ' + cFloat(element.threshold, 50) + ') <= ' + cFloat(Math.abs(num(element.tolerance, 0.1))) + ');');
      else if (type === 'gte') lines.push('  ' + variable + ' = (' + input + ' >= ' + cFloat(element.threshold, 50) + ');');
      else if (type === 'lte') lines.push('  ' + variable + ' = (' + input + ' <= ' + cFloat(element.threshold, 50) + ');');
      else if (type === 'hyst') {
        lines.push('  if(' + input + ' >= ' + cFloat(element.high, 60) + ') ' + variable + ' = true;');
        lines.push('  else if(' + input + ' <= ' + cFloat(element.low, 40) + ') ' + variable + ' = false;');
      }
    });
    elements.forEach(function (element) {
      const type = cleanType(element.type);
      const variable = variableFor(element);
      if (type === 'ton') {
        const power = powerTo(element, 'in');
        const delay = Math.max(0, integer(element.delayMs != null ? element.delayMs : element.delay, 1000));
        lines.push('  if(' + power + '){if(!' + variable + '_prev)' + variable + '_start=now;' + variable + '=((uint32_t)(now-' + variable + '_start)>=' + delay + 'UL);}else{' + variable + '=false;' + variable + '_start=now;}' + variable + '_prev=(' + power + ');');
      } else if (type === 'toff') {
        const power = powerTo(element, 'in');
        const delay = Math.max(0, integer(element.delayMs != null ? element.delayMs : element.delay, 1000));
        lines.push('  if(' + power + '){' + variable + '=true;' + variable + '_start=now;}else if(' + variable + '&&((uint32_t)(now-' + variable + '_start)>=' + delay + 'UL))' + variable + '=false;');
      } else if (type === 'ctu') {
        const count = powerTo(element, 'cnt'), reset = powerTo(element, 'r'), direction = powerTo(element, 'dir');
        const preset = Math.max(1, integer(element.preset != null ? element.preset : element.on, 3));
        const off = Math.max(0, integer(element.presetOff != null ? element.presetOff : element.off, 0));
        lines.push('  if(' + reset + '){' + variable + '_count=0;' + variable + '=false;' + variable + '_prev=false;}else{if((' + count + ')&&!'+ variable + '_prev){if(' + direction + '){if(' + variable + '_count>0)' + variable + '_count--;}else ' + variable + '_count++;}' + variable + '_prev=(' + count + ');if(' + variable + '_count>=' + preset + ')' + variable + '=true;else if(' + variable + '_count<=' + off + ')' + variable + '=false;}');
      } else if (type === 'sr') {
        lines.push('  if(' + powerTo(element, 'r') + ')' + variable + '=false; else if(' + powerTo(element, 's') + ')' + variable + '=true;');
      }
    });
    elements.forEach(function (element) {
      const type = cleanType(element.type);
      const variable = safeName(element.label || variableFor(element));
      if (type === 'coil') lines.push('  ' + variable + ' = (' + powerTo(element, 'in') + ');');
      else if (type === 'set') lines.push('  if(' + powerTo(element, 'in') + ') ' + variable + ' = true;');
      else if (type === 'reset') lines.push('  if(' + powerTo(element, 'in') + ') ' + variable + ' = false;');
    });
    lines.push('}');
    lines.push('');
    lines.push('void writeOutputs(){');
    outputLabels.forEach(function (label, index) {
      const variable = safeName(label);
      lines.push('  digitalWrite(PIN_' + variable + ',' + variable + ' ? (OUTPUT_ACTIVE_LOW[' + index + '] ? LOW : HIGH) : (OUTPUT_ACTIVE_LOW[' + index + '] ? HIGH : LOW));');
    });
    pwmOutputElements.forEach(function(element,index){const v=variableFor(element),label=safeName(element.label);lines.push('  writePWMOutput(PIN_'+label+','+index+','+v+','+integer(element.resolution,8,1,16)+');');});
    analogOutputElements.forEach(function(element){const v=variableFor(element),label=safeName(element.label);lines.push('  writeAnalogOutput(PIN_'+label+','+v+','+cFloat(element.voltageMin,0)+','+cFloat(element.voltageMax,3.3)+');');});
    lines.push('}');
    lines.push('void forceOutputsOff(){');
    outputLabels.forEach(function(label){lines.push('  '+safeName(label)+' = false;');});
    pwmOutputElements.forEach(function(element){lines.push('  '+variableFor(element)+' = 0.0f;');});
    analogOutputElements.forEach(function(element){lines.push('  '+variableFor(element)+' = 0.0f;');});
    lines.push('  writeOutputs();');
    lines.push('}');
    lines.push('void controllerScan(uint32_t now){(void)now;readInputs();if(simuplcRunning){plcScan();writeOutputs();}else forceOutputsOff();}');
    lines.push('');
    lines.push('void printBoolPair(const char* tag,bool value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value?1:0);}');
    lines.push('void printFloatPair(const char* tag,float value){Serial.print(char(44));Serial.print(tag);Serial.print(char(44));Serial.print(value,3);}');
    lines.push('void sendSimuPLCState(){');
    lines.push('  Serial.print(F("STATE"));');
    digitalInputLabels.forEach(function(label,index){const v=safeName(label);lines.push('  printBoolPair(digitalInputTags['+index+'],'+v+');Serial.print(char(44));Serial.print(digitalInputTags['+index+']);Serial.print(F("_PHYSICAL,"));Serial.print(physicalDigitalInputs['+index+']?1:0);Serial.print(char(44));Serial.print(digitalInputTags['+index+']);Serial.print(F("_HMI,"));Serial.print(hmiDigitalInputs['+index+']?1:0);');});
    analogInputs.forEach(function(element,index){const v=variableFor(element);lines.push('  printFloatPair(analogInputTags['+index+'],'+v+');Serial.print(char(44));Serial.print(analogInputTags['+index+']);Serial.print(F("_PHYSICAL,"));Serial.print(physicalAnalogInputs['+index+'],3);Serial.print(char(44));Serial.print(analogInputTags['+index+']);Serial.print(F("_HMI,"));Serial.print(hmiAnalogInputs['+index+'],3);');});
    outputLabels.forEach(function(label,index){lines.push('  printBoolPair(outputTags['+index+'],'+safeName(label)+');');});
    pwmOutputElements.forEach(function(element,index){lines.push('  printFloatPair(pwmOutputTags['+index+'],'+variableFor(element)+');');});
    analogOutputElements.forEach(function(element,index){lines.push('  printFloatPair(analogOutputTags['+index+'],'+variableFor(element)+');');});
    pidElements.forEach(function(element,index){lines.push('  printFloatPair(pidTags['+index+'],'+variableFor(element)+');');});
    lines.push('  Serial.print(F(",RUNNING,"));Serial.print(simuplcRunning?1:0);Serial.print(F(",CONTROL_MODE,"));Serial.println(simuplcModeName());');
    lines.push('  simuplcLastStateAt=millis();simuplcStateRequested=false;');
    lines.push('}');
    lines.push('void processSimuPLCCommand(char* line){');
    lines.push("  for(char* p=line;*p;p++)if(*p>='a'&&*p<='z')*p=(char)(*p-32);");
    lines.push('  char* save=nullptr;char* cmd=strtok_r(line,",",&save);if(!cmd)return;simuplcProtocolActive=true;');
    lines.push('  if(strcmp(cmd,"HELLO")==0){Serial.println(F("OK,SIMUPLC,READY_ANALOG_V1,1"));simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"PING")==0){Serial.println(F("PONG"));return;}');
    lines.push('  if(strcmp(cmd,"GET_STATE")==0){simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"RUN")==0){char* value=strtok_r(nullptr,",",&save);simuplcRunning=!(value&&strcmp(value,"0")==0);simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"STOP")==0){simuplcRunning=false;simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"MODE")==0){char* value=strtok_r(nullptr,",",&save);if(value){if(strcmp(value,"HMI")==0)simuplcControlMode=SIMUPLC_HMI;else if(strcmp(value,"PHYSICAL")==0||strcmp(value,"FISICO")==0)simuplcControlMode=SIMUPLC_PHYSICAL;else simuplcControlMode=SIMUPLC_BOTH;}simuplcScanRequested=true;simuplcStateRequested=true;return;}');
    lines.push('  if(strcmp(cmd,"SET")==0||strcmp(cmd,"SETA")==0){char* tag=strtok_r(nullptr,",",&save);char* value=strtok_r(nullptr,",",&save);if(!tag||!value)return;int dix=findTagIndex(tag,digitalInputTags,N_DIGITAL_INPUTS);if(dix>=0){hmiDigitalInputs[dix]=atoi(value)!=0;simuplcScanRequested=true;simuplcStateRequested=true;return;}int aix=findTagIndex(tag,analogInputTags,N_ANALOG_INPUTS);if(aix>=0){hmiAnalogInputs[aix]=(float)atof(value);hmiAnalogValid[aix]=true;simuplcScanRequested=true;simuplcStateRequested=true;return;}Serial.println(F("ERROR,TAG_NO_ENCONTRADO"));return;}');
    lines.push('  if(strcmp(cmd,"RELEASE")==0){char* tag=strtok_r(nullptr,",",&save);if(tag){int aix=findTagIndex(tag,analogInputTags,N_ANALOG_INPUTS);if(aix>=0){hmiAnalogValid[aix]=false;simuplcScanRequested=true;simuplcStateRequested=true;return;}}return;}');
    lines.push('  Serial.println(F("ERROR,COMANDO_NO_RECONOCIDO"));');
    lines.push('}');
    lines.push("void pollSimuPLCSerial(){while(Serial.available()>0){char c=(char)Serial.read();if(c=='\\n'||c=='\\r'){if(simuplcRxLength){simuplcRxLine[simuplcRxLength]=0;processSimuPLCCommand(simuplcRxLine);simuplcRxLength=0;}}else if(c>=32&&c<=126){if(simuplcRxLength<sizeof(simuplcRxLine)-1)simuplcRxLine[simuplcRxLength++]=c;else simuplcRxLength=0;}}}");
    lines.push('');
    lines.push('void loop(){');
    lines.push('  pollSimuPLCSerial();');
    lines.push('  uint32_t now=millis();if(simuplcScanRequested||(uint32_t)(now-lastScan)>=20){simuplcScanRequested=false;lastScan=now;controllerScan(now);}');
    lines.push('  if(simuplcProtocolActive&&(simuplcStateRequested||(uint32_t)(now-simuplcLastStateAt)>=SIMUPLC_STATE_PERIOD_MS))sendSimuPLCState();');
    lines.push('}');
    return lines.join('\n');
  }

  async function generateForActiveEditor() {
    try {
      const current = await currentStateAndSignals();
      let map = normalizePinMap(current.signals, loadPinMap(), false);
      savePinMap(map);
      const validation = validatePinMap(current.signals, map);
      if (!validation.ok) {
        return '/*\n  No se pudo generar ESP32 por errores de asignacion de pines:\n  - ' + validation.errors.join('\n  - ') + '\n*/';
      }
      let code;
      if (current.editor === 'ladder') {
        code = generateLadderESP32(current.state, map);
        diagnostics.ladderGenerated += 1;
      } else {
        code = generateFBDESP32(current.state, map);
        diagnostics.fbdGenerated += 1;
      }
      const warningHeader = validation.warnings.length
        ? '/* ADVERTENCIAS DE PINES:\n - ' + validation.warnings.join('\n - ') + '\n*/\n\n'
        : '';
      diagnostics.generated += 1;
      diagnostics.lastEditor = current.editor;
      diagnostics.lastError = null;
      return warningHeader + code;
    } catch (error) {
      diagnostics.lastError = error && error.message ? error.message : String(error);
      return '/* Error generando ESP32: ' + diagnostics.lastError + ' */';
    }
  }

  function ensureESP32Styles() {
    if (document.getElementById('simuplc-esp32-codegen-style')) return;
    const style = document.createElement('style');
    style.id = 'simuplc-esp32-codegen-style';
    style.textContent = `
      #esp32PinsPanel{display:none;padding:12px;border-radius:16px;margin:10px 0 12px;border:1px solid transparent}
      #arduinoCard[data-theme="light"] #esp32PinsPanel{background:linear-gradient(180deg,#ffffff,#f1fbff);border-color:#bfe6ef;box-shadow:0 8px 22px rgba(14,116,144,.12)}
      #arduinoCard[data-theme="dark"] #esp32PinsPanel{background:rgba(3,24,36,.58);border-color:rgba(103,232,249,.22)}
      #esp32PinsPanel .title{font-size:13px;font-weight:900;margin-bottom:2px}
      #esp32PinsPanel .sub2{font-size:12px;color:#52707d;margin-bottom:9px;line-height:1.35}
      #arduinoCard[data-theme="dark"] #esp32PinsPanel .sub2{color:#b7d7e1}
      .esp32-pin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .esp32-pin-col{border:1px solid rgba(14,116,144,.2);border-radius:12px;padding:8px;background:rgba(236,254,255,.55)}
      #arduinoCard[data-theme="dark"] .esp32-pin-col{background:rgba(8,47,73,.32)}
      .esp32-pin-col h4{font-size:11px;margin:0 0 6px;color:#075985;text-transform:uppercase;letter-spacing:.05em}
      #arduinoCard[data-theme="dark"] .esp32-pin-col h4{color:#67e8f9}
      .esp32-pin-row{display:grid;grid-template-columns:minmax(44px,1fr) 105px;gap:7px;align-items:center;padding:5px 2px}
      .esp32-pin-row label{font-size:12px;font-weight:900;overflow:hidden;text-overflow:ellipsis}
      .esp32-pin-row select{width:100%;padding:6px;border-radius:8px;border:1px solid #9fc8d4;background:#fff;color:#102a36;font-weight:800}
      #arduinoCard[data-theme="dark"] .esp32-pin-row select{background:#071724;color:#e5f7fb;border-color:#31566a}
      #esp32PinsFooter{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:9px}
      #esp32PinsReset{padding:7px 10px;border-radius:9px;border:1px solid #82bfce;background:#fff;font-weight:900;cursor:pointer}
      #esp32PinsMessages{font-size:11px;line-height:1.4;flex:1;min-width:200px}
      #esp32PinsMessages .error{color:#b91c1c;font-weight:800}.esp32-warning{color:#a16207;font-weight:800}
      @media(max-width:780px){.esp32-pin-grid{grid-template-columns:1fr}.esp32-pin-row{grid-template-columns:minmax(52px,1fr) 120px}}
    `;
    document.head.appendChild(style);
  }

  function ensureBoardOption(modal) {
    const select = modal.querySelector('#arduinoBoardSelect');
    if (!select) return;
    if (!select.querySelector('option[value="' + BOARD_ID + '"]')) {
      const option = document.createElement('option');
      option.value = BOARD_ID;
      option.textContent = 'ESP32 DevKit V1 / WROOM-32';
      select.appendChild(option);
    }
    let stored = 'uno';
    try { stored = localStorage.getItem(BOARD_KEY) || select.value || 'uno'; } catch (_) { stored = select.value || 'uno'; }
    if (stored === BOARD_ID) select.value = BOARD_ID;
  }

  function optionMarkup(pins, current) {
    return pins.map(function (pin) { return '<option value="' + pin + '"' + (pin === current ? ' selected' : '') + '>' + pinLabel(pin) + '</option>'; }).join('');
  }

  async function renderESP32PinsUI(forceDefaults) {
    const modal = document.getElementById('arduinoModal');
    const panel = document.getElementById('esp32PinsPanel');
    if (!modal || !panel) return;
    const current = await currentStateAndSignals();
    const map = normalizePinMap(current.signals, loadPinMap(), !!forceDefaults);
    savePinMap(map);

    const groups = [
      { key: 'digitalInputs', title: 'Entradas digitales', pins: BOARD.digitalInputPins },
      { key: 'analogInputs', title: 'Entradas analógicas AI', pins: BOARD.analogInputPins },
      { key: 'outputs', title: 'Salidas Q', pins: BOARD.outputPins }
    ];
    const grid = panel.querySelector('.esp32-pin-grid');
    grid.innerHTML = '';
    groups.forEach(function (group) {
      const column = document.createElement('div');
      column.className = 'esp32-pin-col';
      const title = document.createElement('h4');
      title.textContent = group.title;
      column.appendChild(title);
      (current.signals[group.key] || []).forEach(function (label) {
        const row = document.createElement('div');
        row.className = 'esp32-pin-row';
        row.innerHTML = '<label title="' + label + '">' + label + '</label><select data-group="' + group.key + '" data-label="' + label + '">' + optionMarkup(group.pins, map[group.key][label]) + '</select>';
        column.appendChild(row);
      });
      if (!(current.signals[group.key] || []).length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;color:#78909c;padding:5px 2px';
        empty.textContent = 'Sin variables';
        column.appendChild(empty);
      }
      grid.appendChild(column);
    });

    panel.querySelectorAll('select[data-group]').forEach(function (select) {
      select.addEventListener('change', async function () {
        const saved = loadPinMap();
        saved[select.dataset.group] = saved[select.dataset.group] || {};
        saved[select.dataset.group][select.dataset.label] = parseInt(select.value, 10);
        savePinMap(saved);
        await updateESP32Messages(current.signals, saved);
        await refresh();
      });
    });
    await updateESP32Messages(current.signals, map);
  }

  async function updateESP32Messages(signals, map) {
    const wrap = document.getElementById('esp32PinsMessages');
    if (!wrap) return;
    const validation = validatePinMap(signals, map);
    const chunks = [];
    if (validation.errors.length) chunks.push('<div class="error">' + validation.errors.join('<br>') + '</div>');
    if (validation.warnings.length) chunks.push('<div class="esp32-warning">' + validation.warnings.join('<br>') + '</div>');
    if (!chunks.length) chunks.push('<div style="color:#087f5b;font-weight:900">Asignación válida para ESP32.</div>');
    wrap.innerHTML = chunks.join('');
  }

  function ensureESP32Panel(modal) {
    let panel = modal.querySelector('#esp32PinsPanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'esp32PinsPanel';
    panel.innerHTML = `
      <div class="title">Mapeo de GPIO para ESP32</div>
      <div class="sub2">Las entradas AI usan ADC1 para mantener compatibilidad con el futuro bloque WiFi. Los GPIO 34–39 son solo entrada y no tienen pull-up interno.</div>
      <div class="esp32-pin-grid"></div>
      <div id="esp32PinsFooter"><button id="esp32PinsReset" type="button">Restaurar pines seguros</button><div id="esp32PinsMessages"></div></div>
    `;
    const oldPins = modal.querySelector('#arduinoPins');
    if (oldPins && oldPins.parentNode) {
      oldPins.parentNode.insertBefore(panel, oldPins.nextSibling);
    } else {
      const card = modal.querySelector('#arduinoCard') || modal;
      const code = modal.querySelector('#arduinoCode');
      if (code && code.parentNode === card) card.insertBefore(panel, code);
      else card.appendChild(panel);
    }
    panel.querySelector('#esp32PinsReset').addEventListener('click', async function () {
      await renderESP32PinsUI(true);
      await refresh();
    });
    return panel;
  }

  function applyModalMode() {
    installBoardProfileHooks();
    const modal = document.getElementById('arduinoModal');
    if (!modal) return;
    ensureESP32Styles();
    ensureBoardOption(modal);
    const esp32 = isESP32Selected();
    const panel = ensureESP32Panel(modal);
    const oldPins = modal.querySelector('#arduinoPins');
    const modeBox = modal.querySelector('#arduinoModeBox');
    const boardInfo = modal.querySelector('#arduinoBoardInfo');
    const title = modal.querySelector('#arduinoHeader h3');
    const subtitle = modal.querySelector('#arduinoHeader .sub');
    const hint = modal.querySelector('#arduinoHint');
    const download = modal.querySelector('#arduinoDownload');
    if (panel) panel.style.display = esp32 ? 'block' : 'none';
    if (oldPins) oldPins.style.display = esp32 ? 'none' : '';
    if (modeBox) modeBox.style.display = esp32 ? 'none' : '';
    if (boardInfo && esp32) boardInfo.textContent = 'ESP32 clásico: ADC de 12 bits. AI usa GPIO ADC1 32–39; se evitan ADC2 para preparar WiFi.';
    if (title) title.textContent = esp32 ? 'Generador ESP32 (.ino)' : 'Generador Arduino (.ino)';
    if (subtitle) subtitle.textContent = esp32 ? 'FBD o Ladder → código para ESP32 DevKit V1' : 'Tu circuito → código listo para pegar en Arduino IDE';
    if (hint && esp32) hint.innerHTML = '<b>ESP32:</b> asigna GPIO para I, AI y Q. Las entradas digitales se generan con <b>INPUT_PULLUP</b>; las AI usan lectura de 12 bits. El código incluye SCALE, comparadores e histéresis.';
    if (download) download.textContent = esp32 ? '⬇ Descargar ESP32 .ino' : '⬇ Descargar .ino';
    const button = document.getElementById('btnArduino');
    if (button) {
      button.title = 'Generar código Arduino o ESP32';
      const img = button.querySelector('img');
      button.innerHTML = '';
      if (img) button.appendChild(img);
      button.appendChild(document.createTextNode('CÓDIGO MCU'));
    }
    diagnostics.uiEnhancements += 1;
  }

  async function generateLegacyForActiveEditor() {
    if (activeEditor() === 'ladder' && global.SimuPLCEditors && typeof global.SimuPLCEditors.getLadderArduino === 'function') {
      try { return await global.SimuPLCEditors.getLadderArduino(); }
      catch (error) { return '// Error generando Arduino desde Ladder: ' + (error && error.message ? error.message : error); }
    }
    try { return typeof global.generateArduinoSketch === 'function' ? global.generateArduinoSketch() : '// Generador Arduino no disponible.'; }
    catch (error) { return '// Error generando Arduino: ' + (error && error.message ? error.message : error); }
  }

  async function refresh() {
    const textarea = document.getElementById('arduinoCode');
    if (!textarea) return '';
    applyModalMode();
    if (isESP32Selected()) {
      textarea.value = '// Generando código ESP32...';
      const code = await generateForActiveEditor();
      textarea.value = code;
      return code;
    }
    return textarea.value;
  }

  function enhanceModal() {
    const modal = document.getElementById('arduinoModal');
    if (!modal || modal.dataset.esp32Enhanced === '1') {
      applyModalMode();
      if (isESP32Selected()) { renderESP32PinsUI(false); refresh(); }
      return;
    }
    modal.dataset.esp32Enhanced = '1';
    ensureESP32Styles();
    ensureBoardOption(modal);
    ensureESP32Panel(modal);
    const boardSelect = modal.querySelector('#arduinoBoardSelect');
    if (boardSelect) {
      boardSelect.addEventListener('change', async function () {
        try { localStorage.setItem(BOARD_KEY, boardSelect.value); } catch (_) {}
        applyModalMode();
        if (isESP32Selected()) {
          await renderESP32PinsUI(false);
          await refresh();
        } else {
          const textarea = document.getElementById('arduinoCode');
          if (textarea) textarea.value = await generateLegacyForActiveEditor();
        }
      });
    }
    const refreshButton = modal.querySelector('#arduinoRefresh');
    if (refreshButton) refreshButton.addEventListener('click', function () { if (isESP32Selected()) setTimeout(refresh, 0); });
    const downloadButton = modal.querySelector('#arduinoDownload');
    if (downloadButton) {
      downloadButton.addEventListener('click', function (event) {
        if (!isESP32Selected()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const textarea = document.getElementById('arduinoCode');
        const code = textarea ? textarea.value : '';
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = 'simuplc_' + activeEditor() + '_esp32.ino';
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(function () { URL.revokeObjectURL(anchor.href); anchor.remove(); }, 0);
      }, true);
    }
    applyModalMode();
    if (isESP32Selected()) { renderESP32PinsUI(false); refresh(); }
  }

  function patchOpenModal() {
    if (typeof global.openArduinoModal !== 'function' || global.openArduinoModal.__esp32Wrapped) return false;
    const original = global.openArduinoModal;
    const wrapped = function () {
      const result = original.apply(this, arguments);
      setTimeout(function () {
        enhanceModal();
        if (isESP32Selected()) refresh();
      }, 0);
      return result;
    };
    wrapped.__esp32Wrapped = true;
    wrapped.__original = original;
    global.openArduinoModal = wrapped;
    return true;
  }

  // Integra el perfil con los validadores anteriores sin romper las placas Arduino.
  let legacyBoardProfile = typeof global.getArduinoBoardProfile === 'function' ? global.getArduinoBoardProfile : null;
  let legacyMaxPin = typeof global.getArduinoMaxPin === 'function' ? global.getArduinoMaxPin : null;
  function esp32BoardProfileHook() {
    if (isESP32Selected()) return { key: BOARD_ID, name: BOARD.name, maxPin: 39, inStart: 13, outStart: 23, note: 'ESP32 DevKit V1; AI en ADC1.' };
    return typeof legacyBoardProfile === 'function' ? legacyBoardProfile() : { key: 'uno', maxPin: 19, inStart: 2, outStart: 8 };
  }
  function esp32MaxPinHook() {
    if (isESP32Selected()) return 39;
    return typeof legacyMaxPin === 'function' ? legacyMaxPin() : 69;
  }
  function installBoardProfileHooks() {
    if (global.getArduinoBoardProfile !== esp32BoardProfileHook && typeof global.getArduinoBoardProfile === 'function') legacyBoardProfile = global.getArduinoBoardProfile;
    if (global.getArduinoMaxPin !== esp32MaxPinHook && typeof global.getArduinoMaxPin === 'function') legacyMaxPin = global.getArduinoMaxPin;
    global.getArduinoBoardProfile = esp32BoardProfileHook;
    global.getArduinoMaxPin = esp32MaxPinHook;
  }
  installBoardProfileHooks();

  const api = Object.freeze({
    version: VERSION,
    board: BOARD,
    isESP32Selected: isESP32Selected,
    getSelectedBoard: selectedBoard,
    getPinMap: loadPinMap,
    setPinMap: savePinMap,
    validatePinMap: validatePinMap,
    collectFBDSignals: collectFBDSignals,
    collectLadderSignals: collectLadderSignals,
    generateFBD: generateFBDESP32,
    generateLadder: generateLadderESP32,
    generateForActiveEditor: generateForActiveEditor,
    renderPins: renderESP32PinsUI,
    refresh: refresh,
    enhanceModal: enhanceModal,
    getDiagnostics: function () { return clone(diagnostics); }
  });
  global.SimuPLCESP32Codegen = api;

  function init() {
    if (global.__SIMUPLC_MCU_CONTROLLER_ACTIVE__) return;
    if (!patchOpenModal()) {
      const timer = setInterval(function () { if (patchOpenModal()) clearInterval(timer); }, 100);
      setTimeout(function () { clearInterval(timer); patchOpenModal(); }, 5000);
    }
    const observer = new MutationObserver(function () {
      const modal = document.getElementById('arduinoModal');
      if (modal && modal.dataset.esp32Enhanced !== '1') enhanceModal();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const existingModal = document.getElementById('arduinoModal');
    if (existingModal && existingModal.dataset.esp32Enhanced !== '1') enhanceModal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
