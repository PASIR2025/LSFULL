(function (global) {
  'use strict';

  if (global.__SIMUPLC_PLC_PROFILE_UI_V16__) return;
  global.__SIMUPLC_PLC_PROFILE_UI_V16__ = true;

  const api = global.SimuPLCPLCProfile;
  if (!api) return;

  let migrationBusy = false;
  let lastMigrationAt = 0;

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
  }

  function ensureStyle() {
    if (document.getElementById('simuplc-plc-profile-v16-style')) return;
    const style = document.createElement('style');
    style.id = 'simuplc-plc-profile-v16-style';
    style.textContent = `
      #simuplcPlcProfileWrap{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 7px;border:1px solid #91a1b2;border-radius:9px;background:linear-gradient(#fff,#edf3f8);box-sizing:border-box;flex:0 0 auto;box-shadow:0 1px 2px rgba(15,23,42,.08)}
      #simuplcPlcProfileWrap .plc-chip{font:900 10px/1 Arial;color:#27435d;letter-spacing:.25px;white-space:nowrap}
      #simuplcPlcProfileSelect{height:28px;max-width:190px;border:0;background:transparent;color:#102a43;font:800 11px/1.1 Arial;outline:none;cursor:pointer}
      #simuplcPlcAddressBadge{display:inline-flex;align-items:center;height:22px;padding:0 7px;border-radius:999px;background:#dff5ff;color:#075985;font:900 10px/1 Arial;white-space:nowrap;border:1px solid #7dd3fc}
      html.theme-logosoft #simuplcPlcProfileWrap{background:#f4f4f4;border-color:#8e8e8e;border-radius:2px;box-shadow:none}
      html.theme-logosoft #simuplcPlcAddressBadge{background:#fff;border-color:#8e8e8e;color:#222;border-radius:2px}
      html.theme-dark #simuplcPlcProfileWrap{background:#111827;border-color:#475569;box-shadow:none}
      html.theme-dark #simuplcPlcProfileWrap .plc-chip,html.theme-dark #simuplcPlcProfileSelect{color:#e5e7eb}
      html.theme-dark #simuplcPlcAddressBadge{background:#0c4a6e;color:#e0f2fe;border-color:#0369a1}
      html.theme-plomo #simuplcPlcProfileWrap{background:#d8dde3;border-color:#8995a1}
      @media(max-width:820px){#simuplcPlcProfileWrap{height:32px;padding:0 5px;gap:3px}#simuplcPlcProfileSelect{max-width:130px;font-size:10px}#simuplcPlcAddressBadge{display:none}#simuplcPlcProfileWrap .plc-chip{display:none}}
      @media(max-width:520px){#simuplcPlcProfileSelect{max-width:108px}}
    `;
    document.head.appendChild(style);
  }

  function ensureSelector() {
    ensureStyle();
    let wrap = document.getElementById('simuplcPlcProfileWrap');
    if (wrap) return wrap;
    const top = document.getElementById('topbar');
    if (!top) return null;
    wrap = document.createElement('div');
    wrap.id = 'simuplcPlcProfileWrap';
    wrap.title = 'PLC global del proyecto';
    const options = Object.keys(api.profiles).map(function (id) {
      const p = api.profiles[id];
      return '<option value="' + id + '">' + p.label + '</option>';
    }).join('');
    wrap.innerHTML = '<span class="plc-chip">PLC</span><select id="simuplcPlcProfileSelect" aria-label="PLC del proyecto">' + options + '</select><span id="simuplcPlcAddressBadge"></span>';
    const anchor = document.getElementById('modeFBDBtn');
    if (anchor && anchor.parentNode === top) top.insertBefore(wrap, anchor);
    else top.insertBefore(wrap, top.firstChild);
    const select = wrap.querySelector('select');
    select.addEventListener('change', function () {
      api.set(this.value, { source: 'selector', migrate: true });
    });
    return wrap;
  }

  function updateSelector() {
    ensureSelector();
    const p = api.get();
    const select = document.getElementById('simuplcPlcProfileSelect');
    const badge = document.getElementById('simuplcPlcAddressBadge');
    if (select && select.value !== p.id) select.value = p.id;
    if (badge) badge.textContent = p.short;
    if (select) select.title = p.description || p.label;

    const btn = document.getElementById('btnArduino');
    if (btn) {
      const unavailable = !api.codegenAllowed();
      btn.disabled = unavailable;
      btn.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
      btn.style.opacity = unavailable ? '.48' : '';
      btn.title = unavailable
        ? 'CÓDIGO MCU no corresponde a ' + p.label + '. Selecciona PLC con Arduino, PLC con ESP32 o SimuPLC actual.'
        : 'Generar C++ usando ' + p.short + ' (' + p.label + ')';
    }

    // La tabla de variables / generador toma la placa apropiada sin eliminar la selección Arduino existente.
    api.applyRecommendedBoard();
    const boardSelect = document.getElementById('arduinoBoardSelect');
    const preferred = api.preferredBoard();
    if (boardSelect && p.mcu === 'esp32' && boardSelect.value !== 'esp32') {
      boardSelect.value = 'esp32';
      boardSelect.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (boardSelect && p.mcu === 'arduino' && boardSelect.value === 'esp32') {
      boardSelect.value = preferred === 'esp32' ? 'uno' : preferred;
      boardSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const placeholders = [
      ['hmiPropTag', api.formatAddress('I', 0) + ', ' + api.formatAddress('Q', 0)],
      ['hmiPropTag2', api.formatAddress('Q', 1) + ' o ' + api.formatAddress('I', 1)],
      ['hmiPropTag3', api.formatAddress('Q', 0) + ' o ' + api.formatAddress('Q', 0) + ',' + api.formatAddress('Q', 1)],
      ['hmiPropTag4', api.formatAddress('Q', 1) + ' o ' + api.formatAddress('Q', 1) + ',' + api.formatAddress('Q', 2)]
    ];
    placeholders.forEach(function (entry) {
      const el = document.getElementById(entry[0]);
      if (el) el.placeholder = entry[1];
    });

    [['hmiLiveI1','I',0],['hmiLiveI2','I',1],['hmiLiveI3','I',2],['hmiLiveI4','I',3],['hmiLiveI5','I',4],['hmiLiveQ1','Q',0],['hmiLiveQ2','Q',1],['hmiLiveQ3','Q',2]].forEach(function (entry) {
      const valueEl = document.getElementById(entry[0]);
      const labelEl = valueEl && valueEl.previousElementSibling;
      if (labelEl) labelEl.textContent = api.formatAddress(entry[1], entry[2]);
    });
  }

  function translateState(state) {
    return api.translatedClone(state, api.getId());
  }

  async function migrateFBD() {
    try {
      const editors = global.SimuPLCEditors || global.SimuPLCSeparateEditors;
      if (!editors || typeof editors.getFBDState !== 'function' || typeof editors.loadFBDState !== 'function') return false;
      const before = editors.getFBDState();
      if (!before) return false;
      const after = translateState(before);
      if (JSON.stringify(before) === JSON.stringify(after)) return false;
      return editors.loadFBDState(after) !== false;
    } catch (error) {
      console.warn('[PLC V16] No se pudo migrar FBD.', error);
      return false;
    }
  }

  async function migrateLadder() {
    try {
      const editors = global.SimuPLCEditors || global.SimuPLCSeparateEditors;
      if (!editors || typeof editors.getLadderState !== 'function' || typeof editors.loadLadderState !== 'function') return false;
      const before = await editors.getLadderState();
      if (!before) return false;
      const after = translateState(before);
      if (after.settings && typeof after.settings === 'object') after.settings.plcProfileId = api.getId();
      if (JSON.stringify(before) === JSON.stringify(after)) {
        sendProfileToLadder();
        return false;
      }
      const result = await editors.loadLadderState(after);
      sendProfileToLadder();
      return result !== false;
    } catch (error) {
      console.warn('[PLC V16] No se pudo migrar Ladder.', error);
      sendProfileToLadder();
      return false;
    }
  }

  function migrateHMI() {
    try {
      const hmi = global.SimuPLCHMI;
      if (!hmi || typeof hmi.getProject !== 'function' || typeof hmi.loadProject !== 'function') return false;
      const before = hmi.getProject();
      if (!before) return false;
      const after = translateState(before);
      after.plcProfileId = api.getId();
      if (JSON.stringify(before) === JSON.stringify(after)) return false;
      hmi.loadProject(after);
      return true;
    } catch (error) {
      console.warn('[PLC V16] No se pudo migrar HMI.', error);
      return false;
    }
  }

  function sendProfileToLadder() {
    try {
      const frame = document.getElementById('ladderFrame');
      if (!frame || !frame.contentWindow) return;
      const p = api.get();
      frame.contentWindow.postMessage({
        source: 'simuplc-main',
        target: 'ladder-plc-profile',
        action: 'setProfile',
        payload: { id: p.id, label: p.label, short: p.short, addressMode: p.addressMode, mcu: p.mcu }
      }, '*');
    } catch (_) {}
  }

  async function migrateAll() {
    if (migrationBusy) return false;
    migrationBusy = true;
    lastMigrationAt = Date.now();
    try {
      await migrateFBD();
      await migrateLadder();
      migrateHMI();
      updateSelector();
      if (global.SimuPLCVariableManager && typeof global.SimuPLCVariableManager.refresh === 'function') {
        try { await global.SimuPLCVariableManager.refresh(); } catch (_) {}
      }
      return true;
    } finally {
      migrationBusy = false;
    }
  }

  function patchHmiCreationEvents() {
    document.addEventListener('click', function (event) {
      const target = event.target && event.target.closest && event.target.closest('[data-hmi-add],#hmiApplyTemplateBtn');
      if (!target) return;
      setTimeout(function () { migrateHMI(); }, 0);
      setTimeout(function () { migrateHMI(); }, 80);
    }, true);
  }

  function patchCompleteProjectAPI() {
    const hmiProject = global.SimuPLCHMIProject;
    if (!hmiProject || hmiProject.__plcProfileV16Patched) return false;
    hmiProject.__plcProfileV16Patched = true;
    const rawMake = typeof hmiProject.makeComplete === 'function' ? hmiProject.makeComplete.bind(hmiProject) : null;
    const rawLoad = typeof hmiProject.loadComplete === 'function' ? hmiProject.loadComplete.bind(hmiProject) : null;
    if (rawMake) {
      hmiProject.makeComplete = async function () {
        const project = await rawMake.apply(null, arguments);
        if (project) {
          project.plcProfileId = api.getId();
          project.hardware = global.SimuPLCVariableManager && typeof global.SimuPLCVariableManager.exportConfig === 'function'
            ? global.SimuPLCVariableManager.exportConfig()
            : (project.hardware || { plcProfileId: api.getId() });
        }
        return project;
      };
    }
    if (rawLoad) {
      hmiProject.loadComplete = async function (project) {
        const profileId = project && (project.plcProfileId || project.hardware && project.hardware.plcProfileId);
        if (profileId) api.set(profileId, { source: 'project-load', migrate: false, migrateStorage: false });
        const result = await rawLoad.apply(null, arguments);
        updateSelector();
        sendProfileToLadder();
        return result;
      };
    }
    return true;
  }

  function patchProjectAPIs() {
    // Canonical/base project: hardware is already persisted by Variable Manager.
    const editors = global.SimuPLCEditors || global.SimuPLCSeparateEditors;
    if (editors && !editors.__plcProfileV16LoadPatched && typeof editors.loadProjectSelective === 'function') {
      editors.__plcProfileV16LoadPatched = true;
      const rawLoad = editors.loadProjectSelective.bind(editors);
      editors.loadProjectSelective = async function (project) {
        const profileId = project && (project.plcProfileId || project.hardware && project.hardware.plcProfileId);
        if (profileId) api.set(profileId, { source: 'project-load', migrate: false, migrateStorage: false });
        const result = await rawLoad.apply(null, arguments);
        updateSelector();
        sendProfileToLadder();
        return result;
      };
    }
    patchCompleteProjectAPI();
  }

  global.addEventListener('simuplc-plc-profile-changed', function (event) {
    updateSelector();
    sendProfileToLadder();
    const detail = event && event.detail || {};
    if (detail.migrate !== false && detail.previousId !== detail.id) migrateAll();
  });

  function boot() {
    ensureSelector();
    updateSelector();
    patchProjectAPIs();
    sendProfileToLadder();
    if (api.getId() !== 'classic') setTimeout(function(){ migrateAll(); }, 250);
    const frame = document.getElementById('ladderFrame');
    if (frame) frame.addEventListener('load', function () { setTimeout(function(){ sendProfileToLadder(); migrateLadder(); }, 120); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;
    ensureSelector();
    updateSelector();
    patchProjectAPIs();
    sendProfileToLadder();
    if (tries >= 30) clearInterval(timer);
  }, 250);

  global.SimuPLCPLCProfileUI = Object.freeze({
    version: 16,
    migrateAll: migrateAll,
    migrateFBD: migrateFBD,
    migrateLadder: migrateLadder,
    migrateHMI: migrateHMI,
    update: updateSelector,
    getDiagnostics: function () { return { ok: true, migrationBusy: migrationBusy, lastMigrationAt: lastMigrationAt, profile: clone(api.get()) }; }
  });
})(window);
