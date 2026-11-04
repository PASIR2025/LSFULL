(function(global){
'use strict';
if(global.SimuPLCI18n)return;
const KEY='simuplc_language_v1', FIRST='simuplc_language_selected_v1';
const languages={es:'Español',en:'English',pt:'Português'};
const words={
es:{welcome:'Bienvenido a SimuPLC',choose:'Selecciona el idioma para comenzar. Puedes cambiarlo después en Preferencias.',continue:'Continuar',language:'Idioma',preferences:'Preferencias',settings:'Configuración',save:'Guardar',cancel:'Cancelar',close:'Cerrar',start:'Iniciar',stop:'Detener',connect:'Conectar',disconnect:'Desconectar',simulate:'Simular',compile:'Compilar código',program:'Programar Arduino',advanced:'Activar funciones avanzadas',help:'Ayuda',open:'Abrir',newProject:'Nuevo proyecto'},
en:{welcome:'Welcome to SimuPLC',choose:'Choose your language to begin. You can change it later in Preferences.',continue:'Continue',language:'Language',preferences:'Preferences',settings:'Settings',save:'Save',cancel:'Cancel',close:'Close',start:'Start',stop:'Stop',connect:'Connect',disconnect:'Disconnect',simulate:'Simulate',compile:'Compile code',program:'Program Arduino',advanced:'Unlock advanced features',help:'Help',open:'Open',newProject:'New project'},
pt:{welcome:'Bem-vindo ao SimuPLC',choose:'Selecione o idioma para começar. Você pode alterá-lo depois em Preferências.',continue:'Continuar',language:'Idioma',preferences:'Preferências',settings:'Configurações',save:'Salvar',cancel:'Cancelar',close:'Fechar',start:'Iniciar',stop:'Parar',connect:'Conectar',disconnect:'Desconectar',simulate:'Simular',compile:'Compilar código',program:'Programar Arduino',advanced:'Ativar funções avançadas',help:'Ajuda',open:'Abrir',newProject:'Novo projeto'}
};
const source=Object.fromEntries(Object.entries(words.es).map(([k,v])=>[v,k]));
let current='es', busy=false;
try{const saved=localStorage.getItem(KEY);if(languages[saved])current=saved;}catch(_){}
function t(key){return (words[current]&&words[current][key])||words.es[key]||key;}
function translateRoot(root){
 if(!root||!root.querySelectorAll)return;
 const nodes=root.querySelectorAll('button,[role="button"],label,option,[data-i18n],input[type="button"],input[type="submit"]');
 nodes.forEach(el=>{
  if(el.closest&&el.closest('#simuplc-language-overlay'))return;
  const explicit=el.getAttribute('data-i18n');
  const original=el.getAttribute('data-simuplc-i18n-original')||((el.tagName==='INPUT'?el.value:el.textContent)||'').trim();
  const key=explicit||source[original];
  if(!key||!words.es[key])return;
  if(!el.hasAttribute('data-simuplc-i18n-original'))el.setAttribute('data-simuplc-i18n-original',original);
  const value=t(key);
  if(el.tagName==='INPUT')el.value=value;
  else if(el.children.length===0)el.textContent=value;
 });
 try{root.documentElement&&root.documentElement.setAttribute('lang',current);}catch(_){}
}
function apply(){
 if(busy)return;busy=true;
 try{
  translateRoot(document);
  ['controlFrame','ladderFrame'].forEach(id=>{try{const doc=document.getElementById(id)?.contentDocument;if(doc)translateRoot(doc);}catch(_){}});
 }finally{busy=false;}
}
function setLanguage(lang,confirmed){
 if(!languages[lang])return false;
 current=lang;
 try{localStorage.setItem(KEY,lang);if(confirmed)localStorage.setItem(FIRST,'1');}catch(_){}
 apply();
 global.dispatchEvent(new CustomEvent('simuplc-language-change',{detail:{language:lang}}));
 return true;
}
function style(){
 if(document.getElementById('simuplc-language-style'))return;
 const s=document.createElement('style');s.id='simuplc-language-style';s.textContent='#simuplc-language-overlay{position:fixed;inset:0;z-index:2147483600;background:rgba(9,20,35,.7);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,sans-serif}#simuplc-language-panel{background:#fff;color:#172338;width:min(440px,100%);padding:28px;border-radius:18px;box-shadow:0 16px 65px #0005}#simuplc-language-panel h2{font-size:24px;margin:0 0 10px}#simuplc-language-panel p{font-size:14px;line-height:1.5;color:#536174}#simuplc-language-panel select{width:100%;padding:12px;border:1px solid #aab6c7;border-radius:9px;font-size:16px;margin:12px 0 18px}#simuplc-language-panel button{background:#1463c7;border:0;border-radius:9px;padding:12px 20px;color:white;font-weight:700;cursor:pointer;width:100%}#simuplc-language-shortcut{position:fixed;right:14px;bottom:14px;z-index:2147483500;background:#173b6e;color:white;border:1px solid #6c94d1;border-radius:22px;padding:9px 13px;font:600 13px system-ui;cursor:pointer}';document.head.appendChild(s);
}
function showPicker(first){
 style();
 document.getElementById('simuplc-language-overlay')?.remove();
 const overlay=document.createElement('div');overlay.id='simuplc-language-overlay';
 const panel=document.createElement('section');panel.id='simuplc-language-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 const title=document.createElement('h2'),desc=document.createElement('p'),select=document.createElement('select'),button=document.createElement('button');
 Object.entries(languages).forEach(([code,name])=>{const o=document.createElement('option');o.value=code;o.textContent=name;select.appendChild(o);});
 select.value=current;
 function update(){title.textContent=words[select.value].welcome;desc.textContent=words[select.value].choose;button.textContent=words[select.value].continue;}
 select.addEventListener('change',update);update();
 button.addEventListener('click',()=>{setLanguage(select.value,true);overlay.remove();});
 panel.append(title,desc,select,button);
 if(!first){const cancel=document.createElement('button');cancel.textContent=t('cancel');cancel.style.cssText='background:#edf2f8;color:#233b56;margin-top:8px';cancel.onclick=()=>overlay.remove();panel.appendChild(cancel);}
 overlay.appendChild(panel);document.body.appendChild(overlay);select.focus();
}
// Inserción aislada en la ventana de Preferencias, sin modificar su lógica original.
const observedDocs=new WeakSet();
function installPreferencesIntegration(doc){
 if(!doc||!doc.body||observedDocs.has(doc))return;
 observedDocs.add(doc);
 let pending=false;
 function scan(){
  pending=false;
  if(!doc.body)return;
  const headings=Array.from(doc.querySelectorAll('h1,h2,h3,h4,[role="heading"]'));
  const heading=headings.find(el=>/Preferencias del editor|Editor preferences|Preferências do editor/i.test((el.textContent||'').trim()));
  if(!heading)return;
  let modal=heading;
  for(let i=0;i<7&&modal.parentElement;i++){
   modal=modal.parentElement;
   if(modal.querySelectorAll('select').length>=2)break;
  }
  if(modal.querySelector('#simuplc-preferences-language'))return;
  const selects=Array.from(modal.querySelectorAll('select'));
  if(!selects.length)return;
  const theme=selects[0];
  let target=theme.parentElement;
  for(let i=0;i<3&&target.parentElement;i++){
   const p=target.parentElement;
   if(p.querySelectorAll('select').length>1)break;
   target=p;
  }
  if(!target.parentElement)return;
  const group=doc.createElement('div');
  group.id='simuplc-preferences-language';
  group.style.cssText='margin:0 0 18px;padding:0 0 16px;border-bottom:1px solid #dce5ef;font-family:inherit';
  const label=doc.createElement('label');
  label.htmlFor='simuplc-language-preference-select';
  label.textContent=t('language');
  label.style.cssText='display:block;font-weight:700;color:#415168;margin-bottom:9px';
  const select=doc.createElement('select');
  select.id='simuplc-language-preference-select';
  select.style.cssText='display:block;width:100%;box-sizing:border-box;min-height:46px;padding:10px 12px;border:1px solid #acbaca;border-radius:9px;background:white;color:#1d2d3f;font:600 16px inherit';
  Object.entries(languages).forEach(([code,name])=>{const opt=doc.createElement('option');opt.value=code;opt.textContent=name;select.appendChild(opt);});
  select.value=current;
  select.addEventListener('change',()=>{setLanguage(select.value,true);label.textContent=t('language');});
  const hint=doc.createElement('p');
  hint.textContent='Control · Ladder · FBD · HMI';
  hint.style.cssText='margin:7px 0 0;font-size:12px;color:#617187';
  group.append(label,select,hint);
  target.parentElement.insertBefore(group,target);
 }
 function schedule(){if(pending)return;pending=true;setTimeout(scan,0);}
 const obs=new MutationObserver(schedule);
 obs.observe(doc.body,{subtree:true,childList:true});
 schedule();
}
function init(){
 if(!document.body)return;
 style();apply();
 // El idioma se configura desde Preferencias de Control; no hay botón flotante.
 document.getElementById('simuplc-language-shortcut')?.remove();
 installPreferencesIntegration(document);
 const control=document.getElementById('controlFrame');
 if(control)control.addEventListener('load',()=>{try{installPreferencesIntegration(control.contentDocument);}catch(_){}});
 try{if(control&&control.contentDocument)installPreferencesIntegration(control.contentDocument);}catch(_){}

 let chosen=false;try{chosen=localStorage.getItem(FIRST)==='1';}catch(_){}
 if(!chosen)showPicker(true);
 ['controlFrame','ladderFrame'].forEach(id=>document.getElementById(id)?.addEventListener('load',apply));
 // Traduce etiquetas conocidas añadidas dinámicamente sin tocar el contenido de los proyectos.
 // Dynamic UI translation is deferred until the next safe integration phase.
}
global.SimuPLCI18n={getLanguage:()=>current,setLanguage,translate:apply,t,showPicker,languages:Object.assign({},languages)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
