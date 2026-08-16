(function (global) {
  'use strict';

  if (global.__SIMUPLC_LADDER_PLC_PROFILE_V16__) return;
  global.__SIMUPLC_LADDER_PLC_PROFILE_V16__ = true;

  const api = global.SimuPLCPLCProfile;
  if (!api) return;

  function allElements() {
    const output = [];
    function walk(list) {
      (list || []).forEach(function (element) {
        if (!element) return;
        output.push(element);
        if (String(element.type || '').toUpperCase() === 'BRANCH') (element.branches || []).forEach(walk);
      });
    }
    try { (state && state.ladder && state.ladder.rungs || []).forEach(function (rung) { walk(rung.elements || []); }); } catch (_) {}
    return output;
  }

  function nextAddress(area) {
    const used = new Set();
    allElements().forEach(function (element) {
      const p = api.parseAddress(element && element.label);
      if (p && p.area === area) used.add(p.slot);
    });
    let slot = 0;
    while (used.has(slot)) slot += 1;
    return api.formatAddress(area, slot);
  }

  function patchDefaultLabels() {
    try {
      const previous = global.defaultLabelForType || (typeof defaultLabelForType === 'function' ? defaultLabelForType : null);
      if (!previous || previous.__plcProfileV16) return;
      const wrapped = function (type) {
        const t = String(type || '').toUpperCase();
        if (t === 'NO' || t === 'NC') return nextAddress('I');
        if (t === 'COIL' || t === 'SET' || t === 'RESET') return nextAddress('Q');
        return previous(type);
      };
      wrapped.__plcProfileV16 = true;
      global.defaultLabelForType = wrapped;
      try { defaultLabelForType = wrapped; } catch (_) {}
    } catch (error) { console.warn('[Ladder PLC V16] defaultLabelForType:', error); }
  }

  function normalizeEditInput() {
    const input = document.getElementById('editNameInput');
    if (!input) return;
    const parsed = api.parseAddress(input.value);
    if (parsed) input.value = api.formatAddress(parsed.area, parsed.slot);
  }

  function updateUi() {
    const input = document.getElementById('editNameInput');
    if (input) input.placeholder = 'Ejemplo: ' + api.formatAddress('I', 0) + ', ' + api.formatAddress('Q', 0) + ', M1';
    try {
      document.documentElement.dataset.plcProfile = api.getId();
      document.body.dataset.plcProfile = api.getId();
    } catch (_) {}
  }

  function setProfileFromParent(id) {
    if (!id || !api.profiles[id]) return;
    api.set(id, { source: 'parent', migrate: false, migrateStorage: false, emit: true });
    patchDefaultLabels();
    updateUi();
  }

  global.addEventListener('message', function (event) {
    const message = event && event.data || {};
    if (message.target !== 'ladder-plc-profile' || message.action !== 'setProfile') return;
    setProfileFromParent(message.payload && message.payload.id);
  });

  global.addEventListener('simuplc-plc-profile-changed', function () {
    patchDefaultLabels();
    updateUi();
    try { if (typeof draw === 'function') draw(); } catch (_) {}
  });

  // Captura antes del listener original para que guardar acepte I0.0/Q0.0 y normalice según el PLC.
  document.addEventListener('click', function (event) {
    const save = event.target && event.target.closest && event.target.closest('#saveEditModal');
    if (save) normalizeEditInput();
  }, true);

  function boot() {
    patchDefaultLabels();
    updateUi();
    // El parent comparte localStorage; si Ladder se abre solo, mantiene el perfil persistido.
    try {
      const parentApi = global.parent && global.parent !== global && global.parent.SimuPLCPLCProfile;
      if (parentApi && parentApi.getId) setProfileFromParent(parentApi.getId());
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  global.SimuPLCLadderPLCProfile = Object.freeze({
    version: 16,
    nextAddress: nextAddress,
    update: updateUi,
    normalizeEditInput: normalizeEditInput
  });
})(window);
