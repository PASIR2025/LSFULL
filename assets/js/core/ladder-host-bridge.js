(function (global) {
  'use strict';

  if (global.SimuPLCLadderHostBridge) return;

  const VERSION = '1.6.0-phase3';
  const PROTOCOL = 'simuplc-editor-bridge-v1';
  let requestCount = 0;
  let responseCount = 0;
  let errorCount = 0;
  let eventCount = 0;

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_error) { return value; }
  }

  function post(target, payload) {
    if (!target || typeof target.postMessage !== 'function') return false;
    target.postMessage(payload, '*');
    return true;
  }

  function getProject() {
    if (typeof global.getLadderProject !== 'function') throw new Error('La API getLadderProject no está disponible.');
    return clone(global.getLadderProject());
  }

  function setProject(project) {
    if (typeof global.setLadderProject !== 'function') throw new Error('La API setLadderProject no está disponible.');
    return global.setLadderProject(clone(project)) !== false;
  }

  function resetProject() {
    if (typeof global.resetLadderProject !== 'function') throw new Error('La API resetLadderProject no está disponible.');
    return global.resetLadderProject() !== false;
  }

  function getArduino() {
    if (typeof global.generateLadderArduinoSketch !== 'function') throw new Error('El generador Arduino Ladder no está disponible.');
    return String(global.generateLadderArduinoSketch() || '');
  }

  function getLabels() {
    if (typeof global.collectLadderLabels !== 'function') return { inputs: [], outputs: [], memories: [] };
    return clone(global.collectLadderLabels());
  }

  function diagnostics() {
    return {
      ok: typeof global.getLadderProject === 'function' && typeof global.setLadderProject === 'function' && typeof global.resetLadderProject === 'function',
      version: VERSION,
      protocol: PROTOCOL,
      canGetProject: typeof global.getLadderProject === 'function',
      canSetProject: typeof global.setLadderProject === 'function',
      canResetProject: typeof global.resetLadderProject === 'function',
      canGenerateArduino: typeof global.generateLadderArduinoSketch === 'function',
      canCollectLabels: typeof global.collectLadderLabels === 'function',
      requestCount: requestCount,
      responseCount: responseCount,
      errorCount: errorCount,
      eventCount: eventCount
    };
  }

  const handlers = {
    ping: function () { return diagnostics(); },
    getProject: getProject,
    setProject: setProject,
    resetProject: resetProject,
    getArduino: getArduino,
    getLabels: getLabels,
    getDiagnostics: diagnostics
  };

  function respond(event, message, ok, data, error) {
    responseCount += 1;
    post(event.source, {
      protocol: PROTOCOL,
      direction: 'response',
      requestId: message.requestId,
      command: message.command,
      ok: ok,
      data: clone(data),
      error: error || null,
      respondedAt: Date.now()
    });
  }

  function onMessage(event) {
    const message = event && event.data;
    if (!message || message.protocol !== PROTOCOL || message.direction !== 'request') return;
    requestCount += 1;
    const handler = handlers[message.command];
    if (!handler) {
      errorCount += 1;
      respond(event, message, false, null, 'Comando Ladder no reconocido: ' + message.command);
      return;
    }
    try {
      const result = handler(clone(message.data));
      if (result && typeof result.then === 'function') {
        result.then(function (data) { respond(event, message, true, data, null); })
          .catch(function (error) {
            errorCount += 1;
            respond(event, message, false, null, error && error.message ? error.message : String(error));
          });
      } else {
        respond(event, message, true, result, null);
      }
    } catch (error) {
      errorCount += 1;
      respond(event, message, false, null, error && error.message ? error.message : String(error));
    }
  }

  function emitEvent(name, data) {
    if (!global.parent || global.parent === global) return false;
    eventCount += 1;
    return post(global.parent, {
      protocol: PROTOCOL,
      direction: 'event',
      event: name,
      data: clone(data) || {},
      sentAt: Date.now()
    });
  }

  function announceReady() {
    emitEvent('ready', diagnostics());
  }

  global.addEventListener('message', onMessage, true);

  const api = {
    version: VERSION,
    protocol: PROTOCOL,
    emitEvent: emitEvent,
    announceReady: announceReady,
    getDiagnostics: diagnostics
  };
  global.SimuPLCLadderHostBridge = Object.freeze(api);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announceReady, { once: true });
  else announceReady();
  global.addEventListener('load', function () { setTimeout(announceReady, 50); }, { once: true });
})(window);
