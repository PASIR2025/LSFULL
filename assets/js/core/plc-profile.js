(function (global) {
  'use strict';

  if (global.SimuPLCPLCProfile) return;

  const VERSION = '16.0.0';
  const STORAGE_KEY = 'simuplc_plc_profile_v16';
  const DEFAULT_PROFILE = 'classic';
  const BOARD_KEY = 'logicsoft_arduino_board_v1';
  const PINMAP_KEY = 'simuplc_mcu_pinmap_v2';
  const META_KEY = 'simuplc_variable_catalog_v1';

  const PROFILES = Object.freeze({
    classic: Object.freeze({
      id: 'classic', label: 'SimuPLC actual', short: 'I1 / Q1', addressMode: 'sequential', mcu: 'any', recommendedBoard: null,
      description: 'Compatibilidad con proyectos anteriores y selección libre de placa MCU.'
    }),
    s71200: Object.freeze({
      id: 's71200', label: 'Siemens S7-1200', short: 'I0.0 / Q0.0', addressMode: 'byte_bit', mcu: null, recommendedBoard: null,
      description: 'Direccionamiento digital por byte.bit.'
    }),
    logo8: Object.freeze({
      id: 'logo8', label: 'Siemens LOGO! 8', short: 'I1 / Q1', addressMode: 'sequential', mcu: null, recommendedBoard: null,
      description: 'Direccionamiento secuencial LOGO!.'
    }),
    arduino_plc: Object.freeze({
      id: 'arduino_plc', label: 'PLC con Arduino', short: 'I0.0 / Q0.0', addressMode: 'byte_bit', mcu: 'arduino', recommendedBoard: 'uno',
      description: 'Direcciones PLC lógicas traducidas a pines de Arduino.'
    }),
    esp32_plc: Object.freeze({
      id: 'esp32_plc', label: 'PLC con ESP32', short: 'I0.0 / Q0.0', addressMode: 'byte_bit', mcu: 'esp32', recommendedBoard: 'esp32',
      description: 'Direcciones PLC lógicas traducidas a GPIO de ESP32.'
    })
  });

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
  }

  function safeProfileId(id) { return PROFILES[id] ? id : DEFAULT_PROFILE; }
  function readStored() {
    try { return safeProfileId(localStorage.getItem(STORAGE_KEY) || DEFAULT_PROFILE); }
    catch (_) { return DEFAULT_PROFILE; }
  }
  let currentId = readStored();

  function getProfile(id) { return PROFILES[safeProfileId(id || currentId)]; }
  function get() { return getProfile(currentId); }
  function getId() { return currentId; }

  // I0.0 => slot 0, I0.7 => slot 7, I1.0 => slot 8, I10.0 => slot 80.
  // I1 => slot 0, I8 => slot 7, I9 => slot 8.
  function parseAddress(value) {
    const s = String(value || '').trim().toUpperCase();
    let m = s.match(/^([IQ])(\d+)\.(\d+)$/);
    if (m) {
      const byte = parseInt(m[2], 10);
      const bit = parseInt(m[3], 10);
      if (!Number.isFinite(byte) || !Number.isFinite(bit) || byte < 0 || bit < 0 || bit > 7) return null;
      return { area: m[1], slot: byte * 8 + bit, byte: byte, bit: bit, mode: 'byte_bit', raw: s };
    }
    m = s.match(/^([IQ])(\d+)$/);
    if (m) {
      const n = parseInt(m[2], 10);
      if (!Number.isFinite(n) || n < 1) return null;
      return { area: m[1], slot: n - 1, byte: Math.floor((n - 1) / 8), bit: (n - 1) % 8, mode: 'sequential', raw: s };
    }
    return null;
  }

  function formatAddress(area, slot, profileId) {
    const p = getProfile(profileId);
    const normalizedArea = String(area || 'I').toUpperCase() === 'Q' ? 'Q' : 'I';
    const n = Math.max(0, parseInt(slot, 10) || 0);
    return p.addressMode === 'byte_bit'
      ? normalizedArea + Math.floor(n / 8) + '.' + (n % 8)
      : normalizedArea + (n + 1);
  }

  function translateAddress(value, profileId) {
    const parsed = parseAddress(value);
    return parsed ? formatAddress(parsed.area, parsed.slot, profileId) : value;
  }

  function addressOrdinal(value) {
    const parsed = parseAddress(value);
    return parsed ? parsed.slot : NaN;
  }

  function editNumberForName(value) {
    const parsed = parseAddress(value);
    return parsed ? parsed.slot + 1 : NaN;
  }

  function formatFromEditNumber(area, number, profileId) {
    const n = Math.max(1, parseInt(number, 10) || 1);
    return formatAddress(area, n - 1, profileId);
  }

  function cppIdentifier(value) {
    let output = String(value == null ? '' : value).trim();
    output = output.normalize ? output.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : output;
    output = output.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_');
    if (!output) output = 'X';
    if (/^[0-9]/.test(output)) output = '_' + output;
    return output;
  }

  function transformString(value, profileId) {
    const raw = String(value || '');
    const direct = parseAddress(raw);
    if (direct) return formatAddress(direct.area, direct.slot, profileId);

    // Listas de tags HMI: Q1,Q2 o I0.0;I0.1. No modifica textos explicativos.
    if (/^\s*[IQ]\d+(?:\.\d+)?(?:\s*[,;]\s*[IQ]\d+(?:\.\d+)?)+\s*$/i.test(raw)) {
      return raw.split(/([,;])/).map(function (part) {
        const p = parseAddress(part.trim());
        return p ? formatAddress(p.area, p.slot, profileId) : part;
      }).join('');
    }
    return raw;
  }

  function transformObject(value, profileId, seen) {
    if (typeof value === 'string') return transformString(value, profileId);
    if (!value || typeof value !== 'object') return value;
    seen = seen || new WeakSet();
    if (seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) value[i] = transformObject(value[i], profileId, seen);
    } else {
      Object.keys(value).forEach(function (key) {
        value[key] = transformObject(value[key], profileId, seen);
      });
    }
    return value;
  }

  function translatedClone(value, profileId) {
    const result = clone(value);
    return transformObject(result, profileId || currentId);
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

  function translateKeyedObject(object, profileId) {
    if (!object || typeof object !== 'object') return object;
    const next = {};
    Object.keys(object).forEach(function (key) {
      const translated = translateAddress(key, profileId);
      next[translated] = object[key];
    });
    return next;
  }

  // Conserva asignaciones de pines y descripciones cuando cambia I1 <-> I0.0.
  function migrateVariableStorage(profileId) {
    const allMaps = loadJSON(PINMAP_KEY, {});
    Object.keys(allMaps || {}).forEach(function (boardId) {
      const boardMap = allMaps[boardId];
      if (!boardMap || typeof boardMap !== 'object') return;
      ['digitalInputs', 'outputs'].forEach(function (group) {
        if (boardMap[group] && typeof boardMap[group] === 'object') {
          boardMap[group] = translateKeyedObject(boardMap[group], profileId);
        }
      });
    });
    saveJSON(PINMAP_KEY, allMaps);

    const meta = loadJSON(META_KEY, { variables: {} });
    if (meta.variables && typeof meta.variables === 'object') meta.variables = translateKeyedObject(meta.variables, profileId);
    saveJSON(META_KEY, meta);
  }

  function applyRecommendedBoard() {
    const p = get();
    try {
      const currentBoard = localStorage.getItem(BOARD_KEY) || 'uno';
      if (p.mcu === 'esp32') localStorage.setItem(BOARD_KEY, 'esp32');
      else if (p.mcu === 'arduino' && currentBoard === 'esp32') localStorage.setItem(BOARD_KEY, p.recommendedBoard || 'uno');
    } catch (_) {}
  }

  function emitChange(previousId, options) {
    options = options || {};
    try {
      global.dispatchEvent(new CustomEvent('simuplc-plc-profile-changed', {
        detail: {
          previousId: previousId,
          id: currentId,
          profile: clone(get()),
          migrate: options.migrate !== false,
          source: options.source || 'api'
        }
      }));
    } catch (_) {}
  }

  function set(id, options) {
    options = options || {};
    const nextId = safeProfileId(id);
    const previousId = currentId;
    currentId = nextId;
    if (options.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, currentId); } catch (_) {}
    }
    if (options.migrateStorage !== false && previousId !== currentId) migrateVariableStorage(currentId);
    applyRecommendedBoard();
    if (options.emit !== false) emitChange(previousId, options);
    return get();
  }

  function variableCatalog(area, count, profileId) {
    const output = [];
    for (let i = 0; i < Math.max(0, Number(count) || 0); i += 1) output.push(formatAddress(area, i, profileId));
    return output;
  }

  function codegenAllowed() { return !!get().mcu; }
  function preferredBoard() {
    const p = get();
    if (p.mcu === 'esp32') return 'esp32';
    if (p.mcu === 'arduino') {
      try {
        const board = localStorage.getItem(BOARD_KEY) || p.recommendedBoard || 'uno';
        return board === 'esp32' ? (p.recommendedBoard || 'uno') : board;
      } catch (_) { return p.recommendedBoard || 'uno'; }
    }
    try { return localStorage.getItem(BOARD_KEY) || 'uno'; } catch (_) { return 'uno'; }
  }

  global.SimuPLCPLCProfile = Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    profiles: PROFILES,
    get: get,
    getId: getId,
    getProfile: getProfile,
    set: set,
    parseAddress: parseAddress,
    formatAddress: formatAddress,
    translateAddress: translateAddress,
    addressOrdinal: addressOrdinal,
    editNumberForName: editNumberForName,
    formatFromEditNumber: formatFromEditNumber,
    cppIdentifier: cppIdentifier,
    transformObject: transformObject,
    translatedClone: translatedClone,
    variableCatalog: variableCatalog,
    migrateVariableStorage: migrateVariableStorage,
    codegenAllowed: codegenAllowed,
    preferredBoard: preferredBoard,
    applyRecommendedBoard: applyRecommendedBoard
  });
})(window);
