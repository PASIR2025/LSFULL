(function (global) {
  'use strict';

  if (global.SimuPLCProjectRepository) return;

  const MODULE_VERSION = '1.6.0-phase3';

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return value; }
  }

  function getConfig() {
    return global.SimuPLCConfig || { storage: { circuits: 'logicsoft_circuits_v1' } };
  }

  function getStorage() {
    return global.SimuPLCStorage || null;
  }

  function getSchema() {
    return global.SimuPLCProjectSchema || null;
  }

  function circuitsKey() {
    const config = getConfig();
    return (config.storage && config.storage.circuits) || 'logicsoft_circuits_v1';
  }

  function readList() {
    const key = circuitsKey();
    const storage = getStorage();
    let value;
    if (storage && typeof storage.getJSON === 'function') value = storage.getJSON(key, []);
    else {
      try {
        const raw = localStorage.getItem(key);
        value = raw ? JSON.parse(raw) : [];
      } catch (error) {
        console.warn('[SimuPLCProjectRepository] No se pudo leer Mis circuitos.', error);
        value = [];
      }
    }
    return Array.isArray(value) ? value : [];
  }

  function writeList(list) {
    const safeList = Array.isArray(list) ? list : [];
    const key = circuitsKey();
    const storage = getStorage();
    if (storage && typeof storage.setJSON === 'function') return storage.setJSON(key, safeList);
    try {
      localStorage.setItem(key, JSON.stringify(safeList));
      return true;
    } catch (error) {
      console.warn('[SimuPLCProjectRepository] No se pudo guardar Mis circuitos.', error);
      return false;
    }
  }

  function makeId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function createSavedItem(options) {
    options = options || {};
    const editor = options.editor === 'ladder' ? 'ladder' : 'fbd';
    const now = Number(options.createdAt || Date.now());
    const item = {
      id: options.id || makeId(),
      name: String(options.name || (editor === 'ladder' ? 'Circuito Ladder' : 'Circuito FBD')),
      editor: editor,
      createdAt: now,
      updatedAt: Number(options.updatedAt || now)
    };

    if (editor === 'ladder') {
      item.ladder = clone(options.ladder || {});
      item.data = clone(item.ladder);
    } else {
      item.fbd = clone(options.fbd || {});
      item.data = clone(item.fbd);
    }
    return item;
  }

  function add(item) {
    const list = readList();
    list.push(clone(item));
    return writeList(list) ? clone(item) : null;
  }

  function getById(id) {
    const found = readList().find(function (entry) { return entry && entry.id === id; });
    return found ? clone(found) : null;
  }

  function rename(id, name) {
    const list = readList();
    const index = list.findIndex(function (entry) { return entry && entry.id === id; });
    if (index < 0) return false;
    const cleanName = String(name || '').trim();
    if (!cleanName) return false;
    list[index].name = cleanName;
    list[index].updatedAt = Date.now();
    return writeList(list);
  }

  function removeById(id) {
    const current = readList();
    const next = current.filter(function (entry) { return !entry || entry.id !== id; });
    if (next.length === current.length) return false;
    return writeList(next);
  }

  function normalizeSavedItem(item, activeEditorFallback) {
    item = clone(item || {});
    const result = { editor: null, fbd: null, ladder: null };

    if (item.editor === 'ladder' || item.kind === 'ladder' || item.mode === 'ladder') result.editor = 'ladder';
    if (item.editor === 'fbd' || item.kind === 'fbd' || item.mode === 'fbd') result.editor = 'fbd';

    const dual = item.dualProject || ((item.data && (item.data.editors || item.data.fbd || item.data.ladder)) ? item.data : null);
    if (dual) {
      result.editor = result.editor || (dual.activeEditor === 'ladder' ? 'ladder' : 'fbd');
      result.fbd = dual.fbd || (dual.editors && dual.editors.fbd) || item.fbd || null;
      result.ladder = dual.ladder || (dual.editors && dual.editors.ladder) || item.ladder || null;
    }

    if (item.fbd) result.fbd = item.fbd;
    if (item.ladder) result.ladder = item.ladder;
    if (item.data) {
      if (Array.isArray(item.data.nodes) || (item.data.data && Array.isArray(item.data.data.nodes))) result.fbd = result.fbd || item.data;
      if (Array.isArray(item.data.rungs) || item.data.type === 'ladder-phase9') result.ladder = result.ladder || item.data;
      if (item.data.editors) {
        result.fbd = result.fbd || item.data.editors.fbd || null;
        result.ladder = result.ladder || item.data.editors.ladder || null;
      }
    }

    if (!result.editor) {
      if (result.ladder && !result.fbd) result.editor = 'ladder';
      else if (result.fbd && !result.ladder) result.editor = 'fbd';
      else result.editor = activeEditorFallback === 'ladder' ? 'ladder' : 'fbd';
    }

    const schema = getSchema();
    if (schema) {
      if (result.fbd && typeof schema.normalizeFBD === 'function') result.fbd = schema.normalizeFBD(result.fbd);
      if (result.ladder && typeof schema.normalizeLadder === 'function') result.ladder = schema.normalizeLadder(result.ladder);
    }
    return result;
  }

  function persistLastProject(project) {
    const config = getConfig();
    const storage = getStorage();
    const schema = getSchema();
    let canonical = clone(project);
    try {
      if (schema && typeof schema.migrate === 'function') canonical = schema.migrate(project);
      if (config.storage && config.storage.lastCanonicalProject) {
        if (storage && typeof storage.setJSON === 'function') storage.setJSON(config.storage.lastCanonicalProject, canonical);
        else localStorage.setItem(config.storage.lastCanonicalProject, JSON.stringify(canonical));
      }
      if (config.storage && config.storage.lastLegacyDualProject) {
        const legacy = schema && typeof schema.toLegacyDual === 'function' ? schema.toLegacyDual(canonical) : canonical;
        if (storage && typeof storage.setJSON === 'function') storage.setJSON(config.storage.lastLegacyDualProject, legacy);
        else localStorage.setItem(config.storage.lastLegacyDualProject, JSON.stringify(legacy));
      }
      return canonical;
    } catch (error) {
      console.warn('[SimuPLCProjectRepository] No se pudo guardar el último proyecto.', error);
      return null;
    }
  }

  function getDiagnostics() {
    const config = getConfig();
    const storage = getStorage();
    const list = readList();
    return {
      ok: Array.isArray(list) && !!(config.storage && config.storage.circuits),
      version: MODULE_VERSION,
      storageAvailable: !!storage,
      circuitsKey: circuitsKey(),
      circuitCount: list.length
    };
  }

  global.SimuPLCProjectRepository = Object.freeze({
    version: MODULE_VERSION,
    list: readList,
    replaceAll: writeList,
    createSavedItem: createSavedItem,
    add: add,
    get: getById,
    rename: rename,
    remove: removeById,
    normalizeSavedItem: normalizeSavedItem,
    persistLastProject: persistLastProject,
    getDiagnostics: getDiagnostics
  });
})(window);
