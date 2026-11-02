import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=fs.readFileSync(path.join(root,'assets/js/fbd/fbd-simulation-engine.js'),'utf8');
const context={window:{},console,Date,Map,Number,Math,Array,Object,String,Boolean,parseInt,isFinite,performance:{now:()=>0}};
context.window.window=context.window;
context.window.performance=context.performance;
context.window.Date=Date;
vm.createContext(context);
new vm.Script(source,{filename:'fbd-simulation-engine.js'}).runInContext(context);
const engine=context.window.SimuPLCFBDSimulationEngine;
const failures=[];
const check=(condition,message)=>{ if(!condition) failures.push(message); };
const term=(not=false)=>({dataset:{not:not?'1':'0'}});

function gate(type,values,{invert=[]}={}){
  const inputs=values.map((_,i)=>term(!!invert[i]));
  const gateNode={type,inputs,output:{},value:0};
  const inputNodes=values.map((value)=>({type:'input',inputs:[],output:{},mock:value,value:0}));
  const connections=inputNodes.map((node,i)=>({from:node.output,to:inputs[i]}));
  engine.scan({nodes:[...inputNodes,gateNode],connections,now:0,readInput:n=>n.mock});
  return gateNode.value;
}

const gateCases=[
  ['and',[1,1],1],['and',[1,0],0],
  ['or',[0,1],1],['or',[0,0],0],
  ['not',[1],0],['not',[0],1],
  ['nand',[1,1],0],['nand',[1,0],1],
  ['nor',[0,0],1],['nor',[0,1],0],
  ['xor',[1,0,0],1],['xor',[1,1,0],0],['xor',[1,1,1],1],
  ['xnor',[1,0,0],0],['xnor',[1,1,0],1]
];
for(const [type,values,expected] of gateCases){
  check(gate(type,values)===expected,`${type}(${values.join(',')}) debe ser ${expected}`);
}
check(gate('and',[1,0],{invert:[false,true]})===1,'La inversión de pin debe aplicarse antes de evaluar la compuerta.');

// SR retentivo
{
  const s=term(),r=term();
  const niS={type:'input',output:{},mock:1,value:0};
  const niR={type:'input',output:{},mock:0,value:0};
  const sr={type:'sr',inputs:[s,r],output:{},value:0,q:0};
  const connections=[{from:niS.output,to:s},{from:niR.output,to:r}];
  engine.scan({nodes:[niS,niR,sr],connections,now:0,readInput:n=>n.mock});
  check(sr.value===1,'SR debe activarse con S=1.');
  niS.mock=0;
  engine.scan({nodes:[niS,niR,sr],connections,now:1,readInput:n=>n.mock});
  check(sr.value===1,'SR debe mantener el estado sin S ni R.');
  niR.mock=1;
  engine.scan({nodes:[niS,niR,sr],connections,now:2,readInput:n=>n.mock});
  check(sr.value===0,'SR debe resetearse con R=1.');
}

// TON y TOFF con tiempo controlado
{
  const pin=term();
  const input={type:'input',output:{},mock:1,value:0};
  const ton={type:'ton',inputs:[pin],output:{},value:0,delayMs:50,timerStart:null};
  const connections=[{from:input.output,to:pin}];
  engine.scan({nodes:[input,ton],connections,now:100,readInput:n=>n.mock});
  check(ton.value===0,'TON debe iniciar desactivado.');
  engine.scan({nodes:[input,ton],connections,now:149,readInput:n=>n.mock});
  check(ton.value===0,'TON no debe terminar antes del tiempo.');
  engine.scan({nodes:[input,ton],connections,now:150,readInput:n=>n.mock});
  check(ton.value===1,'TON debe activarse al cumplir el tiempo.');
  input.mock=0;
  engine.scan({nodes:[input,ton],connections,now:151,readInput:n=>n.mock});
  check(ton.value===0 && ton.timerStart===null,'TON debe resetearse al perder la entrada.');
}
{
  const pin=term();
  const input={type:'input',output:{},mock:1,value:0};
  const toff={type:'toff',inputs:[pin],output:{},value:0,delayMs:50,timerStart:null,seenHigh:false};
  const connections=[{from:input.output,to:pin}];
  engine.scan({nodes:[input,toff],connections,now:100,readInput:n=>n.mock});
  check(toff.value===1,'TOFF debe activarse con entrada alta.');
  input.mock=0;
  engine.scan({nodes:[input,toff],connections,now:101,readInput:n=>n.mock});
  check(toff.value===1,'TOFF debe mantener la salida durante el retardo.');
  engine.scan({nodes:[input,toff],connections,now:150,readInput:n=>n.mock});
  check(toff.value===1,'TOFF debe seguir activo antes de 50 ms desde la caída.');
  engine.scan({nodes:[input,toff],connections,now:151,readInput:n=>n.mock});
  check(toff.value===0,'TOFF debe desactivarse al cumplir el retardo.');
}

// Contador UP/DOWN y reset
{
  const r=term(),cntPin=term(),dir=term();
  const reset={type:'input',output:{},mock:0,value:0};
  const count={type:'input',output:{},mock:0,value:0};
  const direction={type:'input',output:{},mock:0,value:0};
  const counter={type:'cnt',inputs:[r,cntPin,dir],output:{},value:0,cv:0,on:1,off:0,qState:0,prevCntIn:0};
  const connections=[{from:reset.output,to:r},{from:count.output,to:cntPin},{from:direction.output,to:dir}];
  const scan=()=>engine.scan({nodes:[reset,count,direction,counter],connections,now:0,readInput:n=>n.mock});
  scan(); count.mock=1; scan();
  check(counter.cv===1 && counter.value===1,'CNT debe incrementar y activar Q al primer flanco.');
  count.mock=0; scan(); count.mock=1; scan();
  check(counter.cv===2,'CNT debe incrementar solo por flanco ascendente.');
  count.mock=0; scan(); direction.mock=1; count.mock=1; scan();
  check(counter.cv===1,'CNT debe decrementar con Dir=1.');
  reset.mock=1; scan();
  check(counter.cv===0 && counter.value===0,'CNT debe resetear CV y Q.');
}

const result={ok:failures.length===0,failures,diagnostics:engine.getDiagnostics()};
console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);
