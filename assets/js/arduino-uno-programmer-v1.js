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
 if(navigator.serial){
   let selected;
   try{selected=await navigator.serial.requestPort({filters:[]});}
   catch(e){
     if(e&&(e.name==='NotFoundError'||/No port selected/i.test(e.message||''))){
       throw new Error('Windows no seleccionó ningún puerto COM. Comprueba que Arduino esté conectado con cable USB de datos y que Windows lo reconozca en Administrador de dispositivos → Puertos (COM y LPT). Abre SimuPLC en Chrome o Edge y vuelve a pulsar «Conectar Arduino». Si aparece la ventana, selecciona el COM y confirma.');
     }
     if(e&&e.name==='SecurityError')throw new Error('El navegador bloqueó la selección del puerto COM. Abre SimuPLC directamente en Chrome o Edge mediante HTTPS, fuera de una ventana integrada.');
     throw e;
   }
   return {port:selected,kind:'native'};
 }
 if(global.SimuPLCWebUsbSerial&&global.SimuPLCWebUsbSerial.requestPort)return {port:await global.SimuPLCWebUsbSerial.requestPort(),kind:'webusb'};
 throw new Error('Este navegador no ofrece USB compatible.');
}
async function resetAndOpen(port){
 try{await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});}catch(e){try{await port.close();}catch(_){}await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});}
 if(port.setSignals){try{await port.setSignals({dataTerminalReady:false,requestToSend:false});}catch(_){}await delay(120);try{await port.setSignals({dataTerminalReady:true,requestToSend:false});}catch(_){}}await delay(450);
}
async function flashHex(hexText,selectedPort){
 const fw=parseHex(hexText);if(fw.length>32256)throw new Error('El programa supera la memoria Flash disponible del Arduino UNO.');
 const sel=selectedPort?{port:selectedPort,kind:'native'}:await requestPort(),port=sel.port;await resetAndOpen(port);const writer=port.writable.getWriter(),reader=port.readable.getReader();
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
let pendingWindowsPort=null;
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
   if(btn){btn.textContent=isAndroid()?'🔌 Conectar Arduino por USB/OTG':'⚡ Programar Arduino UNO';btn.title='Selecciona tu Arduino conectado y transfiere el programa';}
   toast('✅ Compilación correcta ('+(out.flashBytes||'?')+' bytes). Ahora pulsa «Conectar Arduino por USB/OTG» para autorizar el dispositivo y programarlo.');
   return;
  }
  // Esta segunda pulsación es el gesto del usuario exigido por Chrome para solicitar WebUSB.
  // No realizar imports ni compilación asíncrona antes de requestDevice().
  const hex=pendingFirmware;
  if(!isAndroid()&&!pendingWindowsPort){
   toast('Selecciona primero el Arduino con el botón «Elegir puerto COM» y después transfiere el programa.',true);
   return;
  }
  toast(isAndroid()?'Selecciona el Arduino UNO conectado por USB/OTG…':'Conectando y programando el Arduino por el puerto COM autorizado…');
  await flashHex(hex,pendingWindowsPort);
  pendingFirmware=null;
  pendingWindowsPort=null;
  if(btn){btn.textContent='⚡ Programar Arduino UNO';btn.title='Compila el código generado por SimuPLC y prepara la conexión USB';}
 }catch(e){
  const message=e&&e.message?e.message:String(e);
  toast('❌ '+message,true);
  // Si falló el permiso USB, conservar HEX para reintentar con un nuevo toque.
 }finally{if(btn)btn.disabled=false;}
}
async function chooseWindowsPortDirect(){
 // Chrome no muestra el selector Web Serial mientras document.fullscreenElement está activo.
 // Salir de fullscreen consume el gesto de usuario; por eso se requiere un segundo clic explícito.
 const btn=document.getElementById('simuplcUnoComBtn');
 if(btn&&btn.disabled)return;
 if(document.fullscreenElement){
   try{
     await document.exitFullscreen();
     toast('✅ Se salió temporalmente de pantalla completa. Pulsa otra vez «Elegir puerto COM» para abrir el selector de Chrome.');
   }catch(e){toast('❌ No se pudo salir de pantalla completa: '+(e.message||e),true);}
   return;
 }
 // Esta llamada debe ser la primera solicitud de permisos del clic, sin awaits previos.
 const context={active:!!navigator.userActivation?.isActive,fullscreen:!!document.fullscreenElement,frame:window.top!==window.self,policy:document.permissionsPolicy?.allowsFeature?.('serial')??document.featurePolicy?.allowsFeature?.('serial')??'unknown'};
 const chooser=navigator.serial.requestPort();
 if(btn)btn.disabled=true;
 toast('Selecciona Arduino UNO (COM) en la ventana de Chrome y pulsa Conectar…');
 chooser.then(port=>{
   pendingWindowsPort=port;
   const info=port.getInfo?port.getInfo():{};
   toast('✅ Puerto COM autorizado ('+(info.usbVendorId||'USB')+'). Ahora pulsa «Programar Arduino UNO».');
 }).catch(e=>{
   toast('❌ '+(e&&e.name?e.name+': ':'')+(e&&e.message?e.message:e)+' | Diagnóstico: '+JSON.stringify(context),true);
 }).finally(()=>{if(btn)btn.disabled=false;});
}
function installUnoVisualStyles(){
 // Solo CSS: no mover nodos, no cambiar botones, eventos ni firmware.
 if(document.getElementById('simuplcUnoVisualV1'))return;
 const style=document.createElement('style');
 style.id='simuplcUnoVisualV1';
 style.textContent=[
 '#arduinoActions{gap:10px!important;align-items:center!important;padding:14px 16px!important;border-top:1px solid #dbe5f0!important;background:linear-gradient(180deg,#fff,#f4f8fd)!important}',
 '#arduinoActions button{border-radius:12px!important;min-height:44px!important;font-weight:800!important;letter-spacing:.1px;transition:box-shadow .16s ease,transform .16s ease}',
 '#arduinoActions button:hover:not(:disabled){box-shadow:0 5px 16px rgba(15,45,85,.12)}',
 '#arduinoActions button:focus-visible,#simuplcViewCodeBtn:focus-visible{outline:3px solid #60a5fa!important;outline-offset:2px!important}',
 '#simuplcUnoProgramBtn{padding:12px 20px!important;background:linear-gradient(135deg,#16a34a,#078b55)!important;color:#fff!important;border:1px solid #078b55!important;box-shadow:0 4px 12px rgba(22,163,74,.18)}',
 '#simuplcUnoProgramBtn:disabled{opacity:.65!important;cursor:wait!important}',
 '#simuplcUnoComBtn{margin:0!important;padding:12px 16px!important;border-radius:12px!important;background:#ecfdf5!important}',
 '#simuplcUnoProgramStatus{box-sizing:border-box!important;flex-basis:100%!important;width:100%!important;padding:10px 13px!important;margin:4px 0 0!important;border-radius:10px!important;border:1px solid #d5e5f5!important;background:#eff6ff!important;font-size:13px!important;line-height:1.5!important;overflow-wrap:anywhere!important}',
 '#simuplcViewCodeBtn{border-radius:12px!important;max-width:280px!important;min-height:44px!important;background:#eef6ff!important;border-color:#bfdbfe!important;color:#17416e!important}',
 '@media(max-width:640px){#arduinoActions{padding:10px!important;gap:8px!important}#arduinoActions button{max-width:100%;font-size:13px!important}}'
 ].join('\\n');
 document.head.appendChild(style);
}
function install(){
 const actions=document.getElementById('arduinoActions');
 const code=document.getElementById('arduinoCode');
 if(!actions||!code)return;
 installUnoVisualStyles();
 if(!document.getElementById('simuplcUnoProgramBtn')){
  const btn=document.createElement('button');btn.id='simuplcUnoProgramBtn';btn.className='primary';btn.type='button';btn.textContent='⚡ Programar Arduino UNO';btn.title='Compila localmente el programa generado por SimuPLC';btn.addEventListener('click',program);actions.appendChild(btn);
  const s=document.createElement('div');s.id='simuplcUnoProgramStatus';s.style.cssText='width:100%;font-size:12px;font-weight:700;margin-top:8px;';s.setAttribute('role','status');s.setAttribute('aria-live','polite');s.textContent='Listo para compilar y programar el Arduino UNO.';actions.appendChild(s);
 }
 if(!document.getElementById('simuplcUnoComBtn')){
  const com=document.createElement('button');
  com.id='simuplcUnoComBtn';com.type='button';com.textContent='🔌 Elegir puerto COM';
  com.style.cssText='padding:11px 15px;margin:6px;border:1px solid #0c8559;border-radius:10px;background:#e8fff4;color:#075c3b;font-weight:800;cursor:pointer;';
  // Listener independiente, invoca requestPort sin ningún paso asíncrono previo.
  com.addEventListener('click',chooseWindowsPortDirect);
  actions.insertBefore(com,document.getElementById('simuplcUnoProgramBtn'));
 }
 if(!document.getElementById('simuplcViewCodeBtn')){
  const toggle=document.createElement('button');toggle.id='simuplcViewCodeBtn';toggle.type='button';toggle.textContent='👁 Ver código C++';toggle.setAttribute('aria-expanded','false');
  toggle.style.cssText='display:block;width:100%;max-width:260px;margin:10px 0;padding:11px 14px;border:1px solid #8dbbc9;border-radius:12px;background:#e9f7fb;color:#123c4a;font-weight:800;cursor:pointer;';
  code.parentNode.insertBefore(toggle,code);
  toggle.addEventListener('click',function(){
   const open=toggle.getAttribute('aria-expanded')!=='true';
   toggle.setAttribute('aria-expanded',String(open));
   toggle.textContent=open?'🙈 Ocultar código C++':'👁 Ver código C++';
   updateCodeVisibility();
  });
 }
 updateCodeVisibility();
}
function updateCodeVisibility(){
 const code=document.getElementById('arduinoCode'),toggle=document.getElementById('simuplcViewCodeBtn');
 if(!code||!toggle)return;
 const board=global.SimuPLCMCUCodegen&&global.SimuPLCMCUCodegen.getBoard?global.SimuPLCMCUCodegen.getBoard():'uno';
 const uno=board==='uno'||board==='arduino-uno'||board==='arduino-uno-r3'||board==='uno-r3';
 const expanded=toggle.getAttribute('aria-expanded')==='true';
 toggle.style.display=uno?'block':'none';
 code.style.display=(!uno||expanded)?'':'none';
 for(const id of ['arduinoCopy','arduinoDownload','arduinoRefresh']){
  const el=document.getElementById(id);if(el)el.style.display=(!uno||expanded)?'':'none';
 }
 const btn=document.getElementById('simuplcUnoProgramBtn');
 if(btn)btn.style.display=uno?'':'none';
 const com=document.getElementById('simuplcUnoComBtn');
 if(com)com.style.display=uno&&!isAndroid()&&!!navigator.serial?'':'none';
}
document.addEventListener('click',function(event){
 if(event.target&&event.target.closest&&event.target.closest('#arduinoRefresh'))resetPreparedFirmware();
},true);
document.addEventListener('change',function(event){
 if(event.target&&event.target.closest&&event.target.closest('#arduinoBoardSelect,#mcuPinsPanel,#arduinoPins,#arduinoModeBox'))resetPreparedFirmware();
},true);
function resetPreparedFirmware(){
 pendingFirmware=null;
 pendingWindowsPort=null;
 const btn=document.getElementById('simuplcUnoProgramBtn');
 if(btn){btn.textContent='⚡ Programar Arduino UNO';btn.title='Compila localmente el programa generado por SimuPLC';}
}
const obs=new MutationObserver(install);obs.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
global.SimuPLCArduinoUNO=Object.freeze({program,compileGenerated,compile,flashHex,parseHex,getGeneratedSketch:sketch,prepareArduinoSource,version:'2.9-com-stop-fullscreen-bubbling'});
})(window);
