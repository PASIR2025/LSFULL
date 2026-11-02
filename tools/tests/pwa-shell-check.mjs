import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const sandbox = {
  self: { addEventListener() {}, skipWaiting() {}, clients: { claim() {} }, location: { origin: 'http://localhost' } },
  caches: {}, fetch() {}, URL, Promise, console
};
vm.createContext(sandbox);
new vm.Script(source.replace(/self\.addEventListener\([\s\S]*$/m, '')).runInContext(sandbox);

const cacheMatch = source.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)/);
const shellMatch = source.match(/const APP_SHELL\s*=\s*(\[[\s\S]*?\]);/);
if (!cacheMatch || !shellMatch) throw new Error('No se pudo leer CACHE_NAME o APP_SHELL.');
const appShell = vm.runInNewContext(shellMatch[1]);
const missing = [];
for (const item of appShell) {
  if (item === './') continue;
  const rel = item.replace(/^\.\//, '');
  if (!fs.existsSync(path.join(root, rel))) missing.push(item);
}
const duplicates = appShell.filter((item, index) => appShell.indexOf(item) !== index);
const required = [
  './assets/js/core/editor-frame-bridge.js',
  './assets/js/core/editor-service.js',
  './assets/js/fbd/fbd-simulation-engine.js',
  './assets/js/fbd/fbd-simulation-view.js',
  './assets/js/fbd/fbd-simulation-service.js',
  './assets/js/fbd/fbd-selection-service.js',
  './assets/js/fbd/fbd-wire-geometry.js',
  './assets/js/fbd/fbd-wiring-service.js',
  './assets/js/fbd/fbd-movement-service.js',
  './assets/js/fbd/fbd-component-service.js',
  './assets/js/shared/analog-block-catalog.js',
  './assets/js/shared/text-palette.js',
  './assets/js/fbd/fbd-documentation-service.js',
  './assets/js/fbd/fbd-analog-service.js',
  './assets/js/ladder/ladder-documentation-service.js',
  './assets/js/ladder/ladder-analog-input-service.js',
  './assets/js/ladder/ladder-analog-processing-service.js',
  './assets/js/ladder/ladder-wiring-service.js',
  './assets/js/core/project-repository.js',
  './assets/js/core/project-io.js',
  './assets/js/core/ladder-host-bridge.js'
];
const absentRequired = required.filter(item => !appShell.includes(item));
const result = {
  ok: cacheMatch[1] === 'simuplc-lab-pwa-v33-phase2-step14' && !missing.length && !duplicates.length && !absentRequired.length,
  cacheName: cacheMatch[1],
  assetCount: appShell.length,
  missing,
  duplicates,
  absentRequired
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
