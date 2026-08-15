(function (global) {
  'use strict';

  if (global.SimuPLCProjectIO) return;

  const MODULE_VERSION = '1.6.0-phase3';

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return value; }
  }

  function getEditors() {
    return global.SimuPLCEditors || global.SimuPLCSeparateEditors || {};
  }

  function getSchema() {
    return global.SimuPLCProjectSchema || null;
  }

  function getRecovery() {
    return global.SimuPLCRecovery || null;
  }

  function safeFileName(name) {
    return String(name || 'Proyecto SimuPLC')
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
      .replace(/\s+/g, '_') || 'Proyecto_SimuPLC';
  }

  function downloadJSON(value, filename) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || 'Proyecto_SimuPLC.json';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 250);
    return true;
  }

  async function captureCurrentProject(name) {
    const editors = getEditors();
    let project = null;
    if (typeof editors.makeDualProject === 'function') project = await editors.makeDualProject(name);
    else if (global.SimuPLCProject && typeof global.SimuPLCProject.makeUnifiedProject === 'function') {
      project = await global.SimuPLCProject.makeUnifiedProject(name);
    }
    if (!project) throw new Error('No se pudo leer el proyecto actual.');
    const schema = getSchema();
    return schema && typeof schema.migrate === 'function' ? schema.migrate(project) : project;
  }

  function parseImportText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('El archivo está vacío.');
    const recovery = getRecovery();
    if (recovery && typeof recovery.validateImportText === 'function') return recovery.validateImportText(text);
    try { return JSON.parse(text); }
    catch (error) { throw new Error('El archivo JSON está dañado o incompleto.'); }
  }

  async function currentFallbacks() {
    const editors = getEditors();
    return {
      fbd: typeof editors.getFBDState === 'function' ? editors.getFBDState() : undefined,
      ladder: typeof editors.getLadderState === 'function' ? await editors.getLadderState() : undefined
    };
  }

  async function prepareImport(source) {
    const schema = getSchema();
    if (!schema) return clone(source);
    if (typeof schema.validateImportSource === 'function') {
      const inspection = schema.validateImportSource(source);
      if (!inspection.ok) throw new Error(inspection.errors.join(' '));
    }
    const canonical = typeof schema.migrate === 'function'
      ? schema.migrate(source, await currentFallbacks())
      : clone(source);
    if (typeof schema.validate === 'function') {
      const validation = schema.validate(canonical, { strict: true });
      if (!validation.ok) throw new Error(validation.errors.join(' '));
    }
    return canonical;
  }

  async function loadCanonical(project) {
    const editors = getEditors();
    if (typeof editors.loadProjectSelective === 'function') return editors.loadProjectSelective(project);
    if (global.SimuPLCProject && typeof global.SimuPLCProject.loadUnifiedProject === 'function') {
      return global.SimuPLCProject.loadUnifiedProject(project);
    }
    throw new Error('El cargador de proyectos no está disponible.');
  }

  function validateEditorState(editor, state) {
    const schema = getSchema();
    const mode = editor === 'ladder' ? 'ladder' : 'fbd';
    if (!schema || typeof schema.createProject !== 'function' || typeof schema.validate !== 'function') return clone(state);

    const normalized = mode === 'ladder' && typeof schema.normalizeLadder === 'function'
      ? schema.normalizeLadder(state)
      : mode === 'fbd' && typeof schema.normalizeFBD === 'function'
        ? schema.normalizeFBD(state)
        : clone(state);
    const project = schema.createProject({
      activeEditor: mode,
      fbd: mode === 'fbd' ? normalized : schema.emptyFBD(),
      ladder: mode === 'ladder' ? normalized : schema.emptyLadder()
    });
    const check = schema.validate(project, { strict: true });
    if (!check.ok) throw new Error('El circuito ' + (mode === 'ladder' ? 'Ladder' : 'FBD') + ' está dañado: ' + check.errors.join(' '));
    return normalized;
  }

  function exportProject(project, preferredName) {
    const filename = safeFileName((project && project.name) || preferredName || 'Proyecto SimuPLC') + '.json';
    downloadJSON(project, filename);
    return filename;
  }

  function getDiagnostics() {
    const schema = getSchema();
    const editors = getEditors();
    return {
      ok: !!schema && (typeof editors.makeDualProject === 'function' || !!global.SimuPLCProject),
      version: MODULE_VERSION,
      schemaAvailable: !!schema,
      editorsAvailable: !!global.SimuPLCSeparateEditors,
      canCapture: typeof editors.makeDualProject === 'function' || !!(global.SimuPLCProject && global.SimuPLCProject.makeUnifiedProject),
      canLoad: typeof editors.loadProjectSelective === 'function' || !!(global.SimuPLCProject && global.SimuPLCProject.loadUnifiedProject)
    };
  }

  global.SimuPLCProjectIO = Object.freeze({
    version: MODULE_VERSION,
    safeFileName: safeFileName,
    downloadJSON: downloadJSON,
    captureCurrentProject: captureCurrentProject,
    parseImportText: parseImportText,
    prepareImport: prepareImport,
    loadCanonical: loadCanonical,
    validateEditorState: validateEditorState,
    exportProject: exportProject,
    getDiagnostics: getDiagnostics
  });
})(window);
