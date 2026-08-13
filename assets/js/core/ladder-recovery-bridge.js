(function (global) {
  'use strict';

  if (global.__SIMUPLC_LADDER_RECOVERY_BRIDGE__) return;
  global.__SIMUPLC_LADDER_RECOVERY_BRIDGE__ = true;

  let timer = null;
  function notify(reason) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      try {
        if (global.parent && global.parent !== global) {
          const detail = { reason: reason || 'ladder-change', at: Date.now() };
          global.parent.postMessage({
            source: 'simuplc-ladder',
            target: 'simuplc-main',
            action: 'editorChanged',
            reason: detail.reason,
            at: detail.at
          }, '*');
          if (global.SimuPLCLadderHostBridge && typeof global.SimuPLCLadderHostBridge.emitEvent === 'function') {
            global.SimuPLCLadderHostBridge.emitEvent('editorChanged', detail);
          }
        }
      } catch (_error) {}
    }, 250);
  }

  function bind() {
    ['pointerup', 'change', 'input', 'keyup'].forEach(function (eventName) {
      document.addEventListener(eventName, function (event) {
        const target = event && event.target;
        if (target && target.closest && target.closest('.overlay')) return;
        notify(eventName);
      }, true);
    });

    const originalMarkDirty = global.markModelDirty;
    if (typeof originalMarkDirty === 'function' && !originalMarkDirty.__simuplcRecoveryWrapped) {
      const wrapped = function () {
        const result = originalMarkDirty.apply(this, arguments);
        notify('model-dirty');
        return result;
      };
      wrapped.__simuplcRecoveryWrapped = true;
      global.markModelDirty = wrapped;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  global.SimuPLCLadderRecoveryBridge = Object.freeze({ notify: notify });
})(window);
