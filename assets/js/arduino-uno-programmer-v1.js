(function(global){
'use strict';
const CFG_KEY='simuplc_uno_programmer_v1';
const DEFAULT_ENDPOINT=(global.SIMUPLC_UNO_COMPILE_ENDPOINT||'').trim();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function toast(msg,err){ let el=document.getElementById('simuplcUnoProgramStatus'); if(el){el.textContent=msg;el.style.color=err?'#b91c1c':'#166534';} console[err?'error':'log']('[UNO]',msg); }
function config(){try{return Object.assign({endpoint:DEFAULT_ENDPOINT},JSON.parse(localStorage.getItem(CFG_KEY)||'{}'));}catch(_){return {endpoint:DEFAULT_ENDPOINT};}}
function saveConfig(c){localStorage.setItem(CFG_KEY,JSON.stringify(c));}
function sketch(){const ta=document.getElementById('arduinoCode'); if(ta&&ta.value.trim()) return ta.value; if(typeof global.generateArduinoSketch==='function') return String(global.generateArduinoSketch()||''); throw new Error('No se pudo obtener el código Arduino.');}
async function compile(src){
 const c=config(); let endpoint=(c.endpoint||'').trim();
 if(!endpoint){ endpoint=prompt('URL HTTPS del compilador SimuPLC (Cloud Run /compile):','')||''; endpoint=endpoint.trim(); if(!endpoint) throw new Error('Falta configurar el compilador. Consulta ARDUINO_UNO_PROGRAMACION_DIRECTA.md'); c.endpoint=endpoint; saveConfig(c); }
 toast('Compilando para Arduino UNO…');
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fqbn:'arduino:avr:uno',sketch:src})});
 const body=await res.json().catch(()=>({})); if(!res.ok) throw new Error(body.error||body.log||('Error HTTP '+res.status)); if(!body.hex) throw new Error('El compilador no devolvió firmware HEX.'); return body;
}
function parseHex(text){
 const mem=new Map(); let upper=0,max=0;
 for(const raw of String(text).split(/\r?\n/)){const line=raw.trim();if(!line)continue;if(line[0]!==':')throw new Error('HEX inválido');const b=[];for(let i=1;i<line.length;i+=2)b.push(parseInt(line.slice(i,i+2),16));const len=b[0],addr=(b[1]<<8)|b[2],type=b[3];if(type===0){for(let i=0;i<len;i++){const a=upper+addr+i;mem.set(a,b[4+i]);if(a>max)max=a;}}else if(type===4){upper=((b[4]<<8)|b[5])<<16;}else if(type===1)break;}
 const out=new Uint8Array(max+1);out.fill(0xFF);for(const [a,v] of mem)out[a]=v;return out;
}
async function requestPort(){
 if(!global.isSecureContext) throw new Error('La programación USB requiere HTTPS.');
 if(navigator.serial) return {port:await navigator.serial.requestPort(),kind:'native'};
 if(global.SimuPLCWebUsbSerial&&global.SimuPLCWebUsbSerial.requestPort) return {port:await global.SimuPLCWebUsbSerial.requestPort(),kind:'webusb'};
 throw new Error('Este navegador no ofrece Web Serial/WebUSB compatible.');
}
async function resetAndOpen(port){
 try{await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});}catch(e){try{await port.close();}catch(_){} await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});}
 if(port.setSignals){await port.setSignals({dataTerminalReady:false,requestToSend:false}).catch(()=>{});await delay(120);await port.setSignals({dataTerminalReady:true,requestToSend:false}).catch(()=>{});} await delay(450);
}
async function flashHex(hexText){
 const fw=parseHex(hexText); if(fw.length>32256)throw new Error('El programa supera la memoria Flash disponible del Arduino UNO.');
 const sel=await requestPort(),port=sel.port; await resetAndOpen(port); const writer=port.writable.getWriter(),reader=port.readable.getReader();
 const write=async a=>writer.write(new Uint8Array(a));
 let rx=[]; async function need(n,timeout=1600){const end=Date.now()+timeout;while(rx.length<n){const left=end-Date.now();if(left<=0)throw new Error('Arduino UNO no respondió al bootloader.');const p=reader.read();const t=new Promise((_,rej)=>setTimeout(()=>rej(new Error('Tiempo de espera del bootloader agotado.')),left));const r=await Promise.race([p,t]);if(r.done)throw new Error('Puerto USB cerrado.');rx.push(...r.value);}return rx.splice(0,n);}
 async function cmd(bytes,resp=2){await write(bytes);const r=await need(resp);if(r[0]!==0x14||r[r.length-1]!==0x10)throw new Error('Respuesta STK500 inesperada: '+r.map(x=>x.toString(16).padStart(2,'0')).join(' '));return r;}
 try{
  toast('Sincronizando con bootloader del Arduino UNO…'); let ok=false;for(let i=0;i<8;i++){try{rx=[];await cmd([0x30,0x20]);ok=true;break;}catch(_){await delay(120);}}if(!ok)throw new Error('No se pudo sincronizar con el bootloader. Presiona RESET en el UNO e inténtalo nuevamente.');
  const page=128,total=Math.ceil(fw.length/page);for(let p=0;p<total;p++){const start=p*page,len=Math.min(page,fw.length-start),word=start>>1;await cmd([0x55,word&255,(word>>8)&255,0x20]);const data=Array.from(fw.slice(start,start+len));await cmd([0x64,(len>>8)&255,len&255,0x46,...data,0x20]);toast('Programando Arduino UNO… '+Math.round((p+1)*100/total)+'%');}
  await cmd([0x51,0x20]).catch(()=>{});toast('✅ Arduino UNO programado correctamente.');
 }finally{try{reader.releaseLock();}catch(_){}try{writer.releaseLock();}catch(_){}try{await port.close();}catch(_){}}
}
async function program(){try{const btn=document.getElementById('simuplcUnoProgramBtn');if(btn)btn.disabled=true;const out=await compile(sketch());toast('Compilación correcta. Conecta el Arduino UNO por USB/OTG…');await flashHex(out.hex);}catch(e){toast('❌ '+(e.message||e),true);}finally{const btn=document.getElementById('simuplcUnoProgramBtn');if(btn)btn.disabled=false;}}
function install(){
 const actions=document.getElementById('arduinoActions');if(!actions||document.getElementById('simuplcUnoProgramBtn'))return;
 const btn=document.createElement('button');btn.id='simuplcUnoProgramBtn';btn.className='primary';btn.type='button';btn.textContent='⚡ Programar Arduino UNO';btn.title='Compila el código y lo carga directamente al Arduino UNO por USB/OTG';btn.addEventListener('click',program);actions.appendChild(btn);
 const s=document.createElement('div');s.id='simuplcUnoProgramStatus';s.style.cssText='width:100%;font-size:12px;font-weight:700;margin-top:8px;';s.textContent='Programación directa UNO: lista para compilar y cargar por USB/OTG.';actions.appendChild(s);
}
const obs=new MutationObserver(install);obs.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
global.SimuPLCArduinoUNO={program,flashHex,parseHex,config,setCompileEndpoint:function(url){const c=config();c.endpoint=String(url||'').trim();saveConfig(c);return c.endpoint;}};
})(window);
