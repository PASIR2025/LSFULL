(function (global) {
  'use strict';

  if (global.SimuPLCMCUCodegen) return;

  const VERSION = '1.7.0-split-range-v10';
  const BOARD_KEY = 'logicsoft_arduino_board_v1';
  const PINMAP_KEY = 'simuplc_mcu_pinmap_v2';
  const OLD_ARDUINO_PINMAP_KEY = 'logicsoft_arduino_pinmap_v1';
  const OLD_ESP32_PINMAP_KEY = 'simuplc_esp32_pinmap_v1';

  const BOARD_PROFILES = Object.freeze({
    uno: Object.freeze({
      id: 'uno',
      name: 'Arduino UNO R3',
      family: 'avr',
      digitalInputs: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      outputs: Object.freeze([8, 9, 10, 11, 12, 13, 7, 6, 5, 4, 3, 2]),
      analogInputs: Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4', 'A5']),
      pwmOutputs: Object.freeze([3,5,6,9,10,11]),
      analogOutputs: Object.freeze([]),
      adcBits: 10,
      adcRawMax: 1023,
      note: 'Arduino UNO R3: 6 entradas analógicas A0–A5, ADC de 10 bits (0–1023).'
    }),
    nano: Object.freeze({
      id: 'nano',
      name: 'Arduino Nano (ATmega328P)',
      family: 'avr',
      digitalInputs: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      outputs: Object.freeze([8, 9, 10, 11, 12, 13, 7, 6, 5, 4, 3, 2]),
      analogInputs: Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']),
      pwmOutputs: Object.freeze([3,5,6,9,10,11]),
      analogOutputs: Object.freeze([]),
      adcBits: 10,
      adcRawMax: 1023,
      note: 'Arduino Nano clásico: 8 entradas analógicas A0–A7, ADC de 10 bits (0–1023).'
    }),
    mega: Object.freeze({
      id: 'mega',
      name: 'Arduino MEGA 2560',
      family: 'avr',
      digitalInputs: Object.freeze([22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]),
      outputs: Object.freeze([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 22, 23, 24, 25, 26, 27, 28, 29]),
      analogInputs: Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15']),
      pwmOutputs: Object.freeze([2,3,4,5,6,7,8,9,10,11,12,13,44,45,46]),
      analogOutputs: Object.freeze([]),
      adcBits: 10,
      adcRawMax: 1023,
      note: 'Arduino MEGA 2560: 16 entradas analógicas A0–A15, ADC de 10 bits (0–1023).'
    }),
    leonardo: Object.freeze({
      id: 'leonardo',
      name: 'Arduino Leonardo',
      family: 'avr',
      digitalInputs: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      outputs: Object.freeze([8, 9, 10, 11, 12, 13, 7, 6, 5, 4, 3, 2]),
      analogInputs: Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11']),
      pwmOutputs: Object.freeze([3,5,6,9,10,11,13]),
      analogOutputs: Object.freeze([]),
      adcBits: 10,
      adcRawMax: 1023,
      note: 'Arduino Leonardo: 12 entradas analógicas A0–A11, ADC de 10 bits (0–1023).'
    }),
    atmega328: Object.freeze({
      id: 'atmega328',
      name: 'ATmega328P standalone',
      family: 'avr',
      digitalInputs: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      outputs: Object.freeze([8, 9, 10, 11, 12, 13, 7, 6, 5, 4, 3, 2]),
      analogInputs: Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4', 'A5']),
      pwmOutputs: Object.freeze([3,5,6,9,10,11]),
      analogOutputs: Object.freeze([]),
      adcBits: 10,
      adcRawMax: 1023,
      note: 'ATmega328P con core Arduino: 6 canales analógicos A0–A5, ADC de 10 bits (0–1023).'
    }),
    esp32: Object.freeze({
      id: 'esp32',
      name: 'ESP32 DevKit V1 / WROOM-32',
      family: 'esp32',
      digitalInputs: Object.freeze([13, 14, 27, 26, 25, 32, 33, 4, 16, 17, 18, 19, 21, 22, 23]),
      outputs: Object.freeze([23, 22, 21, 19, 18, 17, 16, 25, 26, 27, 32, 33, 13, 14, 4]),
      analogInputs: Object.freeze([36, 39, 34, 35, 32, 33]),
      pwmOutputs: Object.freeze([23,22,21,19,18,17,16,25,26,27,32,33,13,14,4]),
      analogOutputs: Object.freeze([25,26]),
      adcBits: 12,
      adcRawMax: 4095,
      inputOnly: Object.freeze([34, 35, 36, 39]),
      strapping: Object.freeze([0, 2, 5, 12, 15]),
      serial: Object.freeze([1, 3]),
      note: 'ESP32 clásico: AI en ADC1, lectura de 12 bits (0–4095).'
    })
  });

  const diagnostics = {
    version: VERSION,
    refreshes: 0,
    staleResultsDiscarded: 0,
    lastBoard: null,
    lastEditor: null,
    lastSignals: null,
    lastError: null
  };

  let generationToken = 0;
  let modalObserver = null;

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
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

  function sortPLC(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    const lp = left.replace(/\d+/g, '').toUpperCase();
    const rp = right.replace(/\d+/g, '').toUpperCase();
    const ln = Number((left.match(/\d+/) || [99999])[0]);
    const rn = Number((right.match(/\d+/) || [99999])[0]);
    return lp.localeCompare(rp) || ln - rn || left.localeCompare(right);
  }

  function uniqueSorted(values) {
    return Array.from(new Set((values || []).filter(Boolean).map(String))).sort(sortPLC);
  }

  function getBoardId() {
    const select = document.getElementById('arduinoBoardSelect');
    if (select && select.value) return select.value;
    try { return localStorage.getItem(BOARD_KEY) || 'uno'; }
    catch (_) { return 'uno'; }
  }

  function getBoardProfile(boardId) {
    return BOARD_PROFILES[boardId] || BOARD_PROFILES.uno;
  }

  function activeEditor() {
    try {
      if (global.SimuPLCEditors && typeof global.SimuPLCEditors.activeEditor === 'function') {
        return global.SimuPLCEditors.activeEditor();
      }
    } catch (_) {}
    return document.body && document.body.classList.contains('mode-ladder') ? 'ladder' : 'fbd';
  }

  function flattenLadder(model) {
    const out = [];
    function walk(list) {
      (list || []).forEach(function (element) {
        if (!element) return;
        out.push(element);
        if (String(element.type || '').toUpperCase() === 'BRANCH') {
          (element.branches || []).forEach(walk);
        }
      });
    }
    (model && model.rungs || []).forEach(function (rung) { walk(rung.elements || []); });
    return out;
  }

  function collectFBDSignals(state) {
    if (global.SimuPLCESP32Codegen && typeof global.SimuPLCESP32Codegen.collectFBDSignals === 'function') {
      return global.SimuPLCESP32Codegen.collectFBDSignals(state || {});
    }
    const nodes = state && Array.isArray(state.nodes) ? state.nodes : [];
    return {
      digitalInputs: uniqueSorted(nodes.filter(function (n) { return cleanType(n.type) === 'input'; }).map(function (n, i) { return n.name || ('I' + (i + 1)); })),
      analogInputs: uniqueSorted(nodes.filter(function (n) { return cleanType(n.type) === 'analog_input'; }).map(function (n, i) { return n.name || ('AI' + (i + 1)); })),
      outputs: uniqueSorted(nodes.filter(function (n) { return cleanType(n.type) === 'output'; }).map(function (n, i) { return n.name || ('Q' + (i + 1)); })),
      pwmOutputs: uniqueSorted(nodes.filter(function (n) { return cleanType(n.type) === 'pwm_output'; }).map(function (n, i) { return n.name || ('PWM' + (i + 1)); })),
      analogOutputs: uniqueSorted(nodes.filter(function (n) { return cleanType(n.type) === 'analog_output'; }).map(function (n, i) { return n.name || ('AO' + (i + 1)); }))
    };
  }

  function collectLadderSignals(model) {
    if (global.SimuPLCESP32Codegen && typeof global.SimuPLCESP32Codegen.collectLadderSignals === 'function') {
      return global.SimuPLCESP32Codegen.collectLadderSignals(model || {});
    }
    const elements = flattenLadder(model);
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
    return {
      digitalInputs: uniqueSorted(digitalInputs),
      analogInputs: uniqueSorted(analogInputs),
      outputs: uniqueSorted(outputs),
      pwmOutputs: uniqueSorted(pwmOutputs),
      analogOutputs: uniqueSorted(analogOutputs)
    };
  }

  async function currentContext() {
    const editor = activeEditor();
    if (editor === 'ladder') {
      const state = global.SimuPLCEditors && typeof global.SimuPLCEditors.getLadderState === 'function'
        ? await global.SimuPLCEditors.getLadderState()
        : { rungs: [], proWires: [] };
      return { editor: editor, state: state || { rungs: [], proWires: [] }, signals: collectLadderSignals(state || {}) };
    }
    const state = global.SimuPLCEditors && typeof global.SimuPLCEditors.getFBDState === 'function'
      ? global.SimuPLCEditors.getFBDState()
      : (typeof global.serializeFBD === 'function' ? global.serializeFBD() : { nodes: [], connections: [] });
    return { editor: editor, state: state || { nodes: [], connections: [] }, signals: collectFBDSignals(state || {}) };
  }

  function emptyMap() {
    return { digitalInputs: {}, analogInputs: {}, outputs: {}, pwmOutputs: {}, analogOutputs: {} };
  }

  function loadAllMaps() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PINMAP_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }

  function migrateOldMap(boardId) {
    const output = emptyMap();
    try {
      if (boardId === 'esp32') {
        const old = JSON.parse(localStorage.getItem(OLD_ESP32_PINMAP_KEY) || '{}');
        if (old && typeof old === 'object') {
          output.digitalInputs = old.digitalInputs || {};
          output.analogInputs = old.analogInputs || {};
          output.outputs = old.outputs || {};
        }
      } else {
        const old = JSON.parse(localStorage.getItem(OLD_ARDUINO_PINMAP_KEY) || '{}');
        if (old && typeof old === 'object') {
          output.digitalInputs = old.inputs || {};
          output.outputs = old.outputs || {};
        }
      }
    } catch (_) {}
    return output;
  }

  function loadBoardMap(boardId) {
    const all = loadAllMaps();
    const map = all[boardId] && typeof all[boardId] === 'object' ? all[boardId] : migrateOldMap(boardId);
    map.digitalInputs = map.digitalInputs && typeof map.digitalInputs === 'object' ? map.digitalInputs : {};
    map.analogInputs = map.analogInputs && typeof map.analogInputs === 'object' ? map.analogInputs : {};
    map.outputs = map.outputs && typeof map.outputs === 'object' ? map.outputs : {};
    map.pwmOutputs = map.pwmOutputs && typeof map.pwmOutputs === 'object' ? map.pwmOutputs : {};
    map.analogOutputs = map.analogOutputs && typeof map.analogOutputs === 'object' ? map.analogOutputs : {};
    return map;
  }

  function saveBoardMap(boardId, map) {
    const all = loadAllMaps();
    const previous = all[boardId] && typeof all[boardId] === 'object' ? all[boardId] : emptyMap();
    const incoming = map && typeof map === 'object' ? map : emptyMap();
    // El generador trabaja con el editor activo, pero la tabla profesional administra
    // FBD y Ladder juntos. Por eso se fusionan los grupos y no se eliminan las
    // asignaciones del otro editor al regenerar código.
    all[boardId] = {
      digitalInputs: Object.assign({}, previous.digitalInputs || {}, incoming.digitalInputs || {}),
      analogInputs: Object.assign({}, previous.analogInputs || {}, incoming.analogInputs || {}),
      outputs: Object.assign({}, previous.outputs || {}, incoming.outputs || {}),
      pwmOutputs: Object.assign({}, previous.pwmOutputs || {}, incoming.pwmOutputs || {}),
      analogOutputs: Object.assign({}, previous.analogOutputs || {}, incoming.analogOutputs || {})
    };
    try { localStorage.setItem(PINMAP_KEY, JSON.stringify(all)); } catch (_) {}
  }

  function samePin(a, b) {
    return String(a) === String(b);
  }

  function validCandidate(value, candidates) {
    return candidates.some(function (candidate) { return samePin(candidate, value); });
  }

  function assignDefaults(labels, candidates, reserved) {
    const output = {};
    let cursor = 0;
    labels.forEach(function (label) {
      while (cursor < candidates.length && reserved.has(String(candidates[cursor]))) cursor += 1;
      let value = candidates[cursor];
      if (value == null) value = candidates.find(function (candidate) { return !reserved.has(String(candidate)); });
      if (value == null) value = candidates[labels.indexOf(label) % Math.max(1, candidates.length)];
      output[label] = value;
      reserved.add(String(value));
      cursor += 1;
    });
    return output;
  }

  function normalizeMap(signals, profile, existing, forceDefaults) {
    const output = emptyMap();
    const usedDigital = new Set();

    function choose(label, group, candidates, used) {
      const groupMap = existing && existing[group] && typeof existing[group] === 'object' ? existing[group] : null;
      const hasStored = !!groupMap && Object.prototype.hasOwnProperty.call(groupMap, label);
      const current = hasStored ? groupMap[label] : undefined;
      // Una asignación guardada se conserva tal cual para que la tabla profesional
      // pueda detectar pines repetidos, incompatibles o expresamente sin asignar.
      if (!forceDefaults && hasStored) {
        if (current == null || current === '' || current === '__UNASSIGNED__') return null;
        if (used) used.add(String(current));
        return current;
      }
      const candidate = candidates.find(function (value) { return !used || !used.has(String(value)); });
      const fallback = candidate != null ? candidate : (candidates.length ? candidates[0] : null);
      if (used && fallback != null) used.add(String(fallback));
      return fallback;
    }

    (signals.digitalInputs || []).forEach(function (label) {
      output.digitalInputs[label] = choose(label, 'digitalInputs', profile.digitalInputs, usedDigital);
    });
    (signals.outputs || []).forEach(function (label) { output.outputs[label] = choose(label, 'outputs', profile.outputs, usedDigital); });
    (signals.pwmOutputs || []).forEach(function (label) { output.pwmOutputs[label] = choose(label, 'pwmOutputs', profile.pwmOutputs || [], usedDigital); });
    (signals.analogOutputs || []).forEach(function (label) { output.analogOutputs[label] = choose(label, 'analogOutputs', profile.analogOutputs || [], usedDigital); });
    (signals.analogInputs || []).forEach(function (label) {
      output.analogInputs[label] = choose(label, 'analogInputs', profile.analogInputs, null);
    });
    return output;
  }

  function validateMap(signals, profile, map) {
    const errors = [];
    const warnings = [];
    const usedPhysical = new Map();

    function isMissing(value) {
      return value == null || value === '' || value === '__UNASSIGNED__';
    }

    function registerPhysical(label, value) {
      if (isMissing(value)) return;
      const key = String(value);
      if (!usedPhysical.has(key)) usedPhysical.set(key, []);
      usedPhysical.get(key).push(label);
    }

    function registerDigital(label, value, kind, candidates) {
      if (isMissing(value)) {
        errors.push(label + ': variable sin pin asignado.');
        return;
      }
      if (!validCandidate(value, candidates)) errors.push(label + ': pin no válido para ' + profile.name + '.');
      registerPhysical(label, value);
      if (profile.id === 'esp32') {
        const pin = Number(value);
        if (kind === 'out' && (profile.inputOnly || []).includes(pin)) errors.push(label + ': GPIO ' + pin + ' es solo entrada.');
        if (kind === 'in' && (profile.inputOnly || []).includes(pin)) errors.push(label + ': GPIO ' + pin + ' no tiene INPUT_PULLUP interno.');
        if ((profile.strapping || []).includes(pin)) warnings.push(label + ': GPIO ' + pin + ' es pin de arranque.');
        if ((profile.serial || []).includes(pin)) warnings.push(label + ': GPIO ' + pin + ' se usa normalmente para Serial.');
      } else if (Number(value) === 0 || Number(value) === 1) {
        warnings.push(label + ': D0/D1 suelen usarse para Serial.');
      }
    }

    (signals.digitalInputs || []).forEach(function (label) { registerDigital(label, map.digitalInputs[label], 'in', profile.digitalInputs); });
    (signals.outputs || []).forEach(function (label) { registerDigital(label, map.outputs[label], 'out', profile.outputs); });
    (signals.pwmOutputs || []).forEach(function (label) { registerDigital(label, map.pwmOutputs[label], 'out', profile.pwmOutputs || []); });
    (signals.analogOutputs || []).forEach(function (label) {
      const value=map.analogOutputs[label];
      if (!(profile.analogOutputs || []).length) { errors.push(label + ': la placa ' + profile.name + ' no tiene salida DAC real. Usa PWM.'); return; }
      registerDigital(label,value,'out',profile.analogOutputs||[]);
    });
    (signals.analogInputs || []).forEach(function (label) {
      const value = map.analogInputs[label];
      if (isMissing(value)) {
        errors.push(label + ': variable sin pin analógico asignado.');
        return;
      }
      if (!validCandidate(value, profile.analogInputs)) errors.push(label + ': entrada analógica no válida para ' + profile.name + '.');
      registerPhysical(label, value);
    });

    usedPhysical.forEach(function (labels, pin) {
      if (labels.length > 1) errors.push('Pin ' + pin + ' repetido: ' + labels.join(', ') + '.');
    });

    return { ok: errors.length === 0, errors: uniqueSorted(errors), warnings: uniqueSorted(warnings) };
  }

  function adaptAnalogDefaultsForBoard(state, editor, profile) {
    const copy = clone(state || {});
    if (profile.id === 'esp32') return copy;
    if (editor === 'fbd') {
      (copy.nodes || []).forEach(function (node) {
        if (cleanType(node.type) !== 'analog_input') return;
        node.params = node.params || {};
        node.params.analog = Object.assign({}, node.params.analog || {}, node.analog || {});
        const analog = node.params.analog;
        const rawMin = Number(analog.rawMin);
        const rawMax = Number(analog.rawMax);
        if (!Number.isFinite(rawMin)) analog.rawMin = 0;
        if (!Number.isFinite(rawMax) || rawMax === 4095) analog.rawMax = profile.adcRawMax;
        node.analog = Object.assign({}, analog);
      });
    } else {
      flattenLadder(copy).forEach(function (element) {
        if (cleanType(element.type) !== 'analog_input') return;
        const rawMax = Number(element.rawMax);
        if (!Number.isFinite(Number(element.rawMin))) element.rawMin = 0;
        if (!Number.isFinite(rawMax) || rawMax === 4095) element.rawMax = profile.adcRawMax;
      });
    }
    return copy;
  }

  function transformESP32CodeForBoard(code, profile, editor) {
    if (profile.id === 'esp32') return code;
    let output = String(code || '');
    output = output.replace(/ARDUINO_ARCH_ESP32/g, 'SIMUPLC_ARCH_TARGET_TOKEN');
    output = output.replace(/ESP32 DevKit V1 \/ WROOM-32/g, profile.name);
    output = output.replace(/ESP32 clásico/g, profile.name);
    output = output.replace(/SimuPLC Lab ([^\n]+) - ESP32 desde FBD/g, 'SimuPLC Lab ' + VERSION + ' - ' + profile.name + ' desde FBD');
    output = output.replace(/SimuPLC Lab ([^\n]+) - ESP32 desde Ladder/g, 'SimuPLC Lab ' + VERSION + ' - ' + profile.name + ' desde Ladder');
    output = output.replace(/Entradas analogicas: ADC de 12 bits \(0\.\.4095\)\./g, 'Entradas analógicas: ADC de ' + profile.adcBits + ' bits (0..' + profile.adcRawMax + ').');
    output = output.replace(/^\s*analogReadResolution\(12\);\s*\n/gm, '');
    output = output.replace(/GPIO/g, 'pin');
    output = output.replace(/ESP32/g, profile.name);
    output = output.replace(/SIMUPLC_ARCH_TARGET_TOKEN/g, 'ARDUINO_ARCH_ESP32');
    return output;
  }

  function variableDescription(label) {
    try {
      const catalog = JSON.parse(localStorage.getItem('simuplc_variable_catalog_v1') || '{}');
      const entry = catalog && catalog.variables && catalog.variables[label];
      return String(entry && entry.description || '').replace(/[\r\n]+/g, ' ').trim();
    } catch (_) { return ''; }
  }

  function injectNamedPinConstants(code, context, map) {
    if (context.editor !== 'fbd') {
      const labels = [].concat(context.signals.digitalInputs || [], context.signals.analogInputs || [], context.signals.outputs || [], context.signals.pwmOutputs || [], context.signals.analogOutputs || []);
      const bySafeName = {};
      labels.forEach(function (label) { bySafeName[safeName(label)] = label; });
      return String(code || '').replace(/^const uint8_t PIN_([A-Za-z0-9_]+) = ([^;]+);(?:\s*\/\/.*)?$/gm, function (line, safe, value) {
        const original = bySafeName[safe] || safe;
        const description = variableDescription(original);
        return 'const uint8_t PIN_' + safe + ' = ' + value + ';' + (description ? ' // ' + description : '');
      });
    }
    const lines = [];
    lines.push('// Asignación física de variables PLC');
    (context.signals.digitalInputs || []).forEach(function (label) {
      lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + map.digitalInputs[label] + ';' + (variableDescription(label) ? ' // ' + variableDescription(label) : ''));
    });
    (context.signals.analogInputs || []).forEach(function (label) {
      lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + map.analogInputs[label] + ';' + (variableDescription(label) ? ' // ' + variableDescription(label) : ''));
    });
    (context.signals.outputs || []).forEach(function (label) {
      lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + map.outputs[label] + ';' + (variableDescription(label) ? ' // ' + variableDescription(label) : ''));
    });
    (context.signals.pwmOutputs || []).forEach(function (label) { lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + map.pwmOutputs[label] + ';' + (variableDescription(label) ? ' // ' + variableDescription(label) : '')); });
    (context.signals.analogOutputs || []).forEach(function (label) { lines.push('const uint8_t PIN_' + safeName(label) + ' = ' + map.analogOutputs[label] + ';' + (variableDescription(label) ? ' // ' + variableDescription(label) : '')); });
    lines.push('');
    const marker = 'const uint8_t digitalInputPins';
    const position = String(code).indexOf(marker);
    if (position < 0) return lines.join('\n') + String(code);
    return String(code).slice(0, position) + lines.join('\n') + String(code).slice(position);
  }

  async function generate(context, boardId, map) {
    const profile = getBoardProfile(boardId);
    if (!global.SimuPLCESP32Codegen) throw new Error('Motor MCU base no disponible.');
    const adaptedState = adaptAnalogDefaultsForBoard(context.state, context.editor, profile);
    map.__boardProfile = { id: profile.id, family: profile.family, adcBits: profile.adcBits, adcRawMax: profile.adcRawMax, name: profile.name };
    let code;
    if (context.editor === 'ladder') {
      code = global.SimuPLCESP32Codegen.generateLadder(adaptedState, map);
    } else {
      code = global.SimuPLCESP32Codegen.generateFBD(adaptedState, map);
    }
    code = transformESP32CodeForBoard(code, profile, context.editor);
    return injectNamedPinConstants(code, context, map);
  }

  function ensureBoardOptions() {
    const select = document.getElementById('arduinoBoardSelect');
    if (!select) return;
    const labels = {
      uno: 'Arduino UNO R3',
      nano: 'Arduino Nano (ATmega328P)',
      mega: 'Arduino MEGA 2560',
      leonardo: 'Arduino Leonardo',
      atmega328: 'ATmega328P standalone',
      esp32: 'ESP32 DevKit V1 / WROOM-32'
    };
    Object.keys(labels).forEach(function (id) {
      let option = select.querySelector('option[value="' + id + '"]');
      if (!option) {
        option = document.createElement('option');
        option.value = id;
        select.appendChild(option);
      }
      if (option.textContent !== labels[id]) option.textContent = labels[id];
    });
    const stored = getBoardId();
    if (BOARD_PROFILES[stored]) select.value = stored;
  }

  function ensureStyles() {
    if (document.getElementById('simuplc-mcu-codegen-style')) return;
    const style = document.createElement('style');
    style.id = 'simuplc-mcu-codegen-style';
    style.textContent = `
      #mcuPinsPanel{padding:12px;border-radius:16px;margin:10px 0 12px;border:1px solid transparent}
      #arduinoCard[data-theme="light"] #mcuPinsPanel{background:linear-gradient(180deg,#fff,#f5fbff);border-color:#cfe5f3;box-shadow:0 8px 22px rgba(30,100,140,.10)}
      #arduinoCard[data-theme="dark"] #mcuPinsPanel{background:rgba(3,24,36,.55);border-color:rgba(103,232,249,.20)}
      #mcuPinsPanel .title{font-size:13px;font-weight:900;margin-bottom:2px}
      #mcuPinsPanel .sub2{font-size:12px;color:#52707d;margin-bottom:9px;line-height:1.35}
      #arduinoCard[data-theme="dark"] #mcuPinsPanel .sub2{color:#b7d7e1}
      .mcu-pin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}
      .mcu-pin-col{border:1px solid rgba(14,116,144,.18);border-radius:12px;padding:8px;background:rgba(236,254,255,.48)}
      #arduinoCard[data-theme="dark"] .mcu-pin-col{background:rgba(8,47,73,.30)}
      .mcu-pin-col h4{font-size:11px;margin:0 0 6px;color:#075985;text-transform:uppercase;letter-spacing:.05em}
      #arduinoCard[data-theme="dark"] .mcu-pin-col h4{color:#67e8f9}
      .mcu-pin-row{display:grid;grid-template-columns:minmax(44px,1fr) 112px;gap:7px;align-items:center;padding:5px 2px}
      .mcu-pin-row label{font-size:12px;font-weight:900;overflow:hidden;text-overflow:ellipsis}
      .mcu-pin-row select{width:100%;padding:6px;border-radius:8px;border:1px solid #9fc8d4;background:#fff;color:#102a36;font-weight:800}
      #arduinoCard[data-theme="dark"] .mcu-pin-row select{background:#071724;color:#e5f7fb;border-color:#31566a}
      #mcuPinsFooter{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:9px}
      #mcuPinsReset{padding:7px 10px;border-radius:9px;border:1px solid #82bfce;background:#fff;font-weight:900;cursor:pointer}
      #mcuPinsMessages{font-size:11px;line-height:1.4;flex:1;min-width:200px}
      #mcuPinsMessages .error{color:#b91c1c;font-weight:800}.mcu-warning{color:#a16207;font-weight:800}
      @media(max-width:780px){.mcu-pin-grid{grid-template-columns:1fr}.mcu-pin-row{grid-template-columns:minmax(52px,1fr) 125px}}
      #arduinoModal{overflow:hidden!important;overscroll-behavior:contain}
      #arduinoCard{box-sizing:border-box;min-height:0;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}
      @media(max-width:900px), (max-height:680px){
        #arduinoModal{padding:4px!important;align-items:stretch!important}
        #arduinoCard{width:100%!important;height:calc(100dvh - 8px)!important;max-height:none!important;border-radius:14px!important;padding:8px 9px 7px!important}
        #arduinoHeader{position:sticky;top:-8px;z-index:30;margin:-8px -9px 7px!important;padding:9px 10px 7px!important;background:inherit;box-shadow:0 1px 0 rgba(100,116,139,.18)}
        #arduinoActions{position:sticky;bottom:-7px;z-index:30;margin:9px -9px -7px!important;padding:7px 9px!important;background:inherit;border-top:1px solid rgba(100,116,139,.18)}
        #arduinoHint{margin:6px 0!important;padding:8px 9px!important}
        #arduinoBoardBox,#arduinoOutputBox,#mcuPinsPanel{margin:6px 0!important;padding:8px!important}
        #arduinoCode{min-height:220px!important;height:42dvh;resize:vertical}
      }
      @media(orientation:landscape) and (max-height:600px){
        #arduinoCard{height:calc(100dvh - 4px)!important;padding:6px 8px!important}
        #arduinoHeader{top:-6px;margin:-6px -8px 5px!important;padding:6px 9px!important;align-items:center}
        #arduinoHeader h3{font-size:14px!important}#arduinoHeader .sub{display:none}#arduinoHeaderRight{flex-wrap:nowrap}#arduinoThemeToggle,#arduinoClose{padding:5px 7px!important;font-size:11px}
        #arduinoHint{font-size:10px!important;line-height:1.3!important;padding:6px 8px!important}
        #arduinoBoardBox .sub2,#mcuPinsPanel .sub2{display:none}
        .mcu-pin-grid{grid-template-columns:repeat(auto-fit,minmax(190px,1fr));overflow-x:auto;padding-bottom:3px;scrollbar-width:thin}
        .mcu-pin-col{padding:6px}.mcu-pin-row{grid-template-columns:minmax(42px,1fr) 105px;padding:3px 1px}.mcu-pin-row select{padding:4px;font-size:11px}
        #arduinoCode{min-height:150px!important;height:44dvh}
        #arduinoActions{bottom:-6px;margin:6px -8px -6px!important;padding:5px 8px!important}
        #arduinoActions button{padding:6px 8px!important;font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    const modal = document.getElementById('arduinoModal');
    if (!modal) return null;
    let panel = document.getElementById('mcuPinsPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'mcuPinsPanel';
      panel.innerHTML = '<div class="title">Asignación de pines MCU</div><div class="sub2"></div><div class="mcu-pin-grid"></div><div id="mcuPinsFooter"><button id="mcuPinsReset" type="button">Restaurar pines seguros</button><div id="mcuPinsMessages"></div></div>';
      const oldPins = document.getElementById('arduinoPins');
      if (oldPins && oldPins.parentNode) oldPins.parentNode.insertBefore(panel, oldPins.nextSibling);
      else {
        const code = document.getElementById('arduinoCode');
        if (code && code.parentNode) code.parentNode.insertBefore(panel, code);
      }
      panel.querySelector('#mcuPinsReset').addEventListener('click', function () { refreshAll(true); });
    }
    const oldPins = document.getElementById('arduinoPins');
    const oldESP32 = document.getElementById('esp32PinsPanel');
    if (oldPins) oldPins.style.display = 'none';
    if (oldESP32) oldESP32.style.display = 'none';
    return panel;
  }

  function pinOptionMarkup(values, current, profile) {
    let html = '<option value=""' + (current == null || current === '' ? ' selected' : '') + '>Sin asignar</option>';
    const validCurrent = values.some(function (value) { return samePin(value, current); });
    if (current != null && current !== '' && !validCurrent) {
      html += '<option value="' + current + '" selected>⚠ ' + current + ' (incompatible)</option>';
    }
    html += values.map(function (value) {
      const label = profile.id === 'esp32' && typeof value === 'number' ? ('GPIO ' + value) : String(value).match(/^A/) ? String(value) : ('D' + value);
      return '<option value="' + value + '"' + (samePin(value, current) ? ' selected' : '') + '>' + label + '</option>';
    }).join('');
    return html;
  }

  function renderMessages(validation) {
    const target = document.getElementById('mcuPinsMessages');
    if (!target) return;
    const chunks = [];
    if (validation.errors.length) chunks.push('<div class="error">' + validation.errors.join('<br>') + '</div>');
    if (validation.warnings.length) chunks.push('<div class="mcu-warning">' + validation.warnings.join('<br>') + '</div>');
    if (!chunks.length) chunks.push('<div style="color:#087f5b;font-weight:900">Asignación válida.</div>');
    target.innerHTML = chunks.join('');
  }

  function renderPanel(context, boardId, map) {
    const panel = ensurePanel();
    if (!panel) return;
    const profile = getBoardProfile(boardId);
    const subtitle = panel.querySelector('.sub2');
    if (subtitle) subtitle.textContent = profile.note + ' Las entradas digitales usan INPUT_PULLUP.';
    const groups = [
      { key: 'digitalInputs', title: 'Entradas digitales I', values: profile.digitalInputs },
      { key: 'analogInputs', title: 'Entradas analógicas AI', values: profile.analogInputs },
      { key: 'outputs', title: 'Salidas digitales Q', values: profile.outputs },
      { key: 'pwmOutputs', title: 'Salidas PWM', values: profile.pwmOutputs || [] },
      { key: 'analogOutputs', title: 'Salidas analógicas AO (DAC)', values: profile.analogOutputs || [] }
    ];
    const grid = panel.querySelector('.mcu-pin-grid');
    grid.innerHTML = '';
    groups.forEach(function (group) {
      const column = document.createElement('div');
      column.className = 'mcu-pin-col';
      column.innerHTML = '<h4>' + group.title + '</h4>';
      (context.signals[group.key] || []).forEach(function (label) {
        const row = document.createElement('div');
        row.className = 'mcu-pin-row';
        row.innerHTML = '<label title="' + label + '">' + label + '</label><select data-group="' + group.key + '" data-label="' + label + '">' + pinOptionMarkup(group.values, map[group.key][label], profile) + '</select>';
        column.appendChild(row);
      });
      if (!(context.signals[group.key] || []).length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;color:#78909c;padding:5px 2px';
        empty.textContent = 'Sin variables';
        column.appendChild(empty);
      }
      grid.appendChild(column);
    });
    panel.querySelectorAll('select[data-group]').forEach(function (select) {
      select.addEventListener('change', function () {
        const current = loadBoardMap(boardId);
        current[select.dataset.group] = current[select.dataset.group] || {};
        const raw = select.value;
        current[select.dataset.group][select.dataset.label] = raw === '' ? null : (/^-?\d+$/.test(raw) ? Number(raw) : raw);
        saveBoardMap(boardId, current);
        refreshAll(false);
      });
    });
    renderMessages(validateMap(context.signals, profile, map));
  }

  function applyModalLabels(boardId) {
    const profile = getBoardProfile(boardId);
    const title = document.querySelector('#arduinoHeader h3');
    const subtitle = document.querySelector('#arduinoHeader .sub');
    const boardInfo = document.getElementById('arduinoBoardInfo');
    const hint = document.getElementById('arduinoHint');
    const download = document.getElementById('arduinoDownload');
    const modeBox = document.getElementById('arduinoModeBox');
    if (title) title.textContent = 'Generador ' + profile.name + ' (.ino)';
    if (subtitle) subtitle.textContent = 'FBD o Ladder → código estable para ' + profile.name;
    if (boardInfo) boardInfo.textContent = profile.note;
    if (hint) hint.innerHTML = '<b>Generador USB/OTG analógico:</b> genera I, AI, Q, PWM, AO, PID y SPLIT con protocolo Serial a 115200 baudios para Arduino y ESP32. Incluye HELLO, PING, GET_STATE, MODE, SET, SETA, RUN y STOP sin bloquear el ciclo PLC.';
    if (download) download.textContent = '⬇ Descargar ' + (profile.id === 'esp32' ? 'ESP32 ' : 'Arduino ') + '.ino';
    if (modeBox) modeBox.style.display = 'none';
    const button = document.getElementById('btnArduino');
    if (button) {
      const img = button.querySelector('img');
      button.innerHTML = '';
      if (img) button.appendChild(img);
      button.appendChild(document.createTextNode('CÓDIGO MCU'));
    }
  }

  async function refreshAll(forceDefaults) {
    const token = ++generationToken;
    const textarea = document.getElementById('arduinoCode');
    if (textarea) textarea.value = '// Leyendo el proyecto y generando código...';
    try {
      ensureStyles();
      ensureBoardOptions();
      const boardId = getBoardId();
      const profile = getBoardProfile(boardId);
      const context = await currentContext();
      if (token !== generationToken) { diagnostics.staleResultsDiscarded += 1; return ''; }
      // La tabla no necesita abrirse: al generar código se crean y guardan en silencio
      // los pines predeterminados de todas las variables FBD/Ladder para la placa activa.
      if (!forceDefaults && global.SimuPLCVariableManager && typeof global.SimuPLCVariableManager.ensureDefaults === 'function') {
        try { await global.SimuPLCVariableManager.ensureDefaults(boardId); }
        catch (syncError) { console.warn('[SimuPLC] No se pudo sincronizar la tabla de variables en segundo plano.', syncError); }
      }
      if (token !== generationToken) { diagnostics.staleResultsDiscarded += 1; return ''; }
      const map = normalizeMap(context.signals, profile, loadBoardMap(boardId), !!forceDefaults);
      saveBoardMap(boardId, map);
      renderPanel(context, boardId, map);
      applyModalLabels(boardId);
      const validation = validateMap(context.signals, profile, map);
      let code;
      if (!validation.ok) {
        code = '/*\n  No se pudo generar por errores de asignación:\n  - ' + validation.errors.join('\n  - ') + '\n*/';
      } else {
        code = await generate(context, boardId, map);
        if (validation.warnings.length) code = '/* ADVERTENCIAS:\n - ' + validation.warnings.join('\n - ') + '\n*/\n\n' + code;
      }
      if (token !== generationToken) { diagnostics.staleResultsDiscarded += 1; return ''; }
      if (textarea) textarea.value = code;
      diagnostics.refreshes += 1;
      diagnostics.lastBoard = boardId;
      diagnostics.lastEditor = context.editor;
      diagnostics.lastSignals = clone(context.signals);
      diagnostics.lastError = null;
      return code;
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      diagnostics.lastError = message;
      if (textarea && token === generationToken) textarea.value = '/* Error del generador MCU: ' + message + ' */';
      return '';
    }
  }

  function openModalStable() {
    if (typeof global.openArduinoModal === 'function') global.openArduinoModal();
    setTimeout(function () { refreshAll(false); }, 60);
  }

  function installCaptureHandlers() {
    global.addEventListener('click', function (event) {
      const button = event.target && event.target.closest ? event.target.closest('#btnArduino') : null;
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openModalStable();
        return;
      }
      const refresh = event.target && event.target.closest ? event.target.closest('#arduinoRefresh') : null;
      if (refresh) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        refreshAll(false);
        return;
      }
      const download = event.target && event.target.closest ? event.target.closest('#arduinoDownload') : null;
      if (download) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const code = document.getElementById('arduinoCode');
        const boardId = getBoardId();
        const blob = new Blob([code ? code.value : ''], { type: 'text/plain;charset=utf-8' });
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = 'simuplc_' + activeEditor() + '_' + boardId + '.ino';
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(function () { URL.revokeObjectURL(anchor.href); anchor.remove(); }, 0);
      }
    }, true);

    global.addEventListener('change', function (event) {
      const select = event.target && event.target.closest ? event.target.closest('#arduinoBoardSelect') : null;
      if (!select) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try { localStorage.setItem(BOARD_KEY, select.value); } catch (_) {}
      refreshAll(false);
    }, true);
  }

  function observeModal() {
    if (modalObserver) return;
    modalObserver = new MutationObserver(function () {
      const modal = document.getElementById('arduinoModal');
      if (!modal) return;
      ensureBoardOptions();
      ensureStyles();
      ensurePanel();
    });
    modalObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  global.SimuPLCMCUCodegen = Object.freeze({
    version: VERSION,
    boards: BOARD_PROFILES,
    refresh: refreshAll,
    getBoard: getBoardId,
    getBoardProfile: function () { return getBoardProfile(getBoardId()); },
    getBoardMap: function (boardId) { return clone(loadBoardMap(boardId || getBoardId())); },
    saveBoardMap: function (boardId, map) { saveBoardMap(boardId || getBoardId(), clone(map || emptyMap())); return true; },
    validatePinMap: function (signals, boardId, map) { const profile = getBoardProfile(boardId || getBoardId()); return clone(validateMap(signals || {digitalInputs:[],analogInputs:[],outputs:[],pwmOutputs:[],analogOutputs:[]}, profile, map || loadBoardMap(profile.id))); },
    normalizePinMap: function (signals, boardId, map, forceDefaults) { const profile = getBoardProfile(boardId || getBoardId()); return clone(normalizeMap(signals || {digitalInputs:[],analogInputs:[],outputs:[],pwmOutputs:[],analogOutputs:[]}, profile, map || loadBoardMap(profile.id), !!forceDefaults)); },
    collectFBDSignals: function (state) { return clone(collectFBDSignals(state || {})); },
    collectLadderSignals: function (state) { return clone(collectLadderSignals(state || {})); },
    getCurrentContext: currentContext,
    setBoard: function (boardId) { if (!BOARD_PROFILES[boardId]) return false; try { localStorage.setItem(BOARD_KEY, boardId); } catch (_) {} const select=document.getElementById('arduinoBoardSelect'); if(select)select.value=boardId; return true; },
    // API programática para pruebas y futuras integraciones (HMI/IoT).
    generateFromState: async function (editor, state, boardId, pinMap) {
      const normalizedEditor = editor === 'ladder' ? 'ladder' : 'fbd';
      const signals = normalizedEditor === 'ladder' ? collectLadderSignals(state || {}) : collectFBDSignals(state || {});
      const profile = getBoardProfile(boardId || 'uno');
      const map = normalizeMap(signals, profile, pinMap || emptyMap(), false);
      const validation = validateMap(signals, profile, map);
      if (!validation.ok) throw new Error(validation.errors.join(' | '));
      return generate({ editor: normalizedEditor, state: clone(state || {}), signals: signals }, profile.id, map);
    },
    getDiagnostics: function () { return clone(diagnostics); }
  });

  function init() {
    installCaptureHandlers();
    observeModal();
    ensureBoardOptions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
