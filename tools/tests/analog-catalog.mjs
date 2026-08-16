import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'assets/js/shared/analog-block-catalog.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
new vm.Script(source, {filename:'analog-block-catalog.js'}).runInContext(sandbox);
const catalog = sandbox.window.SimuPLCAnalogCatalog;
const expected = {
  analog_input:['AI','Entrada analógica','analog'],
  scale:['SCALE','Escalamiento','analog'],
  gt:['>','Mayor que','digital'],
  lt:['<','Menor que','digital'],
  eq:['=','Igual a','digital'],
  gte:['≥','Mayor o igual','digital'],
  lte:['≤','Menor o igual','digital'],
  hyst:['HYS','Histéresis','digital']
};
const failures=[];
if(!catalog) failures.push('No se publicó SimuPLCAnalogCatalog.');
for(const [type,[symbol,name,outputType]] of Object.entries(expected)){
  const def=catalog && catalog.get(type);
  if(!def) failures.push(`Falta ${type}.`);
  else {
    if(def.symbol!==symbol) failures.push(`${type}: símbolo ${def.symbol}.`);
    if(def.name!==name) failures.push(`${type}: nombre ${def.name}.`);
    if(def.outputType!==outputType) failures.push(`${type}: salida ${def.outputType}.`);
    if(def.editors.fbd!==true) failures.push(`${type}: FBD no marcado como implementado.`);
    if(def.editors.ladder!==true) failures.push(`${type}: Ladder no marcado como implementado.`);
  }
}
if(catalog.normalizeType('>=')!=='gte') failures.push('Alias >= incorrecto.');
if(catalog.normalizeType('entrada analógica')!=='analog_input') failures.push('Alias entrada analógica incorrecto.');
if(failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log(JSON.stringify(catalog.getDiagnostics(),null,2));
