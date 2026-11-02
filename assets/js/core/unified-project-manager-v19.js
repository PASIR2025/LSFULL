(function(global){
  'use strict';
  if(global.__SIMUPLC_UNIFIED_PROJECTS_V19__) return;
  global.__SIMUPLC_UNIFIED_PROJECTS_V19__=true;
  global.__SIMUPLC_PROJECT_MANAGER_FIX_V24__=true;

  var STORAGE_KEY='logicsoft_circuits_v1';
  var CURRENT_KEY='simuplc_current_project_id_v19';
  var FORMAT='simuplc-unified-library-project';
  var FORMAT_VERSION=1;
  var listEl=null;
  var modal=null;
  var nameInput=null;
  var saveSingleBtn=null;
  var saveCompleteBtn=null;
  var saveAsBtn=null;
  var cancelBtn=null;
  var forceSaveAs=false;
  var currentId=null;
  var pendingHmiProject=null;
  var pendingHmiTimer=0;
  var hmiReady=false;
  var newModal=null;
  var newChoiceStage=null;
  var newConfirmStage=null;
  var newCircuitTitle=null;
  var newCircuitDesc=null;
  var newConfirmTitle=null;
  var newConfirmDesc=null;
  var pendingNewKind=null;
  var pendingNewEditor=null;
  var newBusy=false;
  var newNameWrap=null;
  var newNameInput=null;
  var newSaveHint=null;
  var newCanSave=false;
  var openGuardModal=null;
  var openGuardNameWrap=null;
  var openGuardNameInput=null;
  var openGuardHint=null;
  var openGuardTargetName=null;
  var pendingOpenId=null;
  var openGuardBusy=false;
  var openGuardCanSave=false;

  function clone(v){try{return v==null?v:JSON.parse(JSON.stringify(v));}catch(_){return v;}}
  function now(){return Date.now();}
  function makeId(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
  function safeName(v,fallback){
    return String(v||fallback||'Proyecto SimuPLC').trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').slice(0,80)||'Proyecto SimuPLC';
  }
  function nameKey(v){return safeName(v,'').toLocaleLowerCase('es');}
  function editorLabel(mode){return mode==='ladder'?'LADDER':mode==='control'?'CONTROL':mode==='hmi'?'HMI':'FBD';}
  function activeEditor(){
    if(document.body.classList.contains('mode-hmi'))return'hmi';
    if(document.body.classList.contains('mode-control'))return'control';
    if(document.body.classList.contains('mode-ladder'))return'ladder';
    return'fbd';
  }
  function setEditor(mode){
    mode=(mode==='ladder'||mode==='control'||mode==='hmi')?mode:'fbd';
    try{
      if(typeof global.setSimuPLCEditorMode==='function'){global.setSimuPLCEditorMode(mode);return;}
      var id=mode==='ladder'?'modeLadderBtn':mode==='control'?'modeControlBtn':mode==='hmi'?'modeHMIBtn':'modeFBDBtn';
      var b=document.getElementById(id);if(b)b.click();
    }catch(_){ }
  }
  function readRaw(){
    try{var a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(a)?a:[];}catch(_){return[];}
  }
  function writeRaw(a){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(Array.isArray(a)?a:[]));return true;}catch(e){console.error('[Projects V22] storage',e);return false;}
  }
  function sessionGet(){try{return sessionStorage.getItem(CURRENT_KEY)||null;}catch(_){return null;}}
  function sessionSet(id){
    currentId=id||null;
    try{if(id)sessionStorage.setItem(CURRENT_KEY,id);else sessionStorage.removeItem(CURRENT_KEY);}catch(_){ }
  }
  function getCurrentId(){return currentId||sessionGet();}
  function clearCurrent(){sessionSet(null);forceSaveAs=false;refreshLibrary();}
  function toast(msg){
    try{if(typeof global.showCircuitToast==='function')return global.showCircuitToast(msg);}catch(_){ }
    var t=document.getElementById('circuitToast')||document.getElementById('hmiIntegrationToast');
    if(!t){t=document.createElement('div');t.id='unifiedProjectToast';t.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;background:#0f172a;color:#fff;padding:9px 16px;border-radius:999px;font:800 13px Arial;box-shadow:0 10px 25px rgba(0,0,0,.3);pointer-events:none';document.body.appendChild(t);}
    t.textContent=msg;t.style.display='block';t.classList.add('show');clearTimeout(t.__t);t.__t=setTimeout(function(){t.classList.remove('show');if(t.id==='unifiedProjectToast')t.style.display='none';},1900);
  }

  function blankProject(name){
    return {type:FORMAT,version:FORMAT_VERSION,name:safeName(name),savedAt:new Date().toISOString(),activeEditor:activeEditor(),hardware:{},editors:{fbd:null,ladder:null,control:null,hmi:null}};
  }
  function extractLegacy(item){
    item=item||{};
    if(item.simuplcProject&&item.simuplcProject.editors){
      var already=clone(item.simuplcProject);already.type=FORMAT;already.version=FORMAT_VERSION;already.name=safeName(item.name||already.name);already.editors=Object.assign({fbd:null,ladder:null,control:null,hmi:null},already.editors||{});return already;
    }
    var p=blankProject(item.name||'Proyecto SimuPLC');
    var src=item.completeProject||item.dualProject||((item.data&&item.data.editors)?item.data:null);
    if(src&&src.editors){
      p.activeEditor=(src.activeEditor==='ladder'||src.activeEditor==='control'||src.activeEditor==='hmi')?src.activeEditor:'fbd';
      p.hardware=clone(src.hardware||{});
      p.editors.fbd=clone(src.editors.fbd||src.fbd||item.fbd||null);
      p.editors.ladder=clone(src.editors.ladder||src.ladder||item.ladder||null);
      p.editors.control=clone(src.editors.control||src.control||item.control||null);
      p.editors.hmi=clone(src.editors.hmi||src.hmi||item.hmi||null);
      return p;
    }
    if(item.fbd)p.editors.fbd=clone(item.fbd);
    if(item.ladder)p.editors.ladder=clone(item.ladder);
    if(item.control)p.editors.control=clone(item.control);
    if(item.hmi)p.editors.hmi=clone(item.hmi);
    if(item.data){
      if(item.editor==='hmi')p.editors.hmi=p.editors.hmi||clone(item.data);
      else if(item.editor==='control')p.editors.control=p.editors.control||clone(item.data);
      else if(item.editor==='ladder'||Array.isArray(item.data.rungs)||String(item.data.type||'').indexOf('ladder')>=0)p.editors.ladder=p.editors.ladder||clone(item.data);
      else if(item.editor==='fbd'||Array.isArray(item.data.nodes)||(item.data.data&&Array.isArray(item.data.data.nodes)))p.editors.fbd=p.editors.fbd||clone(item.data);
    }
    p.activeEditor=(item.editor==='ladder'||item.editor==='control'||item.editor==='hmi')?item.editor:(item.editor==='fbd'?'fbd':(p.editors.hmi?'hmi':p.editors.control?'control':p.editors.ladder?'ladder':'fbd'));
    return p;
  }
  function makeItemFromLegacy(item){
    var p=extractLegacy(item),created=Number(item&&item.createdAt)||now(),updated=Number(item&&item.updatedAt)||created;
    return {id:(item&&item.id)||makeId(),name:safeName((item&&item.name)||p.name),editor:'project',projectKind:'SIMUPLC_PROJECT_V19',saveScope:(item&&item.saveScope)||'legacy',primaryEditor:p.activeEditor,createdAt:created,updatedAt:updated,simuplcProject:p};
  }
  function migrateLibrary(){
    var old=readRaw(),changed=false;
    var migrated=old.map(function(item){
      if(item&&item.editor==='project'&&item.projectKind==='SIMUPLC_PROJECT_V19'&&item.simuplcProject&&item.simuplcProject.editors)return item;
      changed=true;return makeItemFromLegacy(item);
    });
    if(changed){
      try{
        if(!localStorage.getItem('logicsoft_circuits_backup_pre_v19')){
          var raw=JSON.stringify(old);if(raw.length<1800000)localStorage.setItem('logicsoft_circuits_backup_pre_v19',raw);
        }
      }catch(_){ }
      writeRaw(migrated);
    }
    return migrated;
  }
  function list(){return migrateLibrary();}
  function getItem(id){return list().find(function(x){return x&&x.id===id;})||null;}
  function projectEditors(item){var p=item&&item.simuplcProject;return p&&p.editors?Object.assign({fbd:null,ladder:null,control:null,hmi:null},p.editors):{fbd:null,ladder:null,control:null,hmi:null};}
  function editorCount(item){var e=projectEditors(item),n=0;['fbd','ladder','control','hmi'].forEach(function(k){if(e[k])n++;});return n;}
  function findByName(name,excludeId){var key=nameKey(name);return list().find(function(x){return x&&x.id!==excludeId&&nameKey(x.name)===key;})||null;}
  function upsert(item){
    var arr=list(),i=arr.findIndex(function(x){return x&&x.id===item.id;});
    if(i>=0)arr[i]=clone(item);else arr.push(clone(item));
    if(!writeRaw(arr))throw new Error('No se pudo escribir en el almacenamiento local.');
    return item;
  }

  async function getFbd(){
    try{if(global.SimuPLCSeparateEditors&&global.SimuPLCSeparateEditors.getFBDState)return clone(global.SimuPLCSeparateEditors.getFBDState());}catch(_){ }
    try{if(typeof global.serializeCircuit==='function')return clone(global.serializeCircuit());}catch(_){ }
    return null;
  }
  async function getLadder(){try{if(global.SimuPLCSeparateEditors&&global.SimuPLCSeparateEditors.getLadderState)return clone(await global.SimuPLCSeparateEditors.getLadderState());}catch(_){ }return null;}
  async function getControl(){try{if(global.SimuPLCControlHost&&global.SimuPLCControlHost.getProject)return clone(await global.SimuPLCControlHost.getProject());}catch(_){ }return null;}

  function hmiFrame(){return document.getElementById('simuplcModularEditorFrame');}
  function hmiSend(cmd,data,timeout){
    timeout=timeout||1000;
    return new Promise(function(resolve){
      var frame=hmiFrame(),target=frame&&frame.contentWindow;
      if(!target){resolve({ok:false,error:'no-frame'});return;}
      var requestId='hmi_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),done=false;
      var tm=setTimeout(function(){finish({ok:false,error:'timeout'});},timeout);
      function finish(v){if(done)return;done=true;clearTimeout(tm);global.removeEventListener('message',onMsg);resolve(v);}
      function onMsg(ev){var m=ev.data||{};if(!m.__simuplcHmiHost||m.requestId!==requestId)return;finish(m);}
      global.addEventListener('message',onMsg);
      try{target.postMessage({__simuplcHmiHost:true,requestId:requestId,cmd:cmd,data:data},'*');}catch(e){finish({ok:false,error:String(e)});}
    });
  }
  async function getHmi(){
    var frame=hmiFrame(),src=frame&&String(frame.getAttribute('src')||'');
    if(!frame||src.indexOf('hmi.html')<0)return undefined;
    var res=await hmiSend('getProject',null,650);
    if(res&&res.ok)return clone(res.data);
    return undefined;
  }
  async function setHmi(project){
    if(!project)return true;
    var res=await hmiSend('setProject',clone(project),900);
    if(res&&res.ok)return true;
    pendingHmiProject=clone(project);return false;
  }
  async function tryApplyPendingHmi(){
    if(!pendingHmiProject||pendingHmiTimer)return;
    var data=clone(pendingHmiProject);
    pendingHmiTimer=setTimeout(function(){pendingHmiTimer=0;},250);
    var res=await hmiSend('setProject',data,1200);
    if(res&&res.ok){pendingHmiProject=null;clearTimeout(pendingHmiTimer);pendingHmiTimer=0;}
  }

  async function captureEditor(mode){
    if(mode==='ladder')return await getLadder();
    if(mode==='control')return await getControl();
    if(mode==='hmi')return await getHmi();
    return await getFbd();
  }
  async function captureComplete(name,base){
    base=base&&base.simuplcProject?clone(base.simuplcProject):blankProject(name);
    base=base||blankProject(name);base.editors=Object.assign({fbd:null,ladder:null,control:null,hmi:null},base.editors||{});
    var values=await Promise.all([getFbd(),getLadder(),getControl(),getHmi()]);
    if(values[0]!=null)base.editors.fbd=values[0];
    if(values[1]!=null)base.editors.ladder=values[1];
    if(values[2]!=null)base.editors.control=values[2];
    if(values[3]!==undefined&&values[3]!=null)base.editors.hmi=values[3];
    base.type=FORMAT;base.version=FORMAT_VERSION;base.name=safeName(name);base.savedAt=new Date().toISOString();base.activeEditor=activeEditor();
    try{if(global.SimuPLCVariableManager&&global.SimuPLCVariableManager.exportConfig)base.hardware=clone(global.SimuPLCVariableManager.exportConfig());}catch(_){ }
    return base;
  }
  async function loadFbd(data){if(!data)return true;try{if(global.SimuPLCSeparateEditors&&global.SimuPLCSeparateEditors.loadFBDState)return global.SimuPLCSeparateEditors.loadFBDState(clone(data))!==false;}catch(_){ }return false;}
  async function loadLadder(data){if(!data)return true;try{if(global.SimuPLCSeparateEditors&&global.SimuPLCSeparateEditors.loadLadderState)return (await global.SimuPLCSeparateEditors.loadLadderState(clone(data)))!==false;}catch(_){ }return false;}
  async function loadControl(data){if(!data)return true;try{if(global.SimuPLCControlHost&&global.SimuPLCControlHost.setProject)return (await global.SimuPLCControlHost.setProject(clone(data)))!==false;}catch(_){ }return false;}
  async function loadSingle(mode,data){
    var ok=false;
    if(mode==='hmi'){pendingHmiProject=clone(data);setEditor('hmi');setTimeout(tryApplyPendingHmi,120);return true;}
    if(mode==='control'){ok=await loadControl(data);setEditor('control');return ok;}
    if(mode==='ladder'){ok=await loadLadder(data);setEditor('ladder');return ok;}
    ok=await loadFbd(data);setEditor('fbd');return ok;
  }
  async function loadComplete(project){
    project=clone(project||{});var e=Object.assign({fbd:null,ladder:null,control:null,hmi:null},project.editors||{});
    // Abrir un proyecto guardado tiene prioridad sobre cualquier borrador de recuperación anterior.
    try{if(global.SimuPLCControlHost&&global.SimuPLCControlHost.discardStartupRecovery)await global.SimuPLCControlHost.discardStartupRecovery();}catch(_){}
    var results=await Promise.all([loadFbd(e.fbd),loadLadder(e.ladder),loadControl(e.control)]);
    if(e.hmi)pendingHmiProject=clone(e.hmi);
    try{if(project.hardware&&global.SimuPLCVariableManager&&global.SimuPLCVariableManager.importConfig)global.SimuPLCVariableManager.importConfig(clone(project.hardware));}catch(_){ }
    var mode=(project.activeEditor==='ladder'||project.activeEditor==='control'||project.activeEditor==='hmi')?project.activeEditor:'fbd';
    setEditor(mode);
    if(e.hmi){if(mode==='hmi')setTimeout(tryApplyPendingHmi,120);else tryApplyPendingHmi();}
    return results.every(function(v){return v!==false;});
  }

  async function openProjectDirect(id){
    var item=getItem(id);if(!item){alert('No se encontró el proyecto.');return false;}
    var p=clone(item.simuplcProject),e=projectEditors(item),keys=['fbd','ladder','control','hmi'].filter(function(k){return !!e[k];});
    var ok=true;
    if(keys.length<=1){var mode=keys[0]||item.primaryEditor||'fbd';ok=await loadSingle(mode,e[mode]);}
    else ok=await loadComplete(p);
    if(ok!==false){sessionSet(item.id);refreshLibrary();closeLibrary();toast('Proyecto cargado: '+item.name);return true;}
    alert('No se pudo cargar el proyecto completo.');return false;
  }

  function setOpenGuardBusy(v){
    openGuardBusy=!!v;
    if(!openGuardModal)return;
    openGuardModal.querySelectorAll('button').forEach(function(b){
      if(b.hasAttribute('data-open-save'))b.disabled=openGuardBusy||!openGuardCanSave;
      else b.disabled=openGuardBusy;
    });
    if(openGuardNameInput)openGuardNameInput.disabled=openGuardBusy;
    var save=openGuardModal.querySelector('[data-open-save]');
    if(save){
      save.textContent=openGuardBusy?'⏳ Guardando…':'💾 Guardar y abrir';
      save.style.setProperty('opacity',openGuardBusy?'.78':'1','important');
    }
  }
  function closeOpenGuard(){
    if(!openGuardModal)return;
    openGuardModal.classList.remove('show');
    openGuardModal.setAttribute('aria-hidden','true');
    pendingOpenId=null;
    openGuardCanSave=false;
    setOpenGuardBusy(false);
  }
  function ensureOpenGuardModal(){
    if(openGuardModal&&document.body.contains(openGuardModal))return;
    if(!document.getElementById('simuplc-open-guard-v23-style')){
      var s=document.createElement('style');
      s.id='simuplc-open-guard-v23-style';
      s.textContent=
        '#simuplcOpenGuard{position:fixed;inset:0;z-index:2147483655;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.62);backdrop-filter:blur(5px)}'+
        '#simuplcOpenGuard.show{display:flex}'+
        '#simuplcOpenGuard .sp-open-card{width:min(520px,96vw);background:#fff;border:1px solid #dbe2ea;border-radius:22px;box-shadow:0 28px 80px rgba(15,23,42,.34);padding:20px;font-family:Arial,sans-serif}'+
        '#simuplcOpenGuard .sp-open-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}'+
        '#simuplcOpenGuard .sp-open-icon{width:46px;height:46px;flex:0 0 46px;border-radius:15px;display:grid;place-items:center;background:#fff7ed;font-size:22px}'+
        '#simuplcOpenGuard h3{margin:0;color:#0f172a;font-size:19px;font-weight:900}'+
        '#simuplcOpenGuard .sp-open-sub{margin:4px 0 0;color:#64748b;font-size:12px;font-weight:700;line-height:1.42}'+
        '#simuplcOpenGuard .sp-open-target{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:12px;font-weight:850}'+
        '#simuplcOpenGuard .sp-open-name{margin-top:12px;padding:12px;border:1px solid #bfdbfe;background:#f8fbff;border-radius:13px}'+
        '#simuplcOpenGuard .sp-open-name label{display:block;margin-bottom:6px;color:#334155;font-size:11px;font-weight:900}'+
        '#simuplcOpenGuard .sp-open-name input{width:100%;height:42px;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;padding:0 11px;background:#fff;color:#0f172a;font-size:13px;font-weight:800;outline:none}'+
        '#simuplcOpenGuard .sp-open-name input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}'+
        '#simuplcOpenGuard .sp-open-hint{margin:10px 2px 0;color:#64748b;font-size:11px;font-weight:750;line-height:1.4}'+
        '#simuplcOpenGuard .sp-open-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}'+
        '#simuplcOpenGuard .sp-open-actions button,#simuplcOpenGuard .sp-open-cancel{min-height:43px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;font-weight:850;font-size:12px;cursor:pointer;padding:9px 12px}'+
        '#simuplcOpenGuard [data-open-save]{background:#0f4c81!important;color:#fff!important;border-color:#0f4c81!important;font-weight:900!important}'+
        '#simuplcOpenGuard [data-open-discard]{background:#fff7ed!important;color:#9a3412!important;border-color:#fdba74!important;font-weight:900!important}'+
        '#simuplcOpenGuard .sp-open-cancel{width:100%;margin-top:9px;color:#475569}'+
        '#simuplcOpenGuard button:disabled{opacity:.55;cursor:wait}'+
        '@media(max-width:560px){#simuplcOpenGuard .sp-open-card{padding:16px;border-radius:18px}#simuplcOpenGuard .sp-open-actions{grid-template-columns:1fr}}';
      document.head.appendChild(s);
    }
    openGuardModal=document.createElement('div');
    openGuardModal.id='simuplcOpenGuard';
    openGuardModal.setAttribute('aria-hidden','true');
    openGuardModal.innerHTML=
      '<div class="sp-open-card" role="dialog" aria-modal="true">'+
        '<div class="sp-open-head"><div class="sp-open-icon">⚠️</div><div><h3>Antes de abrir otro proyecto</h3><p class="sp-open-sub">Tienes trabajo abierto. Elige si deseas guardarlo antes de cargar otro proyecto.</p></div></div>'+
        '<div id="simuplcOpenTargetName" class="sp-open-target"></div>'+
        '<div id="simuplcOpenGuardNameWrap" class="sp-open-name" hidden><label for="simuplcOpenGuardName">Nombre del proyecto actual</label><input id="simuplcOpenGuardName" type="text" maxlength="80" autocomplete="off" placeholder="Ej. Arranque de motor"></div>'+
        '<div id="simuplcOpenGuardHint" class="sp-open-hint"></div>'+
        '<div class="sp-open-actions"><button type="button" data-open-save>💾 Guardar y abrir</button><button type="button" data-open-discard>Abrir sin guardar</button></div>'+
        '<button type="button" class="sp-open-cancel" data-open-cancel>Cancelar</button>'+
      '</div>';
    document.body.appendChild(openGuardModal);
    openGuardNameWrap=document.getElementById('simuplcOpenGuardNameWrap');
    openGuardNameInput=document.getElementById('simuplcOpenGuardName');
    openGuardHint=document.getElementById('simuplcOpenGuardHint');
    openGuardTargetName=document.getElementById('simuplcOpenTargetName');
    openGuardModal.addEventListener('click',function(ev){
      if(ev.target.closest&&ev.target.closest('[data-open-save]')){saveThenOpenPending();return;}
      if(ev.target.closest&&ev.target.closest('[data-open-discard]')){openPendingWithoutSave();return;}
      if(ev.target.closest&&ev.target.closest('[data-open-cancel]')){closeOpenGuard();return;}
      if(ev.target===openGuardModal&&!openGuardBusy)closeOpenGuard();
    });
    openGuardModal.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!openGuardBusy)closeOpenGuard();});
  }
  async function saveThenOpenPending(){
    if(openGuardBusy||!pendingOpenId||!openGuardCanSave)return;
    var current=getItem(getCurrentId());
    var typedName=current?current.name:(openGuardNameInput&&String(openGuardNameInput.value||'').trim());
    if(!current&&!typedName){
      if(openGuardNameInput){
        openGuardNameInput.focus();
        openGuardNameInput.style.setProperty('border-color','#dc2626','important');
        openGuardNameInput.style.setProperty('box-shadow','0 0 0 3px rgba(220,38,38,.12)','important');
      }
      if(openGuardHint)openGuardHint.textContent='Escribe un nombre para guardar tu trabajo actual.';
      return;
    }
    setOpenGuardBusy(true);
    try{
      var saved=await saveCompleteBeforeNew(typedName);
      if(!saved){setOpenGuardBusy(false);return;}
      var id=pendingOpenId;
      closeOpenGuard();
      await openProjectDirect(id);
    }catch(e){
      setOpenGuardBusy(false);
      var api=modalApi();
      if(api&&typeof api.alert==='function')api.alert('No se pudo guardar el proyecto actual: '+(e.message||e),'Abrir proyecto');
      else alert('No se pudo guardar el proyecto actual: '+(e.message||e));
    }
  }
  async function openPendingWithoutSave(){
    if(openGuardBusy||!pendingOpenId)return;
    setOpenGuardBusy(true);
    var id=pendingOpenId;
    closeOpenGuard();
    await openProjectDirect(id);
  }
  async function openProject(id){
    var item=getItem(id);if(!item){alert('No se encontró el proyecto.');return false;}

    /*
      V23: antes de sustituir el trabajo visible, comprueba si existe contenido.
      Si la app está vacía, abre directamente. Si hay trabajo, protege al usuario.
    */
    var status;
    try{status=await currentWorkStatus('project',activeEditor());}
    catch(_){status={hasWork:!!getCurrentId(),current:getItem(getCurrentId())};}

    if(!status||!status.hasWork)return await openProjectDirect(id);

    ensureOpenGuardModal();
    pendingOpenId=id;
    openGuardCanSave=true;

    if(openGuardTargetName)openGuardTargetName.textContent='Vas a abrir: '+safeName(item.name,'Proyecto');
    if(openGuardNameInput){
      openGuardNameInput.value='';
      openGuardNameInput.style.removeProperty('border-color');
      openGuardNameInput.style.removeProperty('box-shadow');
    }

    if(status.current){
      if(openGuardNameWrap)openGuardNameWrap.hidden=true;
      if(openGuardHint)openGuardHint.textContent='Si eliges “Guardar y abrir”, se actualizará “'+status.current.name+'” antes de abrir el otro proyecto.';
    }else{
      if(openGuardNameWrap)openGuardNameWrap.hidden=false;
      if(openGuardNameInput)openGuardNameInput.value='Proyecto SimuPLC';
      if(openGuardHint)openGuardHint.textContent='Este trabajo todavía no está guardado. Ponle un nombre si deseas conservararlo antes de abrir el otro proyecto.';
    }

    setOpenGuardBusy(false);
    openGuardModal.classList.add('show');
    openGuardModal.setAttribute('aria-hidden','false');
    return false;
  }

  function targetForSave(name){
    var current=getCurrentId();
    if(!forceSaveAs&&current){var item=getItem(current);if(item)return item;}
    var same=findByName(name,null);if(same)return same;
    return null;
  }
  async function saveScope(scope){
    var mode=activeEditor();var name=safeName(nameInput&&nameInput.value,(scope==='single'?'Proyecto '+editorLabel(mode):'Proyecto SimuPLC'));
    if(!name){return;}
    var target=targetForSave(name),created=target?target.createdAt:now();
    if(!target)target={id:makeId(),name:name,editor:'project',projectKind:'SIMUPLC_PROJECT_V19',saveScope:scope,primaryEditor:mode,createdAt:created,updatedAt:created,simuplcProject:blankProject(name)};
    var project=target.simuplcProject?clone(target.simuplcProject):blankProject(name);project.editors=Object.assign({fbd:null,ladder:null,control:null,hmi:null},project.editors||{});
    if(scope==='single'){
      var state=await captureEditor(mode);
      if(state===undefined||state===null)throw new Error('No se pudo leer el editor '+editorLabel(mode)+'.');
      project.editors[mode]=clone(state);project.activeEditor=mode;project.savedAt=new Date().toISOString();project.name=name;
    }else{
      project=await captureComplete(name,target);
    }
    target.name=name;target.editor='project';target.projectKind='SIMUPLC_PROJECT_V19';target.saveScope=scope;target.primaryEditor=mode;target.updatedAt=now();target.simuplcProject=project;
    upsert(target);sessionSet(target.id);forceSaveAs=false;refreshLibrary();closeSave();
    toast(scope==='single'?'Proyecto actualizado · '+editorLabel(mode):'Proyecto completo actualizado');
    return target;
  }


  function newEditorLabel(mode){
    return mode==='hmi'?'HMI':editorLabel(mode);
  }
  function newCircuitName(mode){
    return mode==='hmi'?'Nueva pantalla HMI':'Nuevo circuito';
  }
  function modalApi(){
    return global.SimuPLCNativeModal||global.SimuPLCModal||null;
  }
  function hasFbdContent(s){
    s=s||{};
    return !!(
      (Array.isArray(s.nodes)&&s.nodes.length) ||
      (Array.isArray(s.connections)&&s.connections.length) ||
      (Array.isArray(s.wires)&&s.wires.length) ||
      (Array.isArray(s.freeTexts)&&s.freeTexts.length) ||
      (Array.isArray(s.annotations)&&s.annotations.length) ||
      (Array.isArray(s.texts)&&s.texts.length)
    );
  }
  function hasLadderContent(s){
    s=s||{};
    var rungs=Array.isArray(s.rungs)?s.rungs:[];
    return !!(
      rungs.some(function(r){return r&&Array.isArray(r.elements)&&r.elements.length;}) ||
      (Array.isArray(s.proWires)&&s.proWires.length) ||
      (Array.isArray(s.proJunctions)&&s.proJunctions.length) ||
      (Array.isArray(s.referenceTexts)&&s.referenceTexts.length) ||
      (Array.isArray(s.annotations)&&s.annotations.length)
    );
  }
  function hasControlContent(s){
    s=s||{};
    return !!(
      (Array.isArray(s.elements)&&s.elements.length) ||
      (Array.isArray(s.wires)&&s.wires.length) ||
      (Array.isArray(s.junctions)&&s.junctions.length) ||
      (Array.isArray(s.freeTexts)&&s.freeTexts.length)
    );
  }
  function hasHmiContent(s){
    s=s||{};
    return !!(
      (Array.isArray(s.elements)&&s.elements.length) ||
      (Array.isArray(s.widgets)&&s.widgets.length) ||
      (Array.isArray(s.objects)&&s.objects.length)
    );
  }
  function stateHasContent(mode,state){
    if(mode==='ladder')return hasLadderContent(state);
    if(mode==='control')return hasControlContent(state);
    if(mode==='hmi')return hasHmiContent(state);
    return hasFbdContent(state);
  }
  async function currentWorkStatus(kind,mode){
    var current=getItem(getCurrentId());
    if(current)return {hasCurrent:true,hasWork:true,current:current};

    if(kind==='circuit'){
      var single=await captureEditor(mode);
      return {hasCurrent:false,hasWork:stateHasContent(mode,single),current:null};
    }

    var values=await Promise.all([getFbd(),getLadder(),getControl(),getHmi()]);
    var hasAny=
      stateHasContent('fbd',values[0]) ||
      stateHasContent('ladder',values[1]) ||
      stateHasContent('control',values[2]) ||
      stateHasContent('hmi',values[3]);
    return {hasCurrent:false,hasWork:!!hasAny,current:null};
  }
  async function backupBeforeNew(reason){
    try{
      if(global.SimuPLCRecovery&&typeof global.SimuPLCRecovery.createBackup==='function'){
        await global.SimuPLCRecovery.createBackup(reason);
      }
    }catch(_){}
  }
  async function saveCompleteBeforeNew(nameOverride){
    var current=getItem(getCurrentId()),name=current&&current.name;

    /*
      V22.2:
      - Proyecto existente: conserva su nombre y se actualiza.
      - Trabajo nuevo todavía sin guardar: el nombre viene del campo visible
        dentro del mismo modal NEW. Ya no se abre otro prompt detrás del modal.
    */
    if(!name){
      name=safeName(nameOverride||'','');
      if(!name)return false;
    }

    var target=current||findByName(name,null),created=target?target.createdAt:now();
    if(!target)target={id:makeId(),name:name,editor:'project',projectKind:'SIMUPLC_PROJECT_V19',saveScope:'complete',primaryEditor:activeEditor(),createdAt:created,updatedAt:created,simuplcProject:blankProject(name)};
    var project=await captureComplete(name,target);
    target.name=name;
    target.editor='project';
    target.projectKind='SIMUPLC_PROJECT_V19';
    target.saveScope='complete';
    target.primaryEditor=activeEditor();
    target.updatedAt=now();
    target.simuplcProject=project;
    upsert(target);
    sessionSet(target.id);
    forceSaveAs=false;
    refreshLibrary();
    toast('Proyecto actual guardado');
    return target;
  }
  async function resetEditorOnly(mode){
    mode=(mode==='ladder'||mode==='control'||mode==='hmi')?mode:'fbd';
    if(mode==='fbd'){
      if(global.SimuPLCSeparateEditors&&typeof global.SimuPLCSeparateEditors.resetFBDOnly==='function'){
        return global.SimuPLCSeparateEditors.resetFBDOnly()!==false;
      }
      return false;
    }
    if(mode==='ladder'){
      if(global.SimuPLCSeparateEditors&&typeof global.SimuPLCSeparateEditors.resetLadderOnly==='function'){
        return (await global.SimuPLCSeparateEditors.resetLadderOnly())!==false;
      }
      return false;
    }
    if(mode==='control'){
      if(global.SimuPLCControlHost&&typeof global.SimuPLCControlHost.clear==='function'){
        return (await global.SimuPLCControlHost.clear())!==false;
      }
      return false;
    }
    if(mode==='hmi'){
      var frame=hmiFrame();
      pendingHmiProject=null;
      if(pendingHmiTimer){clearTimeout(pendingHmiTimer);pendingHmiTimer=0;}

      /* V24: Nuevo proyecto borra HMI en memoria y su autosave. */
      try{localStorage.removeItem('simuplc_hmi_project_v1');}catch(_){}
      if(!frame)return true;

      var r=await hmiSend('clear',null,1800);
      if(r&&r.ok){
        var check=await hmiSend('getProject',null,700);
        var els=check&&check.ok&&check.data&&Array.isArray(check.data.elements)?check.data.elements:[];
        if(!els.length){
          try{localStorage.removeItem('simuplc_hmi_project_v1');}catch(_){}
          return true;
        }
      }

      /* Respaldo fuerte si el HMI no respondió o conservó elementos. */
      try{localStorage.removeItem('simuplc_hmi_project_v1');}catch(_){}
      try{
        var wasHmi=document.body&&document.body.classList.contains('mode-hmi');
        frame.src='about:blank';
        await new Promise(function(resolve){setTimeout(resolve,40);});
        if(wasHmi){
          frame.src='hmi.html?v=24-project-reset';
          hmiReady=false;
        }
        return true;
      }catch(_){return false;}
    }
    return false;
  }
  async function resetWholeProject(){
    pendingHmiProject=null;
    try{localStorage.removeItem('simuplc_hmi_project_v1');}catch(_){}
    try{if(global.SimuPLCRecoveryManager&&global.SimuPLCRecoveryManager.acknowledge)await global.SimuPLCRecoveryManager.acknowledge('nuevo-proyecto');}catch(_){}
    var okFbd=await resetEditorOnly('fbd');
    var okLadder=await resetEditorOnly('ladder');
    var okControl=await resetEditorOnly('control');
    var okHmi=await resetEditorOnly('hmi');
    return okFbd!==false&&okLadder!==false&&okControl!==false&&okHmi!==false;
  }
  function setNewBusy(v){
    newBusy=!!v;
    if(!newModal)return;
    newModal.querySelectorAll('button').forEach(function(b){
      if(b.hasAttribute('data-new-save'))b.disabled=newBusy||!newCanSave;
      else b.disabled=newBusy;
    });
    if(newNameInput)newNameInput.disabled=newBusy;
    var save=newModal.querySelector('[data-new-save]');
    if(save){
      save.textContent=newBusy?'⏳ Guardando proyecto…':'💾 Guardar y continuar';
      save.style.setProperty('background','#0f4c81','important');
      save.style.setProperty('color','#ffffff','important');
      save.style.setProperty('border-color','#0f4c81','important');
      save.style.setProperty('font-size','12px','important');
      save.style.setProperty('font-weight','900','important');
      save.style.setProperty('opacity',newBusy?'.78':'1','important');
    }
  }
  function closeNew(){
    if(!newModal)return;
    newModal.classList.remove('show');
    newModal.setAttribute('aria-hidden','true');
    pendingNewKind=null;
    pendingNewEditor=null;
    setNewBusy(false);
  }
  function showNewChoice(){
    if(!newChoiceStage||!newConfirmStage)return;
    newChoiceStage.hidden=false;
    newConfirmStage.hidden=true;
  }
  function applyNewSaveState(status){
    var save=newModal&&newModal.querySelector('[data-new-save]');
    var actions=newModal&&newModal.querySelector('.sp-new-actions');
    var current=status&&status.current;
    newCanSave=!!(status&&status.hasWork);

    if(newNameWrap)newNameWrap.hidden=!!current||!newCanSave;
    if(newNameInput){
      if(!current&&newCanSave&&!newNameInput.value)newNameInput.value='Proyecto SimuPLC';
    }

    if(save){
      save.hidden=!newCanSave;
      save.disabled=newBusy||!newCanSave;
    }
    if(actions)actions.classList.toggle('only-discard',!newCanSave);

    if(newSaveHint){
      if(current){
        newSaveHint.hidden=false;
        newSaveHint.textContent='Se actualizará el proyecto “'+current.name+'” antes de continuar.';
      }else if(newCanSave){
        newSaveHint.hidden=false;
        newSaveHint.textContent='Este trabajo todavía no tiene nombre. Escribe uno para guardarlo antes de continuar.';
      }else{
        newSaveHint.hidden=false;
        newSaveHint.textContent='No hay contenido que guardar. Puedes continuar directamente.';
      }
    }
    setNewBusy(false);
  }
  async function refreshNewSaveState(kind,mode){
    newCanSave=false;
    var save=newModal&&newModal.querySelector('[data-new-save]');
    if(save){save.hidden=true;save.disabled=true;}
    if(newNameWrap)newNameWrap.hidden=true;
    if(newSaveHint){newSaveHint.hidden=false;newSaveHint.textContent='Comprobando el proyecto actual…';}
    try{
      var status=await currentWorkStatus(kind,mode);
      if(pendingNewKind!==kind||pendingNewEditor!==mode)return;
      applyNewSaveState(status);
    }catch(_){
      /* Si no podemos comprobarlo, evitamos bloquear al usuario. */
      applyNewSaveState({hasCurrent:!!getCurrentId(),hasWork:!!getCurrentId(),current:getItem(getCurrentId())});
    }
  }
  function showNewConfirm(kind,mode){
    pendingNewKind=kind;
    pendingNewEditor=mode;
    if(newChoiceStage)newChoiceStage.hidden=true;
    if(newConfirmStage)newConfirmStage.hidden=false;
    if(kind==='project'){
      if(newConfirmTitle)newConfirmTitle.textContent='¿Comenzar un proyecto nuevo?';
      if(newConfirmDesc)newConfirmDesc.textContent='Se limpiarán FBD, Ladder, CONTROL y HMI. Puedes guardar el proyecto actual antes de continuar.';
    }else{
      var label=newEditorLabel(mode);
      if(newConfirmTitle)newConfirmTitle.textContent=(mode==='hmi'?'¿Crear una pantalla HMI nueva?':'¿Crear un circuito nuevo en '+label+'?');
      if(newConfirmDesc)newConfirmDesc.textContent=(mode==='hmi'?'Se limpiará únicamente HMI. FBD, Ladder y CONTROL permanecerán intactos.':'Se limpiará únicamente '+label+'. Los demás editores permanecerán intactos.');
    }
    refreshNewSaveState(kind,mode);
  }
  async function executeNew(kind,mode){
    await backupBeforeNew(kind==='project'?'antes-de-nuevo-proyecto':'antes-de-nuevo-'+mode);
    var ok;
    if(kind==='project'){
      ok=await resetWholeProject();
      if(ok!==false){
        clearCurrent();
        closeNew();
        toast('Proyecto nuevo listo · todos los editores están vacíos');
        return true;
      }
      throw new Error('No se pudieron limpiar todos los editores.');
    }
    ok=await resetEditorOnly(mode);
    if(ok!==false){
      closeNew();
      toast(mode==='hmi'?'Nueva pantalla HMI lista':'Nuevo circuito '+newEditorLabel(mode)+' listo');
      return true;
    }
    throw new Error('No se pudo limpiar '+newEditorLabel(mode)+'.');
  }
  async function saveAndExecuteNew(){
    if(newBusy||!newCanSave)return;
    var current=getItem(getCurrentId());
    var typedName=current?current.name:(newNameInput&&String(newNameInput.value||'').trim());
    if(!current&&!typedName){
      if(newNameInput){
        newNameInput.focus();
        newNameInput.style.setProperty('border-color','#dc2626','important');
        newNameInput.style.setProperty('box-shadow','0 0 0 3px rgba(220,38,38,.12)','important');
      }
      if(newSaveHint)newSaveHint.textContent='Escribe un nombre para poder guardar este proyecto.';
      return;
    }
    if(newNameInput){
      newNameInput.style.removeProperty('border-color');
      newNameInput.style.removeProperty('box-shadow');
    }
    setNewBusy(true);
    try{
      var saved=await saveCompleteBeforeNew(typedName);
      if(!saved){setNewBusy(false);return;}
      await executeNew(pendingNewKind,pendingNewEditor);
    }catch(e){
      setNewBusy(false);
      var api=modalApi();
      if(api&&typeof api.alert==='function')api.alert('No se pudo completar la operación: '+(e.message||e),'Nuevo');
      else alert('No se pudo completar la operación: '+(e.message||e));
    }
  }
  async function discardAndExecuteNew(){
    if(newBusy)return;
    setNewBusy(true);
    try{
      await executeNew(pendingNewKind,pendingNewEditor);
    }catch(e){
      setNewBusy(false);
      var api=modalApi();
      if(api&&typeof api.alert==='function')api.alert('No se pudo completar la operación: '+(e.message||e),'Nuevo');
      else alert('No se pudo completar la operación: '+(e.message||e));
    }
  }
  function installNewStyles(){
    if(document.getElementById('simuplc-new-project-v22-style'))return;
    var s=document.createElement('style');
    s.id='simuplc-new-project-v22-style';
    s.textContent=
      '#simuplcNewChoice{position:fixed;inset:0;z-index:2147483650;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.60);backdrop-filter:blur(5px)}'+
      '#simuplcNewChoice.show{display:flex}'+
      '#simuplcNewChoice .sp-new-card{width:min(540px,96vw);max-height:min(720px,92vh);overflow:auto;background:#fff;border:1px solid #dbe2ea;border-radius:22px;box-shadow:0 28px 80px rgba(15,23,42,.32);padding:20px;font-family:Arial,sans-serif}'+
      '#simuplcNewChoice .sp-new-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}'+
      '#simuplcNewChoice .sp-new-icon{width:46px;height:46px;flex:0 0 46px;border-radius:15px;display:grid;place-items:center;background:#e8f1ff;font-size:23px}'+
      '#simuplcNewChoice h3{margin:0;color:#0f172a;font-size:20px;font-weight:900}'+
      '#simuplcNewChoice .sp-new-sub{margin:4px 0 0;color:#64748b;font-size:12px;font-weight:700;line-height:1.4}'+
      '#simuplcNewChoice .sp-new-options{display:grid;gap:10px}'+
      '#simuplcNewChoice .sp-new-option{width:100%;display:flex;gap:12px;text-align:left;align-items:flex-start;padding:14px;border-radius:15px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;cursor:pointer}'+
      '#simuplcNewChoice .sp-new-option:hover{border-color:#60a5fa;background:#eff6ff}'+
      '#simuplcNewChoice .sp-new-option .ico{font-size:22px;line-height:1.1}'+
      '#simuplcNewChoice .sp-new-option strong{display:block;font-size:14px;margin-bottom:3px}'+
      '#simuplcNewChoice .sp-new-option small{display:block;color:#64748b;font-size:11px;line-height:1.35;font-weight:700}'+
      '#simuplcNewChoice .sp-new-option.project{border-color:#93c5fd;background:#eff6ff}'+
      '#simuplcNewChoice .sp-new-confirm{padding:13px;border:1px solid #dbeafe;background:#f8fbff;border-radius:15px}'+
      '#simuplcNewChoice .sp-new-confirm h4{margin:0 0 6px;color:#0f172a;font-size:16px}'+
      '#simuplcNewChoice .sp-new-confirm p{margin:0;color:#64748b;font-size:12px;font-weight:700;line-height:1.45}'+
      '#simuplcNewChoice .sp-new-name{margin-top:12px;padding:12px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:13px}'+
      '#simuplcNewChoice .sp-new-name label{display:block;margin-bottom:6px;color:#334155;font-size:11px;font-weight:900}'+
      '#simuplcNewChoice .sp-new-name input{width:100%;height:42px;box-sizing:border-box;border:1px solid #94a3b8;border-radius:10px;padding:0 11px;background:#fff;color:#0f172a;font-size:13px;font-weight:800;outline:none}'+
      '#simuplcNewChoice .sp-new-name input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}'+
      '#simuplcNewChoice .sp-new-save-hint{margin:10px 2px 0;color:#64748b;font-size:11px;font-weight:750;line-height:1.4}'+
      '#simuplcNewChoice .sp-new-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}'+
      '#simuplcNewChoice .sp-new-actions.only-discard{grid-template-columns:1fr}'+
      '#simuplcNewChoice .sp-new-actions button,#simuplcNewChoice .sp-new-cancel{min-height:43px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;font-weight:850;font-size:12px;cursor:pointer;padding:9px 12px}'+
      '#simuplcNewChoice [data-new-save]{background:#0f4c81!important;color:#fff!important;border-color:#0f4c81!important;font-size:12px!important;font-weight:900!important}'+
      '#simuplcNewChoice [data-new-discard]{background:#fff7ed!important;color:#9a3412!important;border-color:#fdba74!important;font-size:12px!important;font-weight:900!important}'+
      '#simuplcNewChoice .sp-new-cancel{width:100%;margin-top:10px;color:#475569}'+
      '#simuplcNewChoice button:disabled{opacity:.55;cursor:wait}'+
      '@media(max-width:560px){#simuplcNewChoice .sp-new-card{padding:16px;border-radius:18px}#simuplcNewChoice .sp-new-actions{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function ensureNewModal(){
    if(newModal&&document.body.contains(newModal))return;
    installNewStyles();
    newModal=document.createElement('div');
    newModal.id='simuplcNewChoice';
    newModal.setAttribute('aria-hidden','true');
    newModal.innerHTML=
      '<div class="sp-new-card" role="dialog" aria-modal="true" aria-labelledby="simuplcNewTitle">'+
        '<div class="sp-new-head"><div class="sp-new-icon">✨</div><div><h3 id="simuplcNewTitle">Crear nuevo</h3><p class="sp-new-sub">Elige si deseas empezar todo SimuPLC desde cero o limpiar únicamente el editor actual.</p></div></div>'+
        '<div id="simuplcNewChoiceStage" class="sp-new-options">'+
          '<button type="button" class="sp-new-option project" data-new-kind="project"><span class="ico">🗂️</span><span><strong>Nuevo proyecto</strong><small>Limpia FBD, Ladder, CONTROL y HMI y comienza un proyecto completamente nuevo.</small></span></button>'+
          '<button type="button" class="sp-new-option" data-new-kind="circuit"><span class="ico">⚙️</span><span><strong id="simuplcNewCircuitTitle">Nuevo circuito</strong><small id="simuplcNewCircuitDesc">Limpia únicamente el editor actual y conserva los demás.</small></span></button>'+
          '<button type="button" class="sp-new-cancel" data-new-cancel>Cancelar</button>'+
        '</div>'+
        '<div id="simuplcNewConfirmStage" hidden>'+
          '<div class="sp-new-confirm"><h4 id="simuplcNewConfirmTitle"></h4><p id="simuplcNewConfirmDesc"></p></div>'+
          '<div id="simuplcNewNameWrap" class="sp-new-name" hidden><label for="simuplcNewProjectName">Nombre del proyecto actual</label><input id="simuplcNewProjectName" type="text" maxlength="80" autocomplete="off" placeholder="Ej. Arranque de motor"></div>'+
          '<div id="simuplcNewSaveHint" class="sp-new-save-hint"></div>'+
          '<div class="sp-new-actions"><button type="button" data-new-save style="background:#0f4c81;color:#fff;border-color:#0f4c81;font-size:12px;font-weight:900">💾 Guardar y continuar</button><button type="button" data-new-discard>Continuar sin guardar</button></div>'+
          '<button type="button" class="sp-new-cancel" data-new-back>Volver</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(newModal);
    newChoiceStage=document.getElementById('simuplcNewChoiceStage');
    newConfirmStage=document.getElementById('simuplcNewConfirmStage');
    newCircuitTitle=document.getElementById('simuplcNewCircuitTitle');
    newCircuitDesc=document.getElementById('simuplcNewCircuitDesc');
    newConfirmTitle=document.getElementById('simuplcNewConfirmTitle');
    newConfirmDesc=document.getElementById('simuplcNewConfirmDesc');
    newNameWrap=document.getElementById('simuplcNewNameWrap');
    newNameInput=document.getElementById('simuplcNewProjectName');
    newSaveHint=document.getElementById('simuplcNewSaveHint');
    if(newNameInput)newNameInput.addEventListener('input',function(){
      newNameInput.style.removeProperty('border-color');
      newNameInput.style.removeProperty('box-shadow');
    });
    setNewBusy(false);
    newModal.addEventListener('click',function(ev){
      var kind=ev.target&&ev.target.closest&&ev.target.closest('[data-new-kind]');
      if(kind){showNewConfirm(kind.getAttribute('data-new-kind'),pendingNewEditor||activeEditor());return;}
      if(ev.target.closest&&ev.target.closest('[data-new-save]')){saveAndExecuteNew();return;}
      if(ev.target.closest&&ev.target.closest('[data-new-discard]')){discardAndExecuteNew();return;}
      if(ev.target.closest&&ev.target.closest('[data-new-back]')){showNewChoice();return;}
      if(ev.target.closest&&ev.target.closest('[data-new-cancel]')){closeNew();return;}
      if(ev.target===newModal&&!newBusy)closeNew();
    });
    newModal.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!newBusy)closeNew();});
  }
  function openNew(requestedEditor){
    ensureNewModal();
    pendingNewEditor=(requestedEditor==='ladder'||requestedEditor==='control'||requestedEditor==='hmi'||requestedEditor==='fbd')?requestedEditor:activeEditor();
    pendingNewKind=null;
    newCanSave=false;
    if(newNameInput)newNameInput.value='';
    if(newNameWrap)newNameWrap.hidden=true;
    if(newCircuitTitle)newCircuitTitle.textContent=newCircuitName(pendingNewEditor);
    if(newCircuitDesc)newCircuitDesc.textContent=pendingNewEditor==='hmi'?'Limpia únicamente la pantalla HMI actual. FBD, Ladder y CONTROL no cambian.':'Limpia únicamente '+newEditorLabel(pendingNewEditor)+'. Los demás editores no cambian.';
    showNewChoice();
    newModal.classList.add('show');
    newModal.setAttribute('aria-hidden','false');
  }

  function installStyles(){
    if(document.getElementById('simuplc-unified-projects-v19-style'))return;
    var s=document.createElement('style');s.id='simuplc-unified-projects-v19-style';s.textContent='\n'+
      '#simuplcSaveChoice .sp-save-card{width:min(560px,96vw)!important}\n'+
      '#simuplcSaveChoice .sp-save-actions{grid-template-columns:1fr 1fr!important}\n'+
      '#simuplcSaveChoice .sp-save-as{grid-column:1/-1;background:#fff7ed!important;border-color:#fdba74!important;color:#9a3412!important}\n'+
      '#simuplcSaveChoice .sp-current{margin:10px 0 0;padding:9px 11px;border-radius:11px;background:#f1f5f9;color:#475569;font:700 12px/1.35 Arial}\n'+
      '#simuplcSaveChoice .sp-save-input[readonly]{background:#f8fafc;color:#334155}\n'+
      '.project-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}.project-badge{display:inline-flex;padding:3px 7px;border-radius:999px;background:#e8f1ff;color:#0f4c81;font:800 10px Arial;border:1px solid #bfdbfe}.project-badge.complete{background:#dcfce7;color:#166534;border-color:#86efac}.project-badge.current{background:#fff7ed;color:#9a3412;border-color:#fdba74}\n'+
      '.circuit-row.is-current{outline:2px solid #f59e0b!important;outline-offset:2px}\n'+
      '@media(max-width:650px){#simuplcSaveChoice .sp-save-actions{grid-template-columns:1fr!important}.sp-save-as{grid-column:auto!important}}';document.head.appendChild(s);
  }
  function replaceNode(id){var old=document.getElementById(id);if(!old||!old.parentNode)return old;var n=old.cloneNode(true);old.parentNode.replaceChild(n,old);return n;}
  function setupSaveModal(){
    modal=document.getElementById('simuplcSaveChoice');if(!modal)return;
    installStyles();
    var card=modal.querySelector('.sp-save-card'),h=card&&card.querySelector('h3'),sub=card&&card.querySelector('.sp-save-sub');
    if(h)h.textContent='Guardar proyecto';if(sub)sub.textContent='Guarda solo el editor actual o actualiza el proyecto completo FBD + Ladder + CONTROL + HMI.';
    nameInput=replaceNode('simuplcSaveChoiceName');cancelBtn=replaceNode('simuplcSaveCancel');saveSingleBtn=replaceNode('simuplcSaveSingle');saveCompleteBtn=replaceNode('simuplcSaveGlobal');
    var actions=modal.querySelector('.sp-save-actions');
    saveAsBtn=document.getElementById('simuplcSaveAs');if(!saveAsBtn&&actions){saveAsBtn=document.createElement('button');saveAsBtn.id='simuplcSaveAs';saveAsBtn.type='button';saveAsBtn.className='sp-save-as';saveAsBtn.textContent='Guardar como…';actions.appendChild(saveAsBtn);}
    var info=document.getElementById('simuplcSaveCurrentInfo');if(!info&&nameInput){info=document.createElement('div');info.id='simuplcSaveCurrentInfo';info.className='sp-current';nameInput.insertAdjacentElement('afterend',info);}
    if(cancelBtn)cancelBtn.onclick=closeSave;
    if(saveSingleBtn)saveSingleBtn.onclick=function(){saveScope('single').catch(function(e){alert('No se pudo guardar: '+(e.message||e));});};
    if(saveCompleteBtn)saveCompleteBtn.onclick=function(){saveScope('complete').catch(function(e){alert('No se pudo guardar el proyecto: '+(e.message||e));});};
    if(saveAsBtn)saveAsBtn.onclick=function(){
      var cur=getItem(getCurrentId());forceSaveAs=true;
      if(nameInput){nameInput.readOnly=false;nameInput.value=safeName((cur&&cur.name?cur.name:'Proyecto SimuPLC')+' copia');nameInput.focus();nameInput.select();}
      var i=document.getElementById('simuplcSaveCurrentInfo');if(i)i.textContent='Guardar como: escribe un nombre nuevo y elige si deseas guardar solo '+editorLabel(activeEditor())+' o el proyecto completo.';
      saveAsBtn.style.display='none';
    };
    global.SimuPLCSaveChoice={open:openSave,close:closeSave,saveSingle:function(){return saveScope('single');},saveGlobal:function(){return saveScope('complete');},saveAs:function(){if(saveAsBtn)saveAsBtn.click();}};
  }
  function openSave(){
    if(!modal)setupSaveModal();if(!modal)return;
    forceSaveAs=false;var mode=activeEditor(),cur=getItem(getCurrentId());
    if(nameInput){nameInput.value=cur?cur.name:('Proyecto '+editorLabel(mode));nameInput.readOnly=!!cur;}
    if(saveSingleBtn)saveSingleBtn.textContent='Guardar solo '+editorLabel(mode);
    if(saveCompleteBtn)saveCompleteBtn.textContent=cur?'Actualizar proyecto completo':'Guardar proyecto completo';
    if(saveAsBtn)saveAsBtn.style.display=cur?'':'none';
    var info=document.getElementById('simuplcSaveCurrentInfo');if(info)info.textContent=cur?('Editando “'+cur.name+'”. Guardar actualizará este mismo proyecto; no se creará un duplicado.'):'Proyecto nuevo. Si ya existe un proyecto con el mismo nombre, se actualizará ese proyecto.';
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
    if(nameInput&&!cur)setTimeout(function(){nameInput.focus();nameInput.select();},30);
  }
  function closeSave(){if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');}forceSaveAs=false;}

  function setupLibrary(){
    var old=document.getElementById('circuitsList');if(old&&old.parentNode){var n=old.cloneNode(false);n.id='circuitsList';n.className=old.className;old.parentNode.replaceChild(n,old);listEl=n;}else listEl=old;
    var m=document.getElementById('circuitsModal');if(m){var h=m.querySelector('.circuits-header h3');if(h)h.textContent='Mis proyectos';var p=m.querySelector('.circuits-subtitle');if(p)p.innerHTML='Abre un proyecto para seguir editando. <b>Guardar</b> actualizará ese mismo proyecto.';var e=document.getElementById('circuitsEmpty');if(e)e.textContent='Aún no tienes proyectos guardados.';}
    var topBtn=document.getElementById('btnCircuitsList');if(topBtn){topBtn.title='Mis proyectos';topBtn.setAttribute('aria-label','Mis proyectos');}
    var close=document.getElementById('circuitsClose');if(close)close.onclick=closeLibrary;
    if(listEl)listEl.addEventListener('click',function(ev){
      var b=ev.target&&ev.target.closest&&ev.target.closest('button[data-action]');if(!b)return;
      ev.preventDefault();ev.stopPropagation();
      var id=b.getAttribute('data-id'),action=b.getAttribute('data-action');
      if(action==='open')openProject(id).catch(function(e){alert('No se pudo abrir: '+(e.message||e));});
      else if(action==='rename')renameProject(id);
      else if(action==='delete')deleteProject(id);
    });
    global.refreshCircuitList=refreshLibrary;
    global.openCircuitsModal=openLibrary;
    refreshLibrary();
  }
  function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function refreshLibrary(){
    if(!listEl)listEl=document.getElementById('circuitsList');if(!listEl)return;
    var empty=document.getElementById('circuitsEmpty'),cur=getCurrentId();var arr=list().slice().sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});listEl.innerHTML='';
    if(!arr.length){if(empty)empty.style.display='block';return;}if(empty)empty.style.display='none';
    arr.forEach(function(item){
      var li=document.createElement('li');li.className='circuit-row'+(item.id===cur?' is-current':'');
      var e=projectEditors(item),badges=[];['fbd','ladder','control','hmi'].forEach(function(k){if(e[k])badges.push('<span class="project-badge">'+editorLabel(k)+'</span>');});
      if(editorCount(item)>1)badges.unshift('<span class="project-badge complete">PROYECTO COMPLETO</span>');if(item.id===cur)badges.unshift('<span class="project-badge current">EDITANDO</span>');
      var date=new Date(item.updatedAt||item.createdAt||Date.now()).toLocaleString();
      li.innerHTML='<div class="title">'+escapeHtml(item.name||'Proyecto sin nombre')+'</div><div class="project-badges">'+badges.join('')+'</div><div class="meta">'+escapeHtml(date)+'</div><div class="actions"><button data-id="'+escapeHtml(item.id)+'" data-action="open">Abrir</button><button data-id="'+escapeHtml(item.id)+'" data-action="rename">Renombrar</button><button data-id="'+escapeHtml(item.id)+'" data-action="delete">Eliminar</button></div>';
      listEl.appendChild(li);
    });
  }
  function openLibrary(){if(!modal)setupSaveModal();var m=document.getElementById('circuitsModal');if(m){refreshLibrary();m.style.display='flex';}}
  function closeLibrary(){var m=document.getElementById('circuitsModal');if(m)m.style.display='none';}
  function renameProject(id){
    var arr=list(),i=arr.findIndex(function(x){return x&&x.id===id;});if(i<0)return;
    var n=prompt('Nuevo nombre para el proyecto:',arr[i].name||'');if(n===null)return;n=safeName(n);if(!n)return;
    var duplicate=arr.find(function(x){return x&&x.id!==id&&nameKey(x.name)===nameKey(n);});
    if(duplicate){alert('Ya existe un proyecto con ese nombre. Usa otro nombre o abre ese proyecto para actualizarlo.');return;}
    arr[i].name=n;arr[i].updatedAt=now();if(arr[i].simuplcProject)arr[i].simuplcProject.name=n;writeRaw(arr);refreshLibrary();toast('Proyecto renombrado');
  }
  function deleteProject(id){
    var item=getItem(id);if(!item)return;if(!confirm('¿Eliminar el proyecto “'+item.name+'”? Esta acción no se puede deshacer.'))return;
    writeRaw(list().filter(function(x){return x&&x.id!==id;}));if(getCurrentId()===id)sessionSet(null);refreshLibrary();toast('Proyecto eliminado');
  }

  function bindMainNewButton(){
    /* V24: un solo dueño para NUEVO. Clonar elimina manejadores antiguos que competían
       y hacían aparecer solo Nuevo FBD/Ladder o ejecutaban limpiezas parciales. */
    var old=document.getElementById('btnNew');
    if(!old||!old.parentNode)return;
    var btn=old.cloneNode(true);
    old.parentNode.replaceChild(btn,old);
    btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();openNew(activeEditor());},true);
  }

  function bindNewAndImport(){
    /* NEW se gestiona mediante el modal V22. Importar sí libera el proyecto actual. */
    ['btnImportUnified','btnLoad'].forEach(function(id){
      var b=document.getElementById(id);if(!b)return;
      ['pointerdown','mousedown','touchstart'].forEach(function(type){b.addEventListener(type,function(){clearCurrent();},{capture:true,passive:true});});
      b.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')clearCurrent();},true);
    });
  }
  function onChildMessage(ev){
    var d=ev.data||{};
    if(d.type==='SIMUPLC_PROJECT_UI'){
      if(d.action==='save')openSave();
      else if(d.action==='library')openLibrary();
      else if(d.action==='new')openNew(d.editor);
      else if(d.action==='import')clearCurrent();
      return;
    }
    if(d.type==='SIMUPLC_EDITOR_READY'&&d.editor==='hmi'){hmiReady=true;setTimeout(tryApplyPendingHmi,80);}
  }

  function init(){
    migrateLibrary();sessionSet(sessionGet());setupSaveModal();setupLibrary();bindMainNewButton();bindNewAndImport();global.addEventListener('message',onChildMessage,false);
    global.SimuPLCUnifiedProjects={version:'22.0',list:list,get:getItem,open:openProject,openLibrary:openLibrary,openSave:openSave,openNew:openNew,saveEditor:function(){return saveScope('single');},saveComplete:function(){return saveScope('complete');},rename:renameProject,delete:deleteProject,clearCurrent:clearCurrent,getCurrentId:getCurrentId,refresh:refreshLibrary};
    try{var b=document.getElementById('btnSave');if(b){b.title='Guardar / actualizar proyecto';b.setAttribute('aria-label','Guardar o actualizar proyecto');}}catch(_){ }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,0);
})(window);
