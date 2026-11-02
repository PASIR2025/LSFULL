(function (global) {
  'use strict';

  if (global.__SIMUPLC_PHASE1_BOOTSTRAP__) return;
  global.__SIMUPLC_PHASE1_BOOTSTRAP__ = true;

  function patchProjectAPIs() {
    const schema = global.SimuPLCProjectSchema;
    const storage = global.SimuPLCStorage;
    const config = global.SimuPLCConfig;
    if (!schema || !config) return false;

    const unified = global.SimuPLCProject;
    if (unified && !unified.__phase1Patched) {
      const rawMake = typeof unified.makeUnifiedProject === 'function' ? unified.makeUnifiedProject.bind(unified) : null;
      const rawLoad = typeof unified.loadUnifiedProject === 'function' ? unified.loadUnifiedProject.bind(unified) : null;

      if (rawMake) {
        unified.makeUnifiedProject = async function (name) {
          const legacy = await rawMake(name);
          const canonical = schema.migrate(legacy);
          if (storage) storage.setJSON(config.storage.lastCanonicalProject, canonical);
          return canonical;
        };
      }

      if (rawLoad) {
        unified.loadUnifiedProject = async function (project) {
          const canonical = schema.migrate(project);
          if (storage) storage.setJSON(config.storage.lastCanonicalProject, canonical);
          return rawLoad(schema.toLegacyDual(canonical));
        };
      }

      unified.__phase1Patched = true;
    }

    const editors = global.SimuPLCEditors || global.SimuPLCSeparateEditors;
    if (editors && !editors.__phase1Patched) {
      const rawMakeDual = typeof editors.makeDualProject === 'function' ? editors.makeDualProject.bind(editors) : null;
      const rawLoadSelective = typeof editors.loadProjectSelective === 'function' ? editors.loadProjectSelective.bind(editors) : null;

      if (rawMakeDual) {
        editors.makeDualProject = async function (name) {
          const legacy = await rawMakeDual(name);
          return schema.migrate(legacy);
        };
      }

      if (rawLoadSelective) {
        editors.loadProjectSelective = async function (project) {
          const canonical = schema.migrate(project, {
            fbd: typeof editors.getFBDState === 'function' ? editors.getFBDState() : undefined,
            ladder: typeof editors.getLadderState === 'function' ? await editors.getLadderState() : undefined
          });
          if (storage) storage.setJSON(config.storage.lastCanonicalProject, canonical);
          return rawLoadSelective(canonical);
        };
      }

      editors.__phase1Patched = true;
    }

    return true;
  }

  function healthReport() {
    const schema = global.SimuPLCProjectSchema;
    const checks = {
      config: !!global.SimuPLCConfig,
      storage: !!global.SimuPLCStorage,
      projectSchema: !!schema,
      projectRepository: !!global.SimuPLCProjectRepository,
      projectIO: !!global.SimuPLCProjectIO,
      recovery: !!global.SimuPLCRecovery,
      fbdSelection: !!global.SimuPLCFBDSelection,
      fbdMovement: !!global.SimuPLCFBDMovement,
      fbdComponents: !!global.SimuPLCFBDComponents,
      fbdAnalog: !!global.SimuPLCFBDAnalog,
      fbdWireGeometry: !!global.SimuPLCFBDWireGeometry,
      fbdWiring: !!global.SimuPLCFBDWiring,
      fbdSimulationEngine: !!global.SimuPLCFBDSimulationEngine,
      fbdSimulationView: !!global.SimuPLCFBDSimulationView,
      fbdSimulation: !!global.SimuPLCFBDSimulation,
      fbdSerialize: typeof global.serializeFBD === 'function' || typeof global.serialize === 'function',
      fbdLoad: typeof global.deserializeFBD === 'function' || typeof global.loadFromData === 'function',
      unifiedProjectAPI: !!global.SimuPLCProject,
      editorFrameBridge: !!global.SimuPLCEditorFrameBridge,
      editorService: !!global.SimuPLCEditors,
      separateEditorsAPI: !!global.SimuPLCSeparateEditors,
      ladderFrame: !!document.getElementById('ladderFrame')
    };
    const ok = Object.keys(checks).every(function (key) { return checks[key]; });
    return {
      ok: ok,
      appVersion: global.SimuPLCConfig && global.SimuPLCConfig.appVersion,
      schemaVersion: global.SimuPLCConfig && global.SimuPLCConfig.projectSchemaVersion,
      checks: checks,
      checkedAt: new Date().toISOString()
    };
  }

  function init() {
    try { global.SimuPLCStorage && global.SimuPLCStorage.ensureInitialBackup(); } catch (error) {
      console.warn('[Fase 1] No se pudo crear el respaldo inicial.', error);
    }

    patchProjectAPIs();
    setTimeout(patchProjectAPIs, 100);
    setTimeout(patchProjectAPIs, 500);
    setTimeout(patchProjectAPIs, 1500);

    global.SimuPLCPhase1 = Object.freeze({
      version: global.SimuPLCConfig && global.SimuPLCConfig.appVersion,
      patchProjectAPIs: patchProjectAPIs,
      getHealthReport: healthReport,
      backupStorage: function (reason) { return global.SimuPLCStorage && global.SimuPLCStorage.makeBackup(reason || 'manual'); },
      restoreInitialBackup: function () { return global.SimuPLCStorage && global.SimuPLCStorage.restoreBackup(); },
      migrateProject: function (project) { return global.SimuPLCProjectSchema.migrate(project); },
      validateProject: function (project) { return global.SimuPLCProjectSchema.validate(project); },
      getRecoveryReport: function () { return global.SimuPLCRecovery && global.SimuPLCRecovery.getDiagnostics(); },
      listRecoveryBackups: function () { return global.SimuPLCRecovery ? global.SimuPLCRecovery.listBackups() : []; },
      getProjectRepositoryReport: function () { return global.SimuPLCProjectRepository && global.SimuPLCProjectRepository.getDiagnostics(); },
      getProjectIOReport: function () { return global.SimuPLCProjectIO && global.SimuPLCProjectIO.getDiagnostics(); },
      getEditorReport: function () { return global.SimuPLCEditors && global.SimuPLCEditors.getDiagnostics(); },
      getBridgeReport: function () { return global.SimuPLCEditorFrameBridge && global.SimuPLCEditorFrameBridge.getDiagnostics(); },
      getFBDWiringReport: function () { return global.SimuPLCFBDWiring && global.SimuPLCFBDWiring.getDiagnostics(); },
      getFBDSimulationReport: function () { return global.SimuPLCFBDSimulation && global.SimuPLCFBDSimulation.getDiagnostics(); },
      getFBDAnalogReport: function () { return global.SimuPLCFBDAnalog && global.SimuPLCFBDAnalog.getDiagnostics(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
