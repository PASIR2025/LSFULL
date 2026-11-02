(function(global){
'use strict';
if(global.__SIMUPLC_PDF_COMPOSER_V25__)return;
global.__SIMUPLC_PDF_COMPOSER_V25__=true;
const OVERLAY_ID='simuplcPdfComposerOverlayV25';
const PAYLOAD_KEY='__SIMUPLC_PDF_COMPOSER_PAYLOAD_V25';
let pendingPayloadV252=null;
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function activeEditor(){const b=document.body;if(b.classList.contains('mode-hmi'))return'hmi';if(b.classList.contains('mode-control'))return'control';if(b.classList.contains('mode-ladder'))return'ladder';return'fbd'}
function label(m){return m==='ladder'?'LADDER':m==='control'?'CONTROL':m==='hmi'?'HMI':'FBD'}
function isPro(){try{return localStorage.getItem('logicsoft_full_v1')==='1'||global.isFull===true||document.body.classList.contains('full-mode')}catch(_){return global.isFull===true}}
function currentProjectName(){try{const id=sessionStorage.getItem('simuplc_current_project_id_v19'),a=JSON.parse(localStorage.getItem('logicsoft_circuits_v1')||'[]'),item=Array.isArray(a)&&id?a.find(x=>x&&x.id===id):null;if(item&&item.name)return String(item.name)}catch(_){}return'Proyecto SimuPLC'}
function alertUser(msg,title){try{if(global.SimuPLCModal&&typeof global.SimuPLCModal.alert==='function')return global.SimuPLCModal.alert(msg,title||'PDF')}catch(_){}alert(msg)}
function loading(on,editor){
 let el=document.getElementById('simuplcPdfComposerLoadingV25');
 if(on&&!el){el=document.createElement('div');el.id='simuplcPdfComposerLoadingV25';el.innerHTML='<div><b>Preparando '+label(editor||activeEditor())+'…</b><span>Llevando el circuito al formato de hoja.</span></div>';el.style.cssText='position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;background:rgba(2,6,23,.68);backdrop-filter:blur(8px);color:#fff;font:800 15px Arial,sans-serif';const c=el.firstElementChild;c.style.cssText='display:grid;gap:7px;min-width:min(340px,88vw);padding:22px 24px;border:1px solid rgba(125,211,252,.28);border-radius:20px;background:#0b1728;box-shadow:0 24px 70px rgba(0,0,0,.38);text-align:center';c.querySelector('span').style.cssText='font-size:12px;color:#b9c9dc;font-weight:650';document.body.appendChild(el)}
 if(!on&&el)el.remove()
}
function collectAssets(doc){try{return Array.from(doc.querySelectorAll('style,link[rel="stylesheet"]')).map(node=>{try{if(node.tagName==='LINK'){const c=node.cloneNode(true),href=c.getAttribute('href');if(href)c.setAttribute('href',new URL(href,doc.baseURI).href);return c.outerHTML}return node.outerHTML}catch(_){return''}}).join('\n')}catch(_){return''}}
function captureHmi(){
 try{
  const f=document.getElementById('simuplcModularEditorFrame'),doc=f&&f.contentDocument;if(!doc)return null;
  const source=doc.getElementById('hmiCanvas');if(!source)return null;
  const clone=source.cloneNode(true);
  clone.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
  clone.querySelectorAll('.hmi-selection-frame,.hmi-element-delete-btn,.hmi-delete-btn,.resize-handle').forEach(el=>{try{el.remove()}catch(_){}});
  const w=Math.max(1,source.offsetWidth||1200),h=Math.max(1,source.offsetHeight||720);
  return{kind:'html',editor:'hmi',width:w,height:h,offsetX:0,offsetY:0,html:clone.outerHTML,headAssets:collectAssets(doc),baseHref:f.src||location.href,rootId:'hmiCanvas',extraCss:'#hmiCanvas{position:absolute!important;left:0!important;top:0!important;transform:none!important;margin:0!important;box-shadow:none!important;background-image:none!important}.hmi-selection-frame,.hmi-element-delete-btn,.hmi-delete-btn,.resize-handle{display:none!important}#hmiCanvas .hmi-object.selected{outline:none!important;filter:none!important}#hmiCanvas *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'}
 }catch(e){console.warn('[PDF V25 HMI]',e);return null}
}
function requestFrameCapture(frameId,editor,timeout){
 return new Promise(resolve=>{
  const frame=document.getElementById(frameId);
  if(!frame||!frame.contentWindow){resolve(null);return}
  const requestId='pdfcap_'+editor+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  let done=false;
  const finish=(value)=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',onMsg);resolve(value||null)};
  const onMsg=(ev)=>{
   const d=ev.data||{};
   if(d.type!=='SIMUPLC_PDF_CAPTURE_RESPONSE_V252'||d.requestId!==requestId)return;
   if(ev.source!==frame.contentWindow)return;
   if(d.error)console.warn('[PDF V25.2 '+editor+']',d.error);
   finish(d.source||null);
  };
  window.addEventListener('message',onMsg);
  const timer=setTimeout(()=>finish(null),timeout||7000);
  try{
   frame.contentWindow.postMessage({type:'SIMUPLC_PDF_CAPTURE_REQUEST_V252',requestId,editor},'*');
  }catch(e){console.warn('[PDF V25.2 postMessage]',e);finish(null)}
 });
}
async function capture(editor){
 if(editor==='fbd'){
  const api=global.SimuPLCFBDPDFSourceV25;
  return api&&typeof api.capture==='function'?api.capture():null;
 }
 if(editor==='ladder')return await requestFrameCapture('ladderFrame','ladder',9000);
 if(editor==='control')return await requestFrameCapture('controlFrame','control',7000);
 if(editor==='hmi')return captureHmi();
 return null
}
function ensureOverlay(){
 let ov=document.getElementById(OVERLAY_ID);if(ov)return ov;
 ov=document.createElement('div');ov.id=OVERLAY_ID;ov.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#dfe4ea;display:none';
 const fr=document.createElement('iframe');fr.id='simuplcPdfComposerFrameV25';fr.title='Compositor PDF SimuPLC';fr.style.cssText='width:100%;height:100%;border:0;display:block;background:#dfe4ea';ov.appendChild(fr);document.body.appendChild(ov);return ov
}
function close(){const ov=document.getElementById(OVERLAY_ID);if(ov)ov.style.display='none';document.documentElement.style.removeProperty('overflow');document.body.style.removeProperty('overflow');setTimeout(()=>{try{delete global[PAYLOAD_KEY]}catch(_){}pendingPayloadV252=null},500)}
async function open(editorOverride){
 const editor=editorOverride||activeEditor();if(open._busy)return false;open._busy=true;loading(true,editor);
 try{
  const source=await capture(editor);
  if(!source){alertUser('No hay elementos para exportar en '+label(editor)+'.','PDF');return false}
  global[PAYLOAD_KEY]={version:'25.3',editor,editorLabel:label(editor),isPro:isPro(),projectName:currentProjectName(),date:new Date().toLocaleDateString('es-PE'),source};pendingPayloadV252=global[PAYLOAD_KEY];
  const ov=ensureOverlay(),fr=ov.querySelector('iframe');fr.src='cajetin_pro.html?embedded=1&v=25.4&t='+Date.now();ov.style.display='block';document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';return true
 }catch(e){console.error('[SimuPLC PDF Composer V25]',e);alertUser('No se pudo preparar el circuito para el formato PDF.','PDF');return false}
 finally{loading(false);open._busy=false}
}
document.addEventListener('click',function(ev){const b=ev.target&&ev.target.closest&&ev.target.closest('#btnPdfActive');if(!b)return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();open(activeEditor())},true);
window.addEventListener('message',function(ev){
 const d=ev.data||{};
 if(d.type==='SIMUPLC_PDF_COMPOSER_OPEN_V25'){open(d.editor||activeEditor());return}
 if(d.type==='SIMUPLC_PDF_COMPOSER_CLOSE_V25'){close();return}
 if(d.type==='SIMUPLC_CAJETIN_READY_V252'){
  const frame=document.getElementById('simuplcPdfComposerFrameV25');
  if(!frame||ev.source!==frame.contentWindow)return;
  const payload=pendingPayloadV252||global[PAYLOAD_KEY];
  if(payload){
   try{ev.source.postMessage({type:'SIMUPLC_CAJETIN_PAYLOAD_V252',payload},'*')}catch(e){console.warn('[PDF V25.2 payload]',e)}
  }
 }
});
global.SimuPLCPDFComposerV25={version:'25.4',open,close,capture,activeEditor,isPro};
})(window);
