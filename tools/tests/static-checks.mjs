import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const failures = [];

function fail(message) { failures.push(message); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

for (const rel of [
  'assets/js/main.js',
  'assets/js/core/app-config.js',
  'assets/js/core/storage-safe.js',
  'assets/js/core/project-schema.js',
  'assets/js/core/editor-frame-bridge.js',
  'assets/js/core/editor-service.js',
  'assets/js/fbd/fbd-simulation-engine.js',
  'assets/js/fbd/fbd-simulation-view.js',
  'assets/js/fbd/fbd-simulation-service.js',
  'assets/js/fbd/fbd-selection-service.js',
  'assets/js/fbd/fbd-wire-geometry.js',
  'assets/js/fbd/fbd-wiring-service.js',
  'assets/js/fbd/fbd-movement-service.js',
  'assets/js/fbd/fbd-component-service.js',
  'assets/js/shared/analog-block-catalog.js',
  'assets/js/fbd/fbd-analog-service.js',
  'assets/js/shared/text-palette.js',
  'assets/js/fbd/fbd-documentation-service.js',
  'assets/js/ladder/ladder-documentation-service.js',
  'assets/js/ladder/ladder-analog-input-service.js',
  'assets/js/core/project-repository.js',
  'assets/js/core/project-io.js',
  'assets/js/core/phase1-bootstrap.js',
  'assets/js/core/recovery-manager.js',
  'assets/js/core/action-controller.js',
  'assets/js/core/ladder-foundation.js',
  'assets/js/core/ladder-host-bridge.js',
  'assets/js/core/ladder-recovery-bridge.js',
  'service-worker.js'
]) {
  try { new vm.Script(read(rel), { filename: rel }); }
  catch (error) { fail(`${rel}: ${error.message}`); }
}

for (const rel of ['index.html', 'ladder_mobile_compact.html']) {
  const html = read(rel);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => {
    try { new vm.Script(match[1], { filename: `${rel}#inline-${index + 1}` }); }
    catch (error) { fail(`${rel} inline ${index + 1}: ${error.message}`); }
  });

  const refs = [...html.matchAll(/(?:src|href)=["'](\.\/?[^"'#?]+)["']/gi)].map(m => m[1]);
  refs.forEach(ref => {
    const clean = ref.replace(/^\.\//, '');
    if (!fs.existsSync(path.join(root, clean))) fail(`${rel}: recurso faltante ${ref}`);
  });
}

const index = read('index.html');
if (!index.includes('desiredCounts')) fail('No se encontró la corrección de contadores FBD.');
if (!index.includes('assets/js/core/editor-frame-bridge.js')) fail('No se carga editor-frame-bridge.js.');
if (!index.includes('assets/js/core/editor-service.js')) fail('No se carga editor-service.js.');
if (!index.includes('assets/js/fbd/fbd-simulation-engine.js')) fail('No se carga fbd-simulation-engine.js.');
if (!index.includes('assets/js/fbd/fbd-simulation-view.js')) fail('No se carga fbd-simulation-view.js.');
if (!index.includes('assets/js/fbd/fbd-simulation-service.js')) fail('No se carga fbd-simulation-service.js.');
if (!index.includes('assets/js/fbd/fbd-selection-service.js')) fail('No se carga fbd-selection-service.js.');
if (!index.includes('assets/js/fbd/fbd-wire-geometry.js')) fail('No se carga fbd-wire-geometry.js.');
if (!index.includes('assets/js/fbd/fbd-wiring-service.js')) fail('No se carga fbd-wiring-service.js.');
if (!index.includes('assets/js/fbd/fbd-movement-service.js')) fail('No se carga fbd-movement-service.js.');
if (!index.includes('assets/js/fbd/fbd-component-service.js')) fail('No se carga fbd-component-service.js.');
if (!index.includes('assets/js/shared/analog-block-catalog.js')) fail('No se carga analog-block-catalog.js en FBD.');
if (!index.includes('assets/js/fbd/fbd-analog-service.js')) fail('No se carga fbd-analog-service.js.');
if (!index.includes('assets/js/shared/text-palette.js')) fail('No se carga text-palette.js en FBD.');
if (!index.includes('assets/js/fbd/fbd-documentation-service.js')) fail('No se carga fbd-documentation-service.js.');
if (index.includes('assets/js/fbd/fbd-reference-service.js')) fail('Continúa cargándose el sistema simple de referencias FBD.');
if (index.includes('function evaluateGate(type,inputs)')) fail('El motor lógico antiguo continúa dentro de index.html.');
if (index.includes('setInterval(scanLogic,SCAN_MS)')) fail('El ciclo antiguo de simulación continúa dentro de index.html.');
if (!index.includes('SimuPLCFBDAdapter')) fail('No se encontró el adaptador FBD controlado.');
if (!index.includes('window.SimuPLCFBDWiring.bindNode(node)')) fail('enableConnections no delega al módulo de cableado.');
if (!index.includes('window.SimuPLCFBDWiring.create(fromTerm,toTerm)')) fail('createConnection no delega al módulo de cableado.');
if (!index.includes('window.SimuPLCFBDWiring.remove(conn)')) fail('removeConnection no delega al módulo de cableado.');
if (!index.includes('window.SimuPLCFBDWiring.update()')) fail('updateConnections no delega al módulo de cableado.');
if (index.includes('window.dragMove = function(el, node)')) fail('La capa antigua de movimiento con cuadrícula todavía reemplaza dragMove.');
if (!index.includes('__SimuPLCFBDPositionTransformer')) fail('No se integró el ajuste a cuadrícula con el módulo de movimiento.');
if (index.includes('id="chatgpt-final-separate-fbd-ladder-state"')) fail('El controlador inline antiguo FBD/Ladder todavía está activo.');
if (!index.includes('assets/js/core/project-repository.js')) fail('No se carga project-repository.js.');
if (!index.includes('assets/js/core/project-io.js')) fail('No se carga project-io.js.');
if (!index.includes('assets/js/core/phase1-bootstrap.js')) fail('No se carga phase1-bootstrap.js.');
if (!index.includes('assets/js/core/action-controller.js')) fail('No se carga action-controller.js.');
if (!index.includes('assets/js/core/recovery-manager.js')) fail('No se carga recovery-manager.js.');
const ladder = read('ladder_mobile_compact.html');
if (!ladder.includes('assets/js/core/ladder-host-bridge.js')) fail('No se carga ladder-host-bridge.js.');
if (!ladder.includes('assets/js/core/ladder-recovery-bridge.js')) fail('No se carga ladder-recovery-bridge.js.');
if (!ladder.includes('assets/js/shared/analog-block-catalog.js')) fail('No se carga analog-block-catalog.js en Ladder.');
if (!ladder.includes('assets/js/shared/text-palette.js')) fail('No se carga text-palette.js en Ladder.');
if (!ladder.includes('assets/js/ladder/ladder-documentation-service.js')) fail('No se carga ladder-documentation-service.js.');
if (!ladder.includes('assets/js/ladder/ladder-analog-input-service.js')) fail('No se carga ladder-analog-input-service.js.');


const actions = read('assets/js/core/action-controller.js');
for (const retired of ['function readCircuits()', 'function writeCircuits(', 'function persistLastProject(', 'function getCurrentCanonicalProject(', 'function normalizeSavedItem(']) {
  if (actions.includes(retired)) fail(`action-controller.js todavía contiene lógica retirada: ${retired}`);
}
if (!actions.includes('SimuPLCProjectRepository') && !actions.includes('getRepository')) fail('action-controller.js no usa el repositorio modular.');
if (!actions.includes('SimuPLCProjectIO') && !actions.includes('getProjectIO')) fail('action-controller.js no usa el servicio de proyectos modular.');

const sw = read('service-worker.js');
for (const asset of [
  './assets/js/core/app-config.js',
  './assets/js/core/storage-safe.js',
  './assets/js/core/project-schema.js',
  './assets/js/core/editor-frame-bridge.js',
  './assets/js/core/editor-service.js',
  './assets/js/fbd/fbd-simulation-engine.js',
  './assets/js/fbd/fbd-simulation-view.js',
  './assets/js/fbd/fbd-simulation-service.js',
  './assets/js/fbd/fbd-wire-geometry.js',
  './assets/js/fbd/fbd-wiring-service.js',
  './assets/js/fbd/fbd-component-service.js',
  './assets/js/fbd/fbd-movement-service.js',
  './assets/js/fbd/fbd-selection-service.js',
  './assets/js/shared/analog-block-catalog.js',
  './assets/js/fbd/fbd-analog-service.js',
  './assets/js/shared/text-palette.js',
  './assets/js/fbd/fbd-documentation-service.js',
  './assets/js/ladder/ladder-documentation-service.js',
  './assets/js/ladder/ladder-analog-input-service.js',
  './assets/js/core/project-repository.js',
  './assets/js/core/project-io.js',
  './assets/js/core/phase1-bootstrap.js',
  './assets/js/core/recovery-manager.js',
  './assets/js/core/action-controller.js',
  './assets/js/core/ladder-foundation.js',
  './assets/js/core/ladder-host-bridge.js',
  './assets/js/core/ladder-recovery-bridge.js'
]) {
  if (!sw.includes(asset)) fail(`Service worker no contiene ${asset}`);
}


const catalogSource = read('assets/js/shared/analog-block-catalog.js');
const catalogSandbox = { window: {} };
vm.createContext(catalogSandbox);
new vm.Script(catalogSource, { filename: 'analog-block-catalog.js' }).runInContext(catalogSandbox);
const analogCatalog = catalogSandbox.window.SimuPLCAnalogCatalog;
if (!analogCatalog || analogCatalog.list().length !== 13) fail('El catálogo analógico común no contiene los trece bloques esperados, incluido Split Range.');
for (const pair of [['analog_input','AI'],['scale','SCALE'],['gt','>'],['lt','<'],['eq','='],['gte','≥'],['lte','≤'],['hyst','HYS']]) {
  if (!analogCatalog || analogCatalog.symbolFor(pair[0]) !== pair[1]) fail(`Símbolo incorrecto para ${pair[0]}.`);
}
if (!index.includes("el.classList.toggle('lib-analog', isAnalog)")) fail('La biblioteca no aplica la clase visual analógica.');
if (!index.includes("lib-badge-mini lib-badge-analog")) fail('No se encontró el distintivo analógico reducido.');

if (failures.length) {
  console.error('PRUEBAS ESTÁTICAS: FALLARON');
  failures.forEach(item => console.error('-', item));
  process.exit(1);
}

console.log('PRUEBAS ESTÁTICAS: CORRECTAS');
