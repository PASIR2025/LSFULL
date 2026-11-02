(function (global) {
  'use strict';

  if (global.SimuPLCEditorFrameBridge) return;

  const VERSION = '1.6.0-phase3';
  const PROTOCOL = 'simuplc-editor-bridge-v1';
  const DEFAULT_TIMEOUT_MS = 3500;
  const pending = new Map();
  let sequence = 0;
  let ladderReady = false;
  let lastReadyAt = null;
  let sentCount = 0;
  let responseCount = 0;
  let timeoutCount = 0;
  let eventCount = 0;

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_error) { return value; }
  }

  function getFrame() {
    return document.getElementById('ladderFrame');
  }

  function getTarget() {
    const frame = getFrame();
    return frame && frame.contentWindow ? frame.contentWindow : null;
  }

  function makeRequestId() {
    sequence += 1;
    return 'bridge_' + Date.now().toString(36) + '_' + sequence.toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function dispatch(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent('simuplc:' + name, { detail: detail || {} }));
    } catch (_error) {}
  }

  function finish(requestId, result) {
    const entry = pending.get(requestId);
    if (!entry) return false;
    pending.delete(requestId);
    clearTimeout(entry.timer);
    entry.resolve(result);
    return true;
  }

  function onMessage(event) {
    const message = event && event.data;
    if (!message || message.protocol !== PROTOCOL) return;

    const target = getTarget();
    if (target && event.source && event.source !== target) return;

    if (message.direction === 'response' && message.requestId) {
      responseCount += 1;
      if (message.command === 'ping' && message.ok !== false) {
        ladderReady = true;
        lastReadyAt = new Date().toISOString();
      }
      finish(message.requestId, {
        ok: message.ok !== false,
        command: message.command,
        data: clone(message.data),
        error: message.error || null
      });
      return;
    }

    if (message.direction === 'event') {
      eventCount += 1;
      if (message.event === 'ready') {
        ladderReady = true;
        lastReadyAt = new Date().toISOString();
        dispatch('ladder-ready', clone(message.data) || {});
      } else if (message.event === 'editorChanged') {
        dispatch('ladder-changed', clone(message.data) || {});
      } else {
        dispatch('ladder-event', { event: message.event, data: clone(message.data) });
      }
    }
  }

  global.addEventListener('message', onMessage, true);

  function request(command, data, options) {
    options = options || {};
    return new Promise(function (resolve) {
      const target = getTarget();
      if (!target) {
        resolve({ ok: false, command: command, data: null, error: 'El editor Ladder todavía no está disponible.' });
        return;
      }

      const requestId = makeRequestId();
      const timeoutMs = Math.max(250, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
      const timer = setTimeout(function () {
        timeoutCount += 1;
        finish(requestId, {
          ok: false,
          command: command,
          data: null,
          error: 'Tiempo de espera agotado al comunicarse con Ladder.'
        });
      }, timeoutMs);

      pending.set(requestId, { resolve: resolve, timer: timer, command: command, startedAt: Date.now() });
      sentCount += 1;

      try {
        target.postMessage({
          protocol: PROTOCOL,
          direction: 'request',
          requestId: requestId,
          command: command,
          data: clone(data),
          sentAt: Date.now()
        }, '*');
      } catch (error) {
        finish(requestId, {
          ok: false,
          command: command,
          data: null,
          error: error && error.message ? error.message : String(error)
        });
      }
    });
  }

  async function requireSuccess(command, data, options) {
    const result = await request(command, data, options);
    if (!result.ok) throw new Error(result.error || ('Ladder no pudo ejecutar ' + command + '.'));
    return result.data;
  }

  async function ping(options) {
    const result = await request('ping', null, options);
    if (result.ok) {
      ladderReady = true;
      lastReadyAt = new Date().toISOString();
    }
    return result;
  }

  async function waitUntilReady(options) {
    options = options || {};
    const maxWaitMs = Math.max(250, Number(options.maxWaitMs) || 5000);
    const intervalMs = Math.max(80, Number(options.intervalMs) || 200);
    const started = Date.now();
    let latest = null;
    while (Date.now() - started < maxWaitMs) {
      latest = await ping({ timeoutMs: Math.min(900, Math.max(250, maxWaitMs - (Date.now() - started))) });
      if (latest.ok) return latest;
      await new Promise(function (resolve) { setTimeout(resolve, intervalMs); });
    }
    return latest || { ok: false, command: 'ping', error: 'Ladder no respondió.' };
  }

  function getDiagnostics() {
    const frame = getFrame();
    return {
      ok: !!frame && pending.size === 0,
      version: VERSION,
      protocol: PROTOCOL,
      frameExists: !!frame,
      targetAvailable: !!getTarget(),
      ladderReady: ladderReady,
      lastReadyAt: lastReadyAt,
      pendingCount: pending.size,
      sentCount: sentCount,
      responseCount: responseCount,
      timeoutCount: timeoutCount,
      eventCount: eventCount
    };
  }

  const api = {
    version: VERSION,
    protocol: PROTOCOL,
    request: request,
    requireSuccess: requireSuccess,
    ping: ping,
    waitUntilReady: waitUntilReady,
    getProject: function (options) { return requireSuccess('getProject', null, options); },
    setProject: function (project, options) { return requireSuccess('setProject', project, options); },
    resetProject: function (options) { return requireSuccess('resetProject', null, options); },
    getArduino: function (options) { return requireSuccess('getArduino', null, options); },
    getLabels: function (options) { return requireSuccess('getLabels', null, options); },
    getLadderDiagnostics: function (options) { return requireSuccess('getDiagnostics', null, options); },
    getDiagnostics: getDiagnostics
  };

  global.SimuPLCEditorFrameBridge = Object.freeze(api);
})(window);
