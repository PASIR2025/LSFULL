(function (global) {
  'use strict';

  if (global.SimuPLCActions) return;

  const CONTROLLER_VERSION = '1.6.0-phase3';
  const BOUND_MARK = 'data-simuplc-action-controller';
  let runningAction = null;
  let rebindTimer = null;

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

  function getEditors() {
    return global.SimuPLCEditors || global.SimuPLCSeparateEditors || {};
  }

  function getRecovery() {
    return global.SimuPLCRecovery || null;
  }

  function getRepository() {
    return global.SimuPLCProjectRepository || null;
  }

  function getProjectIO() {
    return global.SimuPLCProjectIO || null;
  }

  async function createProjectBackup(reason) {
    const recovery = getRecovery();
    if (recovery && typeof recovery.createBackup === 'function') {
      return recovery.createBackup(reason);
    }
    const safeStorage = getStorage();
    if (safeStorage && typeof safeStorage.makeBackup === 'function') return safeStorage.makeBackup(reason);
    return null;
  }

  async function acknowledgeProject(reason) {
    const recovery = getRecovery();
    if (recovery && typeof recovery.acknowledge === 'function') {
      return recovery.acknowledge(reason);
    }
    return null;
  }

  function getModal() {
    const api = global.SimuPLCNativeModal || global.SimuPLCModal;
    if (api && typeof api.prompt === 'function' && typeof api.confirm === 'function') return api;
    return {
      alert: function (message) {
        const fallback = global.__nativeDialogFallback && global.__nativeDialogFallback.alert;
        if (fallback) fallback(String(message || ''));
        return Promise.resolve(true);
      },
      confirm: function (message) {
        const fallback = global.__nativeDialogFallback && global.__nativeDialogFallback.confirm;
        return Promise.resolve(fallback ? !!fallback(String(message || '')) : true);
      },
      prompt: function (message, value) {
        const fallback = global.__nativeDialogFallback && global.__nativeDialogFallback.prompt;
        return Promise.resolve(fallback ? fallback(String(message || ''), value || '') : value || '');
      }
    };
  }

  function toast(message) {
    if (typeof global.showToast === 'function') {
      global.showToast(message);
      return;
    }
    let node = document.getElementById('simuplcActionToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'simuplcActionToast';
      node.style.cssText = 'position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483002;background:#0f172a;color:#fff;padding:9px 16px;border-radius:999px;font:700 13px Arial,sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .15s ease;pointer-events:none';
      document.body.appendChild(node);
    }
    node.textContent = String(message || '');
    node.style.opacity = '1';
    clearTimeout(node.__timer);
    node.__timer = setTimeout(function () { node.style.opacity = '0'; }, 1800);
  }

  function dispatch(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent('simuplc:action-' + name, { detail: detail || {} }));
    } catch (error) {}
  }

  async function runOnce(name, task) {
    if (runningAction) return false;
    runningAction = name;
    dispatch('start', { name: name });
    try {
      return await task();
    } finally {
      dispatch('end', { name: name });
      runningAction = null;
    }
  }

  function activeEditor() {
    const editors = getEditors();
    try {
      if (typeof editors.activeEditor === 'function') return editors.activeEditor() === 'ladder' ? 'ladder' : 'fbd';
    } catch (error) {}
    return document.body.classList.contains('mode-ladder') ? 'ladder' : 'fbd';
  }

  function setEditor(mode) {
    const normalized = mode === 'ladder' ? 'ladder' : 'fbd';
    const button = document.getElementById(normalized === 'ladder' ? 'modeLadderBtn' : 'modeFBDBtn');
    if (button) button.click();
    try {
      const config = getConfig();
      const key = config.storage && config.storage.editorMode;
      if (key) localStorage.setItem(key, normalized);
    } catch (error) {}
  }

  function refreshCircuitList() {
    try { if (typeof global.refreshCircuitList === 'function') global.refreshCircuitList(); }
    catch (error) { console.warn('[SimuPLCActions] No se pudo actualizar Mis circuitos.', error); }
  }

  async function createNew() {
    return runOnce('new', async function () {
      const mode = activeEditor();
      const label = mode === 'ladder' ? 'Ladder' : 'FBD';
      const ok = await getModal().confirm(
        'Se limpiará solamente el editor ' + label + '. El otro editor permanecerá intacto.',
        'Nuevo ' + label
      );
      if (!ok) return false;
      await createProjectBackup('antes-de-nuevo-' + mode);
      const editors = getEditors();
      let result;
      if (mode === 'ladder') {
        if (typeof editors.resetLadderOnly !== 'function') throw new Error('El reinicio Ladder no está disponible.');
        result = await editors.resetLadderOnly();
      } else {
        if (typeof editors.resetFBDOnly !== 'function') throw new Error('El reinicio FBD no está disponible.');
        result = editors.resetFBDOnly();
      }
      if (result === false) throw new Error('El editor no pudo reiniciarse.');
      await acknowledgeProject('nuevo-' + mode);
      toast('Nuevo ' + label + ' listo; el otro editor no cambió');
      return true;
    }).catch(function (error) {
      getModal().alert('No se pudo crear el circuito nuevo: ' + (error.message || error), 'Nuevo circuito');
      return false;
    });
  }

  async function saveActiveEditor() {
    return runOnce('save', async function () {
      const mode = activeEditor();
      const label = mode === 'ladder' ? 'Ladder' : 'FBD';
      const defaultName = mode === 'ladder' ? 'Circuito Ladder' : 'Circuito FBD';
      let name = await getModal().prompt('Escribe un nombre para guardar solamente el editor ' + label + '.', defaultName, 'Guardar ' + label);
      if (name === null || name === false) return false;
      name = String(name).trim() || defaultName;

      const editors = getEditors();
      const repository = getRepository();
      if (!repository) throw new Error('El repositorio de proyectos no está disponible.');
      let item;
      if (mode === 'ladder') {
        if (typeof editors.getLadderState !== 'function') throw new Error('No se pudo leer Ladder. Abre LADDER una vez y vuelve a guardar.');
        item = repository.createSavedItem({ name: name, editor: mode, ladder: await editors.getLadderState() });
      } else {
        if (typeof editors.getFBDState !== 'function') throw new Error('No se pudo leer FBD.');
        item = repository.createSavedItem({ name: name, editor: mode, fbd: editors.getFBDState() });
      }
      if (!repository.add(item)) throw new Error('El navegador no permitió guardar el circuito.');
      refreshCircuitList();
      await acknowledgeProject('guardado-' + mode);
      toast('Guardado solo ' + label + '; el otro editor no se toca');
      return item;
    }).catch(function (error) {
      getModal().alert('No se pudo guardar: ' + (error.message || error), 'Error al guardar');
      return false;
    });
  }

  async function exportProject() {
    return runOnce('export', async function () {
      let name = await getModal().prompt('Nombre del archivo para exportar el proyecto completo FBD/Ladder.', 'Proyecto SimuPLC', 'Exportar proyecto');
      if (name === null || name === false) return false;
      name = String(name).trim() || 'Proyecto SimuPLC';
      const projectIO = getProjectIO();
      const repository = getRepository();
      if (!projectIO || !repository) throw new Error('Los módulos de proyecto no están disponibles.');
      const project = await projectIO.captureCurrentProject(name);
      repository.persistLastProject(project);
      projectIO.exportProject(project, name);
      await acknowledgeProject('proyecto-exportado');
      toast('Proyecto FBD/Ladder exportado');
      return project;
    }).catch(function (error) {
      getModal().alert('No se pudo exportar: ' + (error.message || error), 'Error al exportar');
      return false;
    });
  }

  function requestImport() {
    const input = document.getElementById('loadInput');
    if (!input) {
      getModal().alert('No se encontró el selector de archivos.', 'Importar');
      return false;
    }
    input.value = '';
    input.click();
    return true;
  }

  async function importFile(file) {
    if (!file) return false;
    return runOnce('import', async function () {
      const projectIO = getProjectIO();
      const repository = getRepository();
      if (!projectIO || !repository) throw new Error('Los módulos de proyecto no están disponibles.');
      const source = projectIO.parseImportText(await file.text());
      const canonical = await projectIO.prepareImport(source);
      await createProjectBackup('antes-de-importar-proyecto');
      const loaded = await projectIO.loadCanonical(canonical);
      if (loaded === false) throw new Error('El proyecto no pudo cargarse completamente.');
      repository.persistLastProject(canonical);
      await acknowledgeProject('proyecto-importado');
      toast('Proyecto importado correctamente');
      return true;
    }).catch(function (error) {
      getModal().alert('No se pudo importar: ' + (error.message || error), 'Error al importar');
      return false;
    });
  }

  async function openSavedCircuit(id) {
    return runOnce('open', async function () {
      const repository = getRepository();
      const projectIO = getProjectIO();
      if (!repository || !projectIO) throw new Error('Los módulos de proyecto no están disponibles.');
      const item = repository.get(id);
      if (!item) throw new Error('No se encontró el circuito.');
      const normalized = repository.normalizeSavedItem(item, activeEditor());
      const editors = getEditors();
      if (normalized.editor === 'ladder') {
        if (!normalized.ladder) throw new Error('Este circuito no contiene datos Ladder.');
        normalized.ladder = projectIO.validateEditorState('ladder', normalized.ladder);
      } else {
        if (!normalized.fbd) throw new Error('Este circuito no contiene datos FBD.');
        normalized.fbd = projectIO.validateEditorState('fbd', normalized.fbd);
      }
      await createProjectBackup('antes-de-abrir-circuito-' + normalized.editor);
      let ok;
      if (normalized.editor === 'ladder') {
        if (!normalized.ladder) throw new Error('Este circuito no contiene datos Ladder.');
        setEditor('ladder');
        if (typeof editors.loadLadderState === 'function') ok = await editors.loadLadderState(clone(normalized.ladder));
        else if (typeof editors.loadProjectSelective === 'function') ok = await editors.loadProjectSelective({ ladder: clone(normalized.ladder), activeEditor: 'ladder' });
        toast('Ladder cargado; FBD intacto');
      } else {
        if (!normalized.fbd) throw new Error('Este circuito no contiene datos FBD.');
        setEditor('fbd');
        if (typeof editors.loadFBDState === 'function') ok = editors.loadFBDState(clone(normalized.fbd));
        else if (typeof editors.loadProjectSelective === 'function') ok = await editors.loadProjectSelective({ fbd: clone(normalized.fbd), activeEditor: 'fbd' });
        toast('FBD cargado; Ladder intacto');
      }
      if (ok === false) throw new Error('El circuito no pudo abrirse.');
      const modal = document.getElementById('circuitsModal');
      if (modal) modal.style.display = 'none';
      await acknowledgeProject('circuito-abierto-' + normalized.editor);
      return true;
    }).catch(function (error) {
      getModal().alert(error.message || String(error), 'Abrir circuito');
      return false;
    });
  }

  async function renameSavedCircuit(id) {
    const repository = getRepository();
    if (!repository) return false;
    const item = repository.get(id);
    if (!item) return false;
    const name = await getModal().prompt('Nuevo nombre para el circuito.', item.name || 'Mi circuito', 'Renombrar circuito');
    if (!name) return false;
    const updated = repository.rename(id, name);
    if (updated) refreshCircuitList();
    return updated;
  }

  async function deleteSavedCircuit(id) {
    const ok = await getModal().confirm('¿Eliminar este circuito? Esta acción no se puede deshacer.', 'Eliminar circuito');
    if (!ok) return false;
    const repository = getRepository();
    if (!repository || !repository.remove(id)) return false;
    refreshCircuitList();
    toast('Circuito eliminado');
    return true;
  }

  function markControl(node) {
    if (!node) return;
    node.setAttribute(BOUND_MARK, CONTROLLER_VERSION);
    node.__simuplcActionBound = true;
    node.__separateStateCloned = true;
    node.__nativeModalBound = true;
    node.__nativeNewBound = true;
    node.__nativeSaveBound = true;
  }

  function replaceControl(id) {
    const current = document.getElementById(id);
    if (!current || !current.parentNode) return current;
    // cloneNode copia los atributos data-* pero no los listeners ni las propiedades JS.
    // Exigimos también la marca en memoria para detectar controles clonados por parches antiguos.
    if (current.getAttribute(BOUND_MARK) === CONTROLLER_VERSION && current.__simuplcActionBound === true) return current;
    const clean = current.cloneNode(true);
    clean.removeAttribute('onclick');
    clean.onclick = null;
    markControl(clean);
    current.parentNode.replaceChild(clean, current);
    return clean;
  }

  function bindControls() {
    const save = replaceControl('btnSave');
    const importButton = replaceControl('btnImportUnified');
    const exportButton = replaceControl('btnExportUnified');
    const newButton = replaceControl('btnNew');
    const input = replaceControl('loadInput');
    const list = replaceControl('circuitsList');

    if (save && !save.__simuplcClickInstalled) {
      save.__simuplcClickInstalled = true;
      save.addEventListener('click', function (event) {
        event.preventDefault(); event.stopPropagation();
        saveActiveEditor();
      });
    }
    if (importButton && !importButton.__simuplcClickInstalled) {
      importButton.__simuplcClickInstalled = true;
      importButton.addEventListener('click', function (event) {
        event.preventDefault(); event.stopPropagation();
        requestImport();
      });
    }
    if (exportButton && !exportButton.__simuplcClickInstalled) {
      exportButton.__simuplcClickInstalled = true;
      exportButton.addEventListener('click', function (event) {
        event.preventDefault(); event.stopPropagation();
        exportProject();
      });
    }
    if (newButton && !newButton.__simuplcClickInstalled) {
      newButton.__simuplcClickInstalled = true;
      newButton.addEventListener('click', function (event) {
        event.preventDefault(); event.stopPropagation();
        createNew();
      });
    }
    if (input && !input.__simuplcChangeInstalled) {
      input.__simuplcChangeInstalled = true;
      input.addEventListener('change', async function (event) {
        const file = event.target.files && event.target.files[0];
        try { await importFile(file); }
        finally { event.target.value = ''; }
      });
    }
    if (list && !list.__simuplcListInstalled) {
      list.__simuplcListInstalled = true;
      list.__nativeModalListBound = true;
      list.addEventListener('click', async function (event) {
        const button = event.target && event.target.closest && event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.getAttribute('data-action');
        const id = button.getAttribute('data-id');
        if (!action || !id) return;
        event.preventDefault(); event.stopPropagation();
        if (action === 'open') await openSavedCircuit(id);
        if (action === 'rename') await renameSavedCircuit(id);
        if (action === 'delete') await deleteSavedCircuit(id);
      });
    }

    return getDiagnostics();
  }

  function scheduleRebind() {
    clearTimeout(rebindTimer);
    rebindTimer = setTimeout(bindControls, 20);
  }

  function getDiagnostics() {
    const ids = ['btnSave', 'btnImportUnified', 'btnExportUnified', 'btnNew', 'loadInput', 'circuitsList'];
    const controls = {};
    ids.forEach(function (id) {
      const node = document.getElementById(id);
      controls[id] = {
        exists: !!node,
        controller: node ? node.getAttribute(BOUND_MARK) : null,
        bound: !!(node && node.__simuplcActionBound === true)
      };
    });
    const repositoryReport = getRepository() && getRepository().getDiagnostics ? getRepository().getDiagnostics() : null;
    const projectIOReport = getProjectIO() && getProjectIO().getDiagnostics ? getProjectIO().getDiagnostics() : null;
    return {
      ok: Object.keys(controls).every(function (id) { return controls[id].exists && controls[id].controller === CONTROLLER_VERSION && controls[id].bound; }) && !!(repositoryReport && repositoryReport.ok) && !!(projectIOReport && projectIOReport.ok),
      version: CONTROLLER_VERSION,
      activeEditor: activeEditor(),
      runningAction: runningAction,
      repository: repositoryReport,
      projectIO: projectIOReport,
      controls: controls
    };
  }

  function observeContainer(container) {
    if (!container || container.__simuplcActionObserver) return;
    const observer = new MutationObserver(scheduleRebind);
    observer.observe(container, { childList: true, subtree: true });
    container.__simuplcActionObserver = observer;
  }

  function init() {
    bindControls();
    observeContainer(document.getElementById('topbar'));
    observeContainer(document.getElementById('circuitsModal'));
  }

  global.SimuPLCActions = Object.freeze({
    version: CONTROLLER_VERSION,
    init: init,
    bindControls: bindControls,
    newProject: createNew,
    saveActiveEditor: saveActiveEditor,
    exportProject: exportProject,
    requestImport: requestImport,
    importFile: importFile,
    openSavedCircuit: openSavedCircuit,
    renameSavedCircuit: renameSavedCircuit,
    deleteSavedCircuit: deleteSavedCircuit,
    getDiagnostics: getDiagnostics
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  global.addEventListener('load', function () { setTimeout(bindControls, 300); }, { once: true });
})(window);
