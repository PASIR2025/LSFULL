(function (global) {
  'use strict';

  if (global.SimuPLCStorage) return;

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function getRaw(key) {
    try { return localStorage.getItem(key); }
    catch (error) { console.warn('[SimuPLCStorage] No se pudo leer', key, error); return null; }
  }

  function setRaw(key, value) {
    try { localStorage.setItem(key, String(value)); return true; }
    catch (error) { console.warn('[SimuPLCStorage] No se pudo guardar', key, error); return false; }
  }

  function remove(key) {
    try { localStorage.removeItem(key); return true; }
    catch (error) { console.warn('[SimuPLCStorage] No se pudo eliminar', key, error); return false; }
  }

  function getJSON(key, fallback) {
    const raw = getRaw(key);
    if (raw == null || raw === '') return clone(fallback);
    try { return JSON.parse(raw); }
    catch (error) {
      console.warn('[SimuPLCStorage] JSON inválido en', key, error);
      return clone(fallback);
    }
  }

  function setJSON(key, value) {
    try { return setRaw(key, JSON.stringify(value)); }
    catch (error) { console.warn('[SimuPLCStorage] No se pudo serializar', key, error); return false; }
  }

  function makeBackup(reason) {
    const config = global.SimuPLCConfig;
    if (!config) return null;

    const keys = [
      config.storage.circuits,
      config.storage.lastLegacyDualProject,
      config.storage.lastCanonicalProject,
      config.storage.ladderProjects,
      config.storage.editorMode
    ];

    const snapshot = {
      type: 'simuplc-storage-backup',
      version: 1,
      appVersion: config.appVersion,
      createdAt: new Date().toISOString(),
      reason: reason || 'manual',
      values: {}
    };

    keys.forEach(function (key) {
      const value = getRaw(key);
      if (value != null) snapshot.values[key] = value;
    });

    const previous = getJSON(config.storage.phase1Backup, null);
    if (!previous || reason === 'antes-de-iniciar-fase-1') {
      setJSON(config.storage.phase1Backup, snapshot);
    }
    return clone(snapshot);
  }

  function ensureInitialBackup() {
    const config = global.SimuPLCConfig;
    if (!config) return null;
    const previous = getJSON(config.storage.phase1Backup, null);
    return previous || makeBackup('antes-de-iniciar-fase-1');
  }

  function restoreBackup(snapshot) {
    const config = global.SimuPLCConfig;
    snapshot = snapshot || (config ? getJSON(config.storage.phase1Backup, null) : null);
    if (!snapshot || !snapshot.values || typeof snapshot.values !== 'object') return false;

    Object.keys(snapshot.values).forEach(function (key) {
      setRaw(key, snapshot.values[key]);
    });
    return true;
  }

  global.SimuPLCStorage = Object.freeze({
    getRaw: getRaw,
    setRaw: setRaw,
    getJSON: getJSON,
    setJSON: setJSON,
    remove: remove,
    makeBackup: makeBackup,
    ensureInitialBackup: ensureInitialBackup,
    restoreBackup: restoreBackup
  });
})(window);
