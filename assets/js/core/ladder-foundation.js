(function (global) {
  'use strict';

  if (global.__SIMUPLC_LADDER_PHASE1__) return;
  global.__SIMUPLC_LADDER_PHASE1__ = true;

  function init() {
    try { global.SimuPLCStorage && global.SimuPLCStorage.ensureInitialBackup(); } catch (error) {
      console.warn('[Ladder Fase 1] No se pudo crear el respaldo inicial.', error);
    }

    global.SimuPLCLadderHealth = function () {
      return {
        ok: typeof global.getLadderProject === 'function' && typeof global.setLadderProject === 'function',
        getProject: typeof global.getLadderProject === 'function',
        setProject: typeof global.setLadderProject === 'function',
        hostBridge: !!global.SimuPLCLadderHostBridge,
        checkedAt: new Date().toISOString()
      };
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
