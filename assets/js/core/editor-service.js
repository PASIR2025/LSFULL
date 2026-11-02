(function (global) {
  'use strict';

  if (global.SimuPLCEditors && global.SimuPLCEditors.version === '1.6.0-phase3') return;

  const VERSION = '1.6.0-phase3';
  const LEGACY_DUAL_TYPE = 'simuplc-dual-project';
  const LEGACY_DUAL_VERSION = 2;

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_error) { return value; }
  }

  function bridge() {
    return global.SimuPLCEditorFrameBridge || null;
  }

  function config() {
    return global.SimuPLCConfig || { storage: { editorMode: 'simuplc_editor_mode_v1' } };
  }

  function activeEditor() {
    return document.body && document.body.classList.contains('mode-ladder') ? 'ladder' : 'fbd';
  }

  function setEditor(mode) {
    const normalized = mode === 'ladder' ? 'ladder' : 'fbd';
    const button = document.getElementById(normalized === 'ladder' ? 'modeLadderBtn' : 'modeFBDBtn');
    if (button) button.click();
    try {
      const key = config().storage && config().storage.editorMode;
      if (key) localStorage.setItem(key, normalized);
    } catch (_error) {}
    return normalized;
  }

  function sanitizeLadderState(data) {
    data = clone(data || {});
    if (data && data.editors && data.editors.ladder) data = data.editors.ladder;
    if (data && data.ladder && !data.rungs) data = data.ladder;
    if (!data || typeof data !== 'object') data = {};
    if (!Array.isArray(data.rungs)) data.rungs = [{ id: 'r1', elements: [] }];
    if (!Array.isArray(data.proWires)) data.proWires = [];
    if (!Array.isArray(data.proJunctions)) data.proJunctions = [];
    if (!Array.isArray(data.referenceTexts)) data.referenceTexts = Array.isArray(data.annotations) ? data.annotations : (Array.isArray(data.texts) ? data.texts : []);
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    data.type = data.type || 'ladder-phase9';
    data.version = data.version || 1;
    return data;
  }

  function emptyLadder() {
    const schema = global.SimuPLCProjectSchema;
    if (schema && typeof schema.emptyLadder === 'function') return schema.emptyLadder();
    return sanitizeLadderState({});
  }

  function getFBDState() {
    try {
      if (typeof global.serializeFBD === 'function') return clone(global.serializeFBD());
      if (typeof global.serialize === 'function') return clone(global.serialize());
    } catch (error) {
      console.warn('[SimuPLCEditors] No se pudo serializar FBD mediante la API principal.', error);
    }

    try {
      const editorNodes = Array.isArray(global.nodes) ? global.nodes : [];
      const editorConnections = Array.isArray(global.connections) ? global.connections : [];
      return {
        v: 2,
        nodes: editorNodes.map(function (node) {
          return {
            id: node.id,
            type: node.type,
            name: node.name,
            code: node.code || null,
            x: parseFloat(node.el && node.el.style && node.el.style.left) || 0,
            y: parseFloat(node.el && node.el.style && node.el.style.top) || 0,
            ioLabel: node.el && node.el.dataset ? node.el.dataset.ioLabel : undefined,
            inputMode: node.el && node.el.dataset ? (node.el.dataset.inputMode || node.el.dataset.mode) : undefined,
            active: node.el && node.el.classList && node.el.classList.contains('active') ? 1 : 0,
            delayMs: node.delayMs,
            cntOn: node.on,
            cntOff: node.off
          };
        }),
        connections: editorConnections.map(function (connection) {
          const source = editorNodes.find(function (node) { return (Array.isArray(node.outputs)&&node.outputs.length?node.outputs:(node.output?[node.output]:[])).indexOf(connection.from)>=0; });
          const sourceIndex = source ? (Array.isArray(source.outputs)&&source.outputs.length?source.outputs:[source.output]).indexOf(connection.from) : 0;
          const target = editorNodes.find(function (node) { return (node.inputs || []).indexOf(connection.to) >= 0; });
          return {
            fromId: source ? source.id : null,
            fromPin: 'out'+(Math.max(0,sourceIndex)+1),
            toId: target ? target.id : null,
            toIndex: target ? Math.max(0, target.inputs.indexOf(connection.to)) : 0,
            toPin: target ? target.inputs.indexOf(connection.to) + 1 : 1,
            mode: connection.mode || 'wire',
            bends: clone(connection.bends || []),
            srcTag: connection.srcBranch ? { tx: connection.srcBranch.tx, ty: connection.srcBranch.ty } : null,
            dstTag: connection.dstBranch ? { tx: connection.dstBranch.tx, ty: connection.dstBranch.ty } : null
          };
        }),
        settings: {}
      };
    } catch (error) {
      console.warn('[SimuPLCEditors] No se pudo crear el respaldo mínimo FBD.', error);
      return { v: 2, nodes: [], connections: [], settings: {} };
    }
  }

  function loadFBDState(data) {
    if (!data) return true;
    let state = clone(data);
    if (state && state.editors && state.editors.fbd) state = state.editors.fbd;
    if (state && state.fbd && !state.nodes) state = state.fbd;
    if (state && state.data && Array.isArray(state.data.nodes)) state = state.data;
    try {
      if (typeof global.loadFromData === 'function') { global.loadFromData(state); return true; }
      if (typeof global.deserializeFBD === 'function') { global.deserializeFBD(state); return true; }
      if (typeof global.deserializeCircuit === 'function') { global.deserializeCircuit(state); return true; }
      throw new Error('No se encontró el cargador FBD.');
    } catch (error) {
      console.error('[SimuPLCEditors] No se pudo cargar FBD.', error);
      return false;
    }
  }

  function stopFBDSimulation() {
    try {
      global.simulation = false;
      const simulate = document.getElementById('simulate');
      const stop = document.getElementById('stop');
      if (simulate) simulate.classList.remove('active');
      if (stop) stop.classList.remove('active');
    } catch (_error) {}
  }

  function resetFBDOnly() {
    stopFBDSimulation();
    try { if (typeof global.clearSelection === 'function') global.clearSelection(); } catch (_error) {}
    try {
      if (typeof global.clearAll === 'function') {
        global.clearAll();
      } else {
        document.querySelectorAll('#workspace .node, #workspace .conn-tag').forEach(function (element) { element.remove(); });
        document.querySelectorAll('#wires .wire-path, #wires .wire-hit, #wires .bend-hit, #wires .bend-handle, #wires .hub-dot, #wires .hub-hit').forEach(function (element) { element.remove(); });
        if (Array.isArray(global.nodes)) global.nodes.length = 0;
        if (Array.isArray(global.connections)) global.connections.length = 0;
      }
      try { global.inputCount = 0; } catch (_error) {}
      try { global.outputCount = 0; } catch (_error) {}
      try { global.memoryCount = 0; } catch (_error) {}
      try { global.blockCodeCount = 0; } catch (_error) {}
      try { global.nextNodeId = 1; } catch (_error) {}
      try { global.scale = 1; global.panX = 0; global.panY = 0; } catch (_error) {}
      try { if (typeof global.updateTransform === 'function') global.updateTransform(); } catch (_error) {}
      try { if (typeof global.updateConnections === 'function') global.updateConnections(); } catch (_error) {}
      return true;
    } catch (error) {
      console.error('[SimuPLCEditors] No se pudo reiniciar FBD.', error);
      return false;
    }
  }

  async function getLadderState() {
    const api = bridge();
    if (!api) return emptyLadder();
    try {
      return sanitizeLadderState(await api.getProject());
    } catch (error) {
      console.warn('[SimuPLCEditors] No se pudo leer Ladder.', error);
      return emptyLadder();
    }
  }

  async function loadLadderState(data) {
    if (!data) return true;
    const api = bridge();
    if (!api) return false;
    try {
      const result = await api.setProject(sanitizeLadderState(data));
      return result !== false;
    } catch (error) {
      console.warn('[SimuPLCEditors] No se pudo cargar Ladder.', error);
      return false;
    }
  }

  async function resetLadderOnly() {
    const api = bridge();
    if (!api) return false;
    try {
      const result = await api.resetProject();
      return result !== false;
    } catch (error) {
      console.warn('[SimuPLCEditors] No se pudo reiniciar Ladder.', error);
      return false;
    }
  }

  async function getLadderArduino() {
    const api = bridge();
    if (!api) throw new Error('El puente Ladder no está disponible.');
    return api.getArduino();
  }

  async function getLadderLabels() {
    const api = bridge();
    if (!api) throw new Error('El puente Ladder no está disponible.');
    return api.getLabels();
  }

  async function makeDualProject(name) {
    return {
      type: LEGACY_DUAL_TYPE,
      version: LEGACY_DUAL_VERSION,
      name: String(name || 'Proyecto SimuPLC'),
      savedAt: new Date().toISOString(),
      activeEditor: activeEditor(),
      editors: {
        fbd: getFBDState(),
        ladder: await getLadderState()
      },
      hardware: global.SimuPLCVariableManager && typeof global.SimuPLCVariableManager.exportConfig === 'function'
        ? global.SimuPLCVariableManager.exportConfig()
        : {}
    };
  }

  function inspectProject(source) {
    if (!source || typeof source !== 'object') throw new Error('El proyecto está vacío o es inválido.');
    const result = { activeEditor: source.activeEditor || null, hasFbd: false, hasLadder: false, fbd: null, ladder: null, hardware: source.hardware || source.mcuConfig || null };

    if (source.type === 'simuplc-project' && source.editors) {
      result.hasFbd = !!source.editors.fbd;
      result.hasLadder = !!source.editors.ladder;
      result.fbd = source.editors.fbd || null;
      result.ladder = source.editors.ladder || null;
      return result;
    }
    if (source.editors || source.fbd || source.ladder || source.type === LEGACY_DUAL_TYPE) {
      result.fbd = source.editors && source.editors.fbd ? source.editors.fbd : source.fbd || null;
      result.ladder = source.editors && source.editors.ladder ? source.editors.ladder : source.ladder || null;
      result.hasFbd = !!result.fbd;
      result.hasLadder = !!result.ladder;
      if (!result.hasFbd && !result.hasLadder) throw new Error('El proyecto no contiene FBD ni Ladder.');
      return result;
    }
    if (Array.isArray(source.rungs) || String(source.type || '').indexOf('ladder') === 0) {
      result.activeEditor = 'ladder';
      result.hasLadder = true;
      result.ladder = source;
      return result;
    }
    if (Array.isArray(source.nodes) || (source.data && Array.isArray(source.data.nodes))) {
      result.activeEditor = 'fbd';
      result.hasFbd = true;
      result.fbd = source.data && Array.isArray(source.data.nodes) ? source.data : source;
      return result;
    }
    throw new Error('El archivo no parece ser un proyecto SimuPLC válido.');
  }

  async function loadProjectSelective(source) {
    const project = inspectProject(source);
    let ok = true;
    if (project.hasFbd) ok = loadFBDState(project.fbd) && ok;
    if (project.hasLadder) ok = (await loadLadderState(project.ladder)) && ok;
    if (project.hasFbd && project.hasLadder) setEditor(project.activeEditor === 'ladder' ? 'ladder' : 'fbd');
    else if (project.hasLadder) setEditor('ladder');
    else if (project.hasFbd) setEditor('fbd');
    if (project.hardware && global.SimuPLCVariableManager && typeof global.SimuPLCVariableManager.importConfig === 'function') {
      try { global.SimuPLCVariableManager.importConfig(project.hardware); }
      catch (error) { console.warn('[SimuPLCEditors] No se pudo restaurar la configuración de variables y pines.', error); }
    }
    return ok;
  }

  function diagnostics() {
    const bridgeReport = bridge() && bridge().getDiagnostics ? bridge().getDiagnostics() : null;
    return {
      ok: typeof getFBDState === 'function' && typeof loadFBDState === 'function' && !!bridge(),
      version: VERSION,
      activeEditor: activeEditor(),
      fbd: {
        canRead: typeof global.serializeFBD === 'function' || typeof global.serialize === 'function',
        canLoad: typeof global.loadFromData === 'function' || typeof global.deserializeFBD === 'function' || typeof global.deserializeCircuit === 'function',
        canReset: typeof global.clearAll === 'function' || !!document.getElementById('workspace')
      },
      ladder: bridgeReport
    };
  }

  const api = {
    version: VERSION,
    activeEditor: activeEditor,
    setEditor: setEditor,
    getFBDState: getFBDState,
    loadFBDState: loadFBDState,
    resetFBDOnly: resetFBDOnly,
    getLadderState: getLadderState,
    loadLadderState: loadLadderState,
    resetLadderOnly: resetLadderOnly,
    getLadderArduino: getLadderArduino,
    getLadderLabels: getLadderLabels,
    makeDualProject: makeDualProject,
    loadProjectSelective: loadProjectSelective,
    inspectProject: inspectProject,
    getDiagnostics: diagnostics
  };

  global.SimuPLCEditors = api;
  global.SimuPLCSeparateEditors = api;
})(window);
