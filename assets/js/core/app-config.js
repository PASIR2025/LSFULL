(function (global) {
  'use strict';

  if (global.SimuPLCConfig) return;

  global.SimuPLCConfig = Object.freeze({
    appName: 'SimuPLC Lab',
    appVersion: '1.6.0-phase3',
    buildDate: '2026-07-15',
    projectType: 'simuplc-project',
    projectSchemaVersion: 1,
    legacyDualProjectType: 'simuplc-dual-project',
    storage: Object.freeze({
      circuits: 'logicsoft_circuits_v1',
      lastLegacyDualProject: 'simuplc_last_dual_project_v2',
      lastCanonicalProject: 'simuplc_last_project_v1',
      ladderProjects: 'ladder_test_phase9_projects_v1',
      editorMode: 'simuplc_editor_mode_v1',
      phase1Backup: 'simuplc_phase1_storage_backup_v1',
      autosaveProject: 'simuplc_autosave_project_v1',
      recoveryState: 'simuplc_recovery_state_v1',
      backupHistory: 'simuplc_backup_history_v1'
    })
  });
})(window);
