(function (global) {
  'use strict';

  if (global.SimuPLCRecovery) return;

  const MODULE_VERSION = '1.6.0-phase3';
  const AUTOSAVE_INTERVAL_MS = 5000;
  const ACTIVITY_DELAY_MS = 1200;
  const API_WAIT_MS = 12000;
  const BACKUP_MAX_ITEMS = 8;
  const BACKUP_MAX_BYTES = 2600000;
  const IMPORT_MAX_BYTES = 15000000;

  let initialized = false;
  let initPromise = null;
  let ready = false;
  let autosaveTimer = null;
  let activityTimer = null;
  let captureRunning = false;
  let suspendCount = 0;
  let currentFingerprint = '';
  let lastCaptureAt = 0;
  let recoveryPromptShown = false;

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_error) { return value; }
  }

  function config() {
    return global.SimuPLCConfig || { storage: {} };
  }

  function storage() {
    return global.SimuPLCStorage || null;
  }

  function schema() {
    return global.SimuPLCProjectSchema || null;
  }

  function editors() {
    return global.SimuPLCEditors || global.SimuPLCSeparateEditors || null;
  }

  function modal() {
    const api = global.SimuPLCNativeModal || global.SimuPLCModal;
    if (api && typeof api.confirm === 'function') return api;
    return {
      confirm: function (message) {
        const fallback = global.__nativeDialogFallback && global.__nativeDialogFallback.confirm;
        return Promise.resolve(fallback ? !!fallback(String(message || '')) : false);
      },
      alert: function (message) {
        const fallback = global.__nativeDialogFallback && global.__nativeDialogFallback.alert;
        if (fallback) fallback(String(message || ''));
        return Promise.resolve(true);
      }
    };
  }

  function toast(message) {
    if (typeof global.showToast === 'function') {
      global.showToast(message);
      return;
    }
    let node = document.getElementById('simuplcRecoveryToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'simuplcRecoveryToast';
      node.style.cssText = 'position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483003;background:#0f172a;color:#fff;padding:9px 16px;border-radius:999px;font:700 13px Arial,sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .15s ease;pointer-events:none';
      document.body.appendChild(node);
    }
    node.textContent = String(message || '');
    node.style.opacity = '1';
    clearTimeout(node.__timer);
    node.__timer = setTimeout(function () { node.style.opacity = '0'; }, 1800);
  }

  function getKey(name, fallback) {
    const cfg = config();
    return (cfg.storage && cfg.storage[name]) || fallback;
  }

  function getJSON(key, fallback) {
    const api = storage();
    if (api && typeof api.getJSON === 'function') return api.getJSON(key, fallback);
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch (_error) { return clone(fallback); }
  }

  function setJSON(key, value) {
    const api = storage();
    if (api && typeof api.setJSON === 'function') return api.setJSON(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_error) { return false; }
  }

  function removeKey(key) {
    const api = storage();
    if (api && typeof api.remove === 'function') return api.remove(key);
    try { localStorage.removeItem(key); return true; }
    catch (_error) { return false; }
  }

  function stableCopy(value) {
    if (Array.isArray(value)) return value.map(stableCopy);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    Object.keys(value).sort().forEach(function (key) {
      if (key === 'savedAt' || key === 'updatedAt' || key === 'createdAt') return;
      out[key] = stableCopy(value[key]);
    });
    return out;
  }

  function fingerprint(value) {
    let text = '';
    try { text = JSON.stringify(stableCopy(value)); }
    catch (_error) { text = String(value || ''); }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8) + ':' + text.length;
  }

  function isProjectEmpty(project) {
    try {
      const fbdNodes = project.editors.fbd.nodes || [];
      const ladderRungs = project.editors.ladder.rungs || [];
      const ladderElements = ladderRungs.reduce(function (sum, rung) {
        return sum + (Array.isArray(rung && rung.elements) ? rung.elements.length : 0);
      }, 0);
      const ladderWires = project.editors.ladder.proWires || [];
      const ladderJunctions = project.editors.ladder.proJunctions || [];
      return fbdNodes.length === 0 && ladderElements === 0 && ladderWires.length === 0 && ladderJunctions.length === 0;
    } catch (_error) { return true; }
  }

  async function waitForCaptureIdle(timeoutMs) {
    const started = Date.now();
    const timeout = Number(timeoutMs || 6000);
    while (captureRunning && Date.now() - started < timeout) {
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    return !captureRunning;
  }

  async function waitForEditors() {
    const started = Date.now();
    while (Date.now() - started < API_WAIT_MS) {
      const api = editors();
      if (api && typeof api.makeDualProject === 'function' && typeof api.loadProjectSelective === 'function') return api;
      await new Promise(function (resolve) { setTimeout(resolve, 120); });
    }
    throw new Error('Los editores todavía no están listos.');
  }

  async function readCanonicalProject(name) {
    const api = await waitForEditors();
    const raw = await api.makeDualProject(name || 'Recuperación automática');
    const projectSchema = schema();
    const project = projectSchema && typeof projectSchema.migrate === 'function' ? projectSchema.migrate(raw) : raw;
    if (projectSchema && typeof projectSchema.validate === 'function') {
      const validation = projectSchema.validate(project, { strict: true });
      if (!validation.ok) throw new Error(validation.errors.join(' '));
    }
    return project;
  }

  function readAutosave() {
    return getJSON(getKey('autosaveProject', 'simuplc_autosave_project_v1'), null);
  }

  function writeAutosave(envelope) {
    return setJSON(getKey('autosaveProject', 'simuplc_autosave_project_v1'), envelope);
  }

  function readRecoveryState() {
    return getJSON(getKey('recoveryState', 'simuplc_recovery_state_v1'), {
      version: 1,
      pending: false,
      fingerprint: '',
      lastReason: '',
      updatedAt: null,
      acknowledgedAt: null
    });
  }

  function writeRecoveryState(state) {
    return setJSON(getKey('recoveryState', 'simuplc_recovery_state_v1'), state);
  }

  function readHistory() {
    const value = getJSON(getKey('backupHistory', 'simuplc_backup_history_v1'), []);
    return Array.isArray(value) ? value : [];
  }

  function estimateBytes(value) {
    try { return JSON.stringify(value).length * 2; }
    catch (_error) { return Number.MAX_SAFE_INTEGER; }
  }

  function pruneHistory(items) {
    const result = Array.isArray(items) ? items.slice(0, BACKUP_MAX_ITEMS) : [];
    while (result.length > 1 && estimateBytes(result) > BACKUP_MAX_BYTES) result.pop();
    return result;
  }

  function writeHistory(items) {
    let pruned = pruneHistory(items);
    if (setJSON(getKey('backupHistory', 'simuplc_backup_history_v1'), pruned)) return true;
    while (pruned.length > 1) {
      pruned.pop();
      if (setJSON(getKey('backupHistory', 'simuplc_backup_history_v1'), pruned)) return true;
    }
    return false;
  }

  async function captureProject(reason, options) {
    options = options || {};
    if (captureRunning) {
      if (!options.force) return null;
      await waitForCaptureIdle(7000);
      if (captureRunning) return null;
    }
    if (suspendCount > 0 && !options.allowSuspended) return null;
    captureRunning = true;
    try {
      const project = await readCanonicalProject(options.name || 'Recuperación automática');
      const projectFingerprint = fingerprint(project);
      const previous = readAutosave();
      const changed = !previous || previous.fingerprint !== projectFingerprint;
      if (!changed && !options.force) return previous;

      const now = new Date().toISOString();
      const envelope = {
        type: 'simuplc-autosave',
        version: 1,
        appVersion: config().appVersion || MODULE_VERSION,
        savedAt: now,
        reason: reason || 'autoguardado',
        fingerprint: projectFingerprint,
        project: project
      };
      if (!writeAutosave(envelope)) throw new Error('El navegador no permitió guardar la recuperación automática.');
      currentFingerprint = projectFingerprint;
      lastCaptureAt = Date.now();

      const state = readRecoveryState();
      state.version = 1;
      state.pending = options.pending !== false && !isProjectEmpty(project);
      state.fingerprint = projectFingerprint;
      state.lastReason = reason || 'autoguardado';
      state.updatedAt = now;
      if (options.pending === false) state.acknowledgedAt = now;
      writeRecoveryState(state);
      return envelope;
    } finally {
      captureRunning = false;
    }
  }

  async function createBackup(reason, options) {
    options = options || {};
    const project = options.project ? clone(options.project) : await readCanonicalProject('Respaldo automático');
    const projectSchema = schema();
    if (projectSchema && typeof projectSchema.validate === 'function') {
      const validation = projectSchema.validate(project, { strict: true });
      if (!validation.ok) throw new Error(validation.errors.join(' '));
    }
    const projectFingerprint = fingerprint(project);
    const now = new Date().toISOString();
    const history = readHistory();
    const latest = history[0];
    if (latest && latest.fingerprint === projectFingerprint && latest.reason === reason && (Date.now() - Date.parse(latest.createdAt || 0)) < 3000) {
      return latest;
    }
    const entry = {
      id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'simuplc-project-backup',
      version: 1,
      appVersion: config().appVersion || MODULE_VERSION,
      createdAt: now,
      reason: reason || 'respaldo-manual',
      fingerprint: projectFingerprint,
      project: project
    };
    history.unshift(entry);
    writeHistory(history);
    return clone(entry);
  }

  async function restoreProject(project, options) {
    options = options || {};
    const projectSchema = schema();
    let canonical = project;
    if (projectSchema && typeof projectSchema.migrate === 'function') canonical = projectSchema.migrate(project);
    if (projectSchema && typeof projectSchema.validate === 'function') {
      const validation = projectSchema.validate(canonical, { strict: true });
      if (!validation.ok) throw new Error(validation.errors.join(' '));
    }
    const api = await waitForEditors();
    suspendCount += 1;
    try {
      const loaded = await api.loadProjectSelective(canonical);
      if (loaded === false) throw new Error('El proyecto no pudo recuperarse completamente.');
    } finally {
      suspendCount = Math.max(0, suspendCount - 1);
    }
    await captureProject(options.reason || 'proyecto-recuperado', { force: true, pending: options.pending !== false, allowSuspended: true });
    return true;
  }

  async function acknowledge(reason) {
    const envelope = await captureProject(reason || 'estado-confirmado', { force: true, pending: false, allowSuspended: true });
    const state = readRecoveryState();
    state.pending = false;
    state.lastReason = reason || 'estado-confirmado';
    state.acknowledgedAt = new Date().toISOString();
    if (envelope) state.fingerprint = envelope.fingerprint;
    writeRecoveryState(state);
    return envelope;
  }

  async function markChanged(reason) {
    return captureProject(reason || 'cambio-detectado', { force: false, pending: true });
  }

  function scheduleAutosave(reason) {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(function () {
      markChanged(reason || 'actividad-editor').catch(function (error) {
        console.warn('[SimuPLCRecovery] Autoguardado omitido:', error);
      });
    }, ACTIVITY_DELAY_MS);
  }

  function bindActivity() {
    ['pointerup', 'change', 'input', 'keyup'].forEach(function (eventName) {
      document.addEventListener(eventName, function (event) {
        const target = event && event.target;
        if (target && (target.id === 'loadInput' || target.closest && target.closest('.modal, .overlay'))) return;
        scheduleAutosave('actividad-' + eventName);
      }, true);
    });
    global.addEventListener('message', function (event) {
      const data = event && event.data;
      if (data && data.source === 'simuplc-ladder' && data.action === 'editorChanged') {
        scheduleAutosave('cambio-ladder');
      }
    }, true);
    global.addEventListener('simuplc:action-start', function () { suspendCount += 1; });
    global.addEventListener('simuplc:action-end', function () {
      suspendCount = Math.max(0, suspendCount - 1);
      setTimeout(function () { scheduleAutosave('después-de-acción'); }, 80);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        captureProject('aplicación-en-segundo-plano', { force: false, pending: true }).catch(function () {});
      }
    });
    global.addEventListener('pagehide', function () {
      const state = readRecoveryState();
      state.lastPageHideAt = new Date().toISOString();
      writeRecoveryState(state);
    });
  }

  function startInterval() {
    clearInterval(autosaveTimer);
    autosaveTimer = setInterval(function () {
      markChanged('autoguardado-periódico').catch(function (error) {
        console.warn('[SimuPLCRecovery] Autoguardado periódico omitido:', error);
      });
    }, AUTOSAVE_INTERVAL_MS);
  }

  async function maybeOfferRecovery() {
    if (recoveryPromptShown) return false;
    recoveryPromptShown = true;
    const state = readRecoveryState();
    const envelope = readAutosave();
    if (!state || !state.pending || !envelope || !envelope.project) return false;

    const projectSchema = schema();
    try {
      const canonical = projectSchema && typeof projectSchema.migrate === 'function' ? projectSchema.migrate(envelope.project) : envelope.project;
      if (projectSchema && typeof projectSchema.validate === 'function') {
        const validation = projectSchema.validate(canonical, { strict: true });
        if (!validation.ok) throw new Error(validation.errors.join(' '));
      }
      if (isProjectEmpty(canonical)) {
        state.pending = false;
        writeRecoveryState(state);
        return false;
      }
      const dateText = envelope.savedAt ? new Date(envelope.savedAt).toLocaleString() : 'recientemente';
      const restore = await modal().confirm(
        'Se encontró trabajo sin guardar de ' + dateText + '.\n\n¿Deseas recuperarlo ahora?',
        'Recuperar trabajo'
      );
      if (restore) {
        await createBackup('antes-de-recuperar-autoguardado');
        await restoreProject(canonical, { reason: 'recuperado-al-iniciar', pending: true });
        toast('Trabajo recuperado correctamente');
        return true;
      }
      state.pending = false;
      state.discardedAt = new Date().toISOString();
      writeRecoveryState(state);
      toast('Recuperación descartada');
      return false;
    } catch (error) {
      state.pending = false;
      state.invalidAt = new Date().toISOString();
      state.invalidReason = String(error && error.message || error);
      writeRecoveryState(state);
      await modal().alert(
        'La copia de recuperación está dañada o no es compatible y no se cargará.\n\nDetalle: ' + state.invalidReason,
        'Recuperación no disponible'
      );
      return false;
    }
  }

  function validateImportText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('El archivo está vacío.');
    if (text.length * 2 > IMPORT_MAX_BYTES) throw new Error('El archivo es demasiado grande para importarlo de forma segura.');
    let source;
    try { source = JSON.parse(text); }
    catch (_error) { throw new Error('El archivo está dañado: no contiene un JSON válido.'); }
    const projectSchema = schema();
    if (projectSchema && typeof projectSchema.validateImportSource === 'function') {
      const inspection = projectSchema.validateImportSource(source);
      if (!inspection.ok) throw new Error(inspection.errors.join(' '));
    }
    return source;
  }

  function listBackups() {
    return clone(readHistory());
  }

  async function restoreBackup(id) {
    const entry = readHistory().find(function (item) { return item && item.id === id; });
    if (!entry || !entry.project) throw new Error('No se encontró el respaldo solicitado.');
    await createBackup('antes-de-restaurar-respaldo');
    await restoreProject(entry.project, { reason: 'respaldo-restaurado', pending: true });
    toast('Respaldo restaurado');
    return true;
  }

  function clearRecovery() {
    removeKey(getKey('autosaveProject', 'simuplc_autosave_project_v1'));
    removeKey(getKey('recoveryState', 'simuplc_recovery_state_v1'));
    currentFingerprint = '';
    return true;
  }

  function diagnostics() {
    const autosave = readAutosave();
    const state = readRecoveryState();
    const history = readHistory();
    return {
      ok: initialized && ready,
      version: MODULE_VERSION,
      initialized: initialized,
      ready: ready,
      suspended: suspendCount > 0,
      captureRunning: captureRunning,
      currentFingerprint: currentFingerprint,
      lastCaptureAt: lastCaptureAt,
      autosaveExists: !!(autosave && autosave.project),
      recoveryPending: !!state.pending,
      backupCount: history.length,
      backupLimit: BACKUP_MAX_ITEMS,
      historyBytes: estimateBytes(history)
    };
  }

  function init() {
    if (initPromise) return initPromise;
    initialized = true;
    initPromise = (async function () {
      try {
        await waitForEditors();
        ready = true;
        bindActivity();
        await maybeOfferRecovery();
        if (!readAutosave()) await captureProject('estado-inicial', { force: true, pending: false });
        else {
          const existing = readAutosave();
          currentFingerprint = existing && existing.fingerprint || '';
        }
        startInterval();
      } catch (error) {
        console.warn('[SimuPLCRecovery] No se pudo iniciar completamente.', error);
      }
      return diagnostics();
    })();
    return initPromise;
  }

  global.SimuPLCRecovery = Object.freeze({
    version: MODULE_VERSION,
    init: init,
    saveNow: captureProject,
    markChanged: markChanged,
    acknowledge: acknowledge,
    createBackup: createBackup,
    listBackups: listBackups,
    restoreBackup: restoreBackup,
    restoreProject: restoreProject,
    maybeOfferRecovery: maybeOfferRecovery,
    validateImportText: validateImportText,
    clearRecovery: clearRecovery,
    getDiagnostics: diagnostics,
    fingerprint: fingerprint,
    isProjectEmpty: isProjectEmpty
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); }, { once: true });
  else setTimeout(init, 500);
})(window);
