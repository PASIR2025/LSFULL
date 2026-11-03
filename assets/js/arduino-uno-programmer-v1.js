(function(global){
'use strict';
const COMPILER='https://cdn.jsdelivr.net/npm/@horang-corp/avr-gcc-wasm@0.2.0/+esm';
const COMPILER_ASSETS='https://cdn.jsdelivr.net/npm/@horang-corp/avr-gcc-wasm@0.2.0/';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function toast(msg,err){let el=document.getElementById('simuplcUnoProgramStatus');if(el){el.textContent=msg;el.style.color=err?'#b91c1c':'#166534';}console[err?'error':'log']('[UNO]',msg);}
function isAndroid(){return /Android/i.test(navigator.userAgent||'');}

// Toma el código generado internamente por SimuPLC. No usa portapapeles.
async function sketch(){
 if(global.SimuPLCMCUCodegen&&typeof global.SimuPLCMCUCodegen.refresh==='function'){
   const generated=await global.SimuPLCMCUCodegen.refresh(false);
   if(generated&&String(generated).trim()) return String(generated);
 }
 const ta=document.getElementById('arduinoCode');
 if(ta&&ta.value.trim()) return ta.value;
 if(typeof global.generateArduinoSketch==='function') return String(global.generateArduinoSketch()||'');
 throw new Error('No se pudo obtener el código generado por SimuPLC.');
}

// Arduino IDE añade Arduino.h automáticamente al convertir un .ino a C++.
// El compilador WASM recibe C++ directamente, por eso debemos hacer aquí esa misma preparación.
function prepareArduinoSource(src){
 let code=String(src||'').replace(/^\uFEFF/,'');
 if(!/^\s*#\s*include\s*[<\"]Arduino\.h[>\"]/m.test(code)) code='#include <Arduino.h>\n'+code;
 return code;
}

async function compile(src){
 toast('Compilando localmente para Arduino UNO…');
 const mod=await import(COMPILER);
 if(!mod||typeof mod.buildFirmware!=='function') throw new Error('No se pudo cargar el compilador AVR local.');
 const prepared=prepareArduinoSource(src);
 const result=await mod.buildFirmware({source:prepared,sensors:[],assetsBase:COMPILER_ASSETS});
 if(!result||!result.hex) throw new Error('El compilador no devolvió firmware HEX.');
 if(result.fitsTarget===false) throw new Error('El programa supera la memoria disponible del Arduino UNO.');
 return {hex:result.hex,flashBytes:result.flashBytes||0,ramBytes:result.ramBytes||0};
}
function parseHex(text){
 const mem=new Map();let upper=0,max=0;
 for(const raw of String(text).split(/\r?\n/)){const line=raw.trim();if(!line)continue;if(line[0]!==':')throw new Error('HEX inválido');const b=[];for(let i=1;i<line.length;i+=2)b.push(parseInt(line.slice(i,i+2),16));const len=b[0],addr=(b[1]<<8)|b[2],type=b[3];if(type===0){for(let i=0;i<len;i++){const a=upper+addr+i;mem.set(a,b[4+i]);if(a>max)max=a;}}else if(type===4){upper=((b[4]<<8)|b[5])<<16;}else if(type===1)break;}
 const out=new Uint8Array(max+1);out.fill(0xFF);for(const [a,v] of mem)out[a]=v;return out;
}
async function requestPort(){
 if(!global.isSecureContext) throw new Error('La programación USB requiere HTTPS.');
 // En Android se fuerza WebUSB/OTG: Web Serial puede mostrar dispositivos Bluetooth y no el UNO físico.
 if(isAndroid()){
   if(global.SimuPLCWebUsbSerial&&global.SimuPLCWebUsbSerial.requestPort)return {port:await global.SimuPLCWebUsbSerial.requestPort(),kind:'webusb'};
   throw new Error('WebUSB OTG no está disponible en este navegador Android.');
 }
 if(navigator.serial)return {port:await navigator.serial.requestPort(),kind:'native'};
 if(global.SimuPLCWebUsbSerial&&global.SimuPLCWebUsbSerial.requestPort)return {port:await global.SimuPLCWebUsbSerial.requestPort(),kind:'webusb'};
 throw new Error('Este navegador no ofrece USB compatible.');
}
async function resetAndOpen(port){
 try{await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});}catch(e){try{await port.close();}catch(_){}await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});}
 if(port.setSignals){try{await port.setSignals({dataTerminalReady:false,requestToSend:false});}catch(_){}await delay(120);try{await port.setSignals({dataTerminalReady:true,requestToSend:false});}catch(_){}}await delay(450);
}
async function flashHex(hexText){
 const fw=parseHex(hexText);if(fw.length>32256)throw new Error('El programa supera la memoria Flash disponible del Arduino UNO.');
 const sel=await requestPort(),port=sel.port;await resetAndOpen(port);const writer=port.writable.getWriter(),reader=port.readable.getReader();
 const write=async a=>writer.write(new Uint8Array(a));let rx=[];
 async function need(n,timeout=1800){const end=Date.now()+timeout;while(rx.length<n){const left=end-Date.now();if(left<=0)throw new Error('Arduino UNO no respondió al bootloader.');const p=reader.read();const t=new Promise((_,rej)=>setTimeout(()=>rej(new Error('Tiempo de espera del bootloader agotado.')),left));const r=await Promise.race([p,t]);if(r.done)throw new Error('Puerto USB cerrado.');rx.push(...r.value);}return rx.splice(0,n);}
 async function cmd(bytes,resp=2){await write(bytes);const r=await need(resp);if(r[0]!==0x14||r[r.length-1]!==0x10)throw new Error('Respuesta STK500 inesperada.');return r;}
 try{
  toast('Sincronizando con el Arduino UNO…');let ok=false;for(let i=0;i<8;i++){try{rx=[];await cmd([0x30,0x20]);ok=true;break;}catch(_){await delay(120);}}if(!ok)throw new Error('No se pudo sincronizar con el bootloader.');
  const page=128,total=Math.ceil(fw.length/page);for(let p=0;p<total;p++){const start=p*page,len=Math.min(page,fw.length-start),word=start>>1;await cmd([0x55,word&255,(word>>8)&255,0x20]);const data=Array.from(fw.slice(start,start+len));await cmd([0x64,(len>>8)&255,len&255,0x46,...data,0x20]);toast('Programando Arduino UNO… '+Math.round((p+1)*100/total)+'%');}
  await cmd([0x51,0x20]).catch(()=>{});toast('✅ Arduino UNO programado correctamente.');
 }finally{try{reader.releaseLock();}catch(_){}try{writer.releaseLock();}catch(_){}try{await port.close();}catch(_){}}
}
async function compileGenerated(){const src=await sketch();const out=await compile(src);toast('✅ Código generado por SimuPLC compilado correctamente ('+(out.flashBytes||'?')+' bytes).');return out;}
let pendingFirmware=null;
async function program(){
 const btn=document.getElementById('simuplcUnoProgramBtn');
 if(btn&&btn.disabled)return;
 if(btn)btn.disabled=true;
 try{
  if(!pendingFirmware){
   const src=await sketch();
   toast('Código de SimuPLC recibido. Compilando localmente…');
   const out=await compile(src);
   pendingFirmware=out.hex;
   if(btn){btn.textContent='🔌 Conectar Arduino por USB/OTG';btn.title='Selecciona tu Arduino conectado y transfiere el programa';}
   toast('✅ Compilación correcta ('+(out.flashBytes||'?')+' bytes). Ahora pulsa «Conectar Arduino por USB/OTG» para autorizar el dispositivo y programarlo.');
   return;
  }
  // Esta segunda pulsación es el gesto del usuario exigido por Chrome para solicitar WebUSB.
  // No realizar imports ni compilación asíncrona antes de requestDevice().
  const hex=pendingFirmware;
  toast('Selecciona el Arduino UNO conectado por USB/OTG…');
  await flashHex(hex);
  pendingFirmware=null;
  if(btn){btn.textContent='⚡ Programar Arduino UNO';btn.title='Compila el código generado por SimuPLC y prepara la conexión USB';}
 }catch(e){
  const message=e&&e.message?e.message:String(e);
  toast('❌ '+message,true);
  // Si falló el permiso USB, conservar HEX para reintentar con un nuevo toque.
 }finally{if(btn)btn.disabled=false;}
}
function install(){
 const actions=document.getElementById('arduinoActions');if(!actions||document.getElementById('simuplcUnoProgramBtn'))return;
 const btn=document.createElement('button');btn.id='simuplcUnoProgramBtn';btn.className='primary';btn.type='button';btn.textContent='⚡ Programar Arduino UNO';btn.title='Toma directamente el código generado por SimuPLC, lo compila localmente y lo carga por USB/OTG';btn.addEventListener('click',program);actions.appendChild(btn);
 const s=document.createElement('div');s.id='simuplcUnoProgramStatus';s.style.cssText='width:100%;font-size:12px;font-weight:700;margin-top:8px;';s.textContent='Programación directa UNO: lista. No usa Cloud Run ni portapapeles.';actions.appendChild(s);
}
const obs=new MutationObserver(install);obs.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
global.SimuPLCArduinoUNO=Object.freeze({program,compileGenerated,compile,flashHex,parseHex,getGeneratedSketch:sketch,prepareArduinoSource,version:'2.2-local-wasm-usb-gesture'});
})(window);
