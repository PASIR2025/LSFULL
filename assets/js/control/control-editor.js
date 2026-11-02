(function(){
  const SYMBOL_BASE = './assets/control-symbols/';
  const PARTS = [
    {group:'ALIMENTACIÓN', type:'source', name:'Línea / +24V', label:'L1', tag:'L1', className:'source', img:'LINEA Y NEUTRO.svg', w:80,h:120, terms:[{id:'t0',x:40,y:18,label:'L'}]},
    {group:'ALIMENTACIÓN', type:'return', name:'Neutro / 0V', label:'N', tag:'N', className:'return', img:'LINEA Y NEUTRO.svg', w:80,h:120, terms:[{id:'t0',x:40,y:102,label:'N'}]},
    {group:'MANDO', type:'pb_no', name:'Pulsador NO', label:'Pulsador NO', tag:'S1', className:'contact', img:'PULSADOR NO.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'MANDO', type:'pb_nc', name:'Pulsador NC', label:'Pulsador NC', tag:'S2', className:'contact', img:'PULSADOR NC.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'MANDO', type:'estop_nc', name:'Parada de emergencia NC', label:'Paro emergencia', tag:'S0', className:'contact', img:'PARADA DE EMERGENCIA NC.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'MANDO', type:'estop_no', name:'Parada de emergencia NO', label:'Paro emergencia', tag:'S0', className:'contact', img:'PARADA DE EMERGENCIA NO.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'MANDO', type:'selector_no', name:'Selector NO', label:'Selector NO', tag:'S3', className:'contact', img:'SELECTOR NO.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'MANDO', type:'selector_nc', name:'Selector NC', label:'Selector NC', tag:'S4', className:'contact', img:'SELECTOR NC.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'MANDO', type:'final_no', name:'Final de carrera NO', label:'FC NO', tag:'SQ1', className:'contact', img:'FINAL DE CARRERA NO.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'MANDO', type:'final_nc', name:'Final de carrera NC', label:'FC NC', tag:'SQ2', className:'contact', img:'FINAL DE CARRERA NC.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'1'},{id:'t1',x:58,y:108,label:'2'}]},
    {group:'AUXILIARES', type:'aux_no', name:'Contacto auxiliar NO', label:'Aux NO', tag:'KM1', className:'contact', img:'CONTACTO AUXILIAR NO.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'13'},{id:'t1',x:58,y:108,label:'14'}]},
    {group:'AUXILIARES', type:'aux_nc', name:'Contacto auxiliar NC', label:'Aux NC', tag:'KM1', className:'contact', img:'CONTACTO AUXILIAR NC.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'21'},{id:'t1',x:58,y:108,label:'22'}]},
    {group:'AUXILIARES', type:'overload_no', name:'Térmico auxiliar NO', label:'Térmico NO', tag:'FR1', className:'contact', img:'CONTACTOR AUXILIAR RELE TERMICO NO.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'97'},{id:'t1',x:58,y:108,label:'98'}]},
    {group:'AUXILIARES', type:'overload_nc', name:'Térmico auxiliar NC', label:'Térmico NC', tag:'FR1', className:'contact', img:'CONTACTOR AUXILIAR RELE TERMICO NC.svg', w:116,h:120, stateful:true, terms:[{id:'t0',x:58,y:12,label:'95'},{id:'t1',x:58,y:108,label:'96'}]},
    {group:'RECEPTORES', type:'coil', name:'Bobina', label:'Bobina', tag:'KM1', className:'coil', img:'BOBINA.svg', w:96,h:118, stateful:true, terms:[{id:'t0',x:48,y:12,label:'A1'},{id:'t1',x:48,y:106,label:'A2'}]},
    {group:'RECEPTORES', type:'pilot', name:'Piloto', label:'Piloto', tag:'H1', className:'pilot', img:'PILOTO NORMAL.svg', w:96,h:118, stateful:true, terms:[{id:'t0',x:48,y:12,label:'X1'},{id:'t1',x:48,y:106,label:'X2'}]},
    {group:'AUTOMATIZACIÓN', type:'plc', name:'PLC del proyecto', label:'PLC del proyecto', tag:'PLC', className:'plc', img:'', w:720,h:250, special:'plc'}
  ];

  const state = {
    elements: [],
    wires: [],
    selectedId: null,
    selectedWireId: null,
    pendingTerminal: null,
    zoom: 1,
    running: false,
    uid: 1
  };

  const dom = {};

  function el(tag, attrs, ...children){
    const n = document.createElement(tag);
    if(attrs) Object.keys(attrs).forEach(k=>{
      if(k==='class') n.className = attrs[k];
      else if(k==='html') n.innerHTML = attrs[k];
      else if(k==='text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    children.flat().forEach(c=>{ if(c==null) return; if(typeof c==='string') n.appendChild(document.createTextNode(c)); else n.appendChild(c); });
    return n;
  }
  function q(id){ return document.getElementById(id); }
  function uid(prefix='c'){ return prefix + (state.uid++); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function showToast(msg){ const t=dom.toast; t.textContent=msg; t.style.opacity='1'; clearTimeout(showToast._tm); showToast._tm=setTimeout(()=>t.style.opacity='0',1400); }
  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function partByType(type){ return PARTS.find(p=>p.type===type); }

  function getProfileInfo(){
    try{
      const api = window.SimuPLCPLCProfile;
      if(api && api.getMeta){
        const meta = api.getMeta() || {};
        return {name: meta.name || meta.label || 'PLC', desc: meta.description || 'Perfil activo'};
      }
      if(api && api.getId) return {name: api.getId() || 'PLC', desc: 'Perfil activo'};
    }catch(_){ }
    return {name:'PLC', desc:'Perfil activo'};
  }

  function syncProfile(){
    const p = getProfileInfo();
    q('profileName').textContent = p.name;
    q('profileAddress').textContent = p.desc;
    q('profileBadge').textContent = p.name;
  }

  function buildLibrary(){
    const root = q('libraryScroll');
    root.innerHTML = '';
    let current = '';
    PARTS.forEach(part=>{
      if(part.group !== current){
        current = part.group;
        root.appendChild(el('div',{class:'lib-group',text:current}));
      }
      const btn = el('button',{class:'part-btn','data-part':part.type},
        el('span',{class:'ico'}, part.img ? el('img',{src: SYMBOL_BASE + part.img, alt: part.name}) : el('span',{text:'PLC'})),
        el('span',{text:part.name})
      );
      btn.addEventListener('click', ()=> addPart(part.type));
      root.appendChild(btn);
    });
  }

  function defaultProject(){
    return {type:'simuplc-control-v1', version:1, profileId:(window.SimuPLCPLCProfile&&window.SimuPLCPLCProfile.getId?window.SimuPLCPLCProfile.getId():'classic'), elements:[], wires:[]};
  }

  function applyRotationToPoint(x,y,w,h,rotation){
    const cx=w/2, cy=h/2;
    const dx=x-cx, dy=y-cy;
    const r=((rotation||0)%360+360)%360;
    if(r===90) return {x:cx-dy,y:cy+dx};
    if(r===180) return {x:cx-dx,y:cy-dy};
    if(r===270) return {x:cx+dy,y:cy-dx};
    return {x,y};
  }

  function terminalAbs(element, termId){
    const part = partByType(element.type);
    if(!part) return {x:element.x,y:element.y};
    if(part.special==='plc'){
      const terms = buildPlcTerms();
      const term = terms.find(t=>t.id===termId) || terms[0];
      return {x: element.x + term.x, y: element.y + term.y};
    }
    const term = (part.terms||[]).find(t=>t.id===termId) || (part.terms||[])[0];
    const p = applyRotationToPoint(term.x, term.y, element.w, element.h, element.rotation||0);
    return {x: element.x + p.x, y: element.y + p.y};
  }

  function buildPlcTerms(){
    const terms=[];
    const inputX=[50,115,180,245,310,375,440,505];
    inputX.forEach((x,i)=> terms.push({id:'I'+i,x:x,y:18,label:'I'+i,className:'plc-term'}));
    const outputX=[160,280,400,520];
    outputX.forEach((x,i)=>{
      terms.push({id:'Q'+(i+1)+'a',x:x-12,y:222,label:'1',className:'plc-term'});
      terms.push({id:'Q'+(i+1)+'b',x:x+12,y:222,label:'2',className:'plc-term'});
    });
    return terms;
  }

  function addPart(type){
    const part = partByType(type); if(!part) return;
    const item = {id:uid('e'), type:part.type, label:part.label, tag:part.tag||'', x:120+state.elements.length*28, y:120+state.elements.length*18, w:part.w, h:part.h, rotation:0, visualState:0};
    if(part.special==='plc'){ item.x=360; item.y=180; }
    state.elements.push(item);
    state.selectedId = item.id;
    state.selectedWireId = null;
    render();
    openProperties(item);
    showToast(part.name + ' agregado');
  }

  function removeSelected(){
    if(state.selectedWireId){
      state.wires = state.wires.filter(w=>w.id!==state.selectedWireId);
      state.selectedWireId=null; render(); showToast('Cable eliminado'); return;
    }
    if(!state.selectedId) return;
    const id=state.selectedId;
    state.elements = state.elements.filter(e=>e.id!==id);
    state.wires = state.wires.filter(w=>w.from.elementId!==id && w.to.elementId!==id);
    state.selectedId=null; closeProperties(); render(); showToast('Elemento eliminado');
  }

  function duplicateSelected(){
    const src = state.elements.find(e=>e.id===state.selectedId); if(!src) return;
    const copy = clone(src); copy.id=uid('e'); copy.x+=24; copy.y+=24;
    state.elements.push(copy); state.selectedId=copy.id; render(); openProperties(copy); showToast('Elemento duplicado');
  }

  function rotateSelected(){
    const item = state.elements.find(e=>e.id===state.selectedId); if(!item || item.type==='plc') return;
    item.rotation = ((item.rotation||0)+90)%360; render(); openProperties(item); showToast('Elemento rotado');
  }

  function clearAll(){
    state.elements=[]; state.wires=[]; state.selectedId=null; state.selectedWireId=null; state.pendingTerminal=null; closeProperties(); render(); showToast('Editor limpiado');
  }

  function render(){
    renderElements();
    renderWires();
    q('zoomBadge').textContent = Math.round(state.zoom*100)+'%';
    q('simBadge').textContent = state.running ? 'SIMULACIÓN VISUAL' : 'DETENIDO';
    q('runBtn').classList.toggle('active', !!state.running);
  }

  function renderElements(){
    const ws = dom.workspace;
    ws.querySelectorAll('.device').forEach(n=>n.remove());
    state.elements.forEach(item=>{
      const part = partByType(item.type); if(!part) return;
      const node = el('div',{class:'device '+(part.className||'')+(state.selectedId===item.id?' selected':'')+(item.visualState?' sim-active':''), 'data-id':item.id});
      node.style.left=item.x+'px'; node.style.top=item.y+'px'; node.style.width=item.w+'px'; node.style.height=item.h+'px';
      node.appendChild(el('div',{class:'device-label',text:item.label||part.label||''}));
      if(item.tag) node.appendChild(el('div',{class:'device-tag',text:item.tag}));
      if(part.special==='plc') buildPlc(node,item);
      else {
        const box = el('div',{class:'svg-box'});
        const img = el('img',{src:SYMBOL_BASE+part.img,alt:part.name});
        img.style.transform='rotate('+(item.rotation||0)+'deg)';
        box.appendChild(img);
        node.appendChild(box);
        (part.terms||[]).forEach(term=> node.appendChild(buildTerm(item, term)));
      }
      node.addEventListener('pointerdown', startDrag);
      node.addEventListener('click', function(ev){ if(ev.target.classList.contains('term')) return; state.selectedId=item.id; state.selectedWireId=null; render(); openProperties(item); });
      if(part.stateful){ node.addEventListener('dblclick', function(){ item.visualState = item.visualState ? 0 : 1; render(); openProperties(item); }); }
      ws.appendChild(node);
    });
  }

  function buildPlc(node,item){
    const face = el('div',{class:'plc-face'});
    face.appendChild(el('div',{class:'plc-strip-label inputs',text:'ENTRADAS'}));
    face.appendChild(el('div',{class:'plc-strip-label outputs',text:'SALIDAS RELÉ'}));
    face.appendChild(el('div',{class:'plc-brand',html:'<strong>SimuPLC PLC</strong><span>Perfil global del proyecto</span>'}));
    const inputX=[50,115,180,245,310,375,440,505];
    inputX.forEach((x,i)=> face.appendChild(Object.assign(el('div',{class:'plc-input-label',text:'I'+i}),{style:`left:${x}px`})));
    const outputX=[160,280,400,520];
    outputX.forEach((x,i)=>{
      const g=el('div',{class:'plc-output-group'}); g.style.left=x+'px';
      g.appendChild(el('div',{class:'qtag',text:'Q'+(i+1)}));
      g.appendChild(el('div',{class:'n1',text:'1'})); g.appendChild(el('div',{class:'n2',text:'2'}));
      g.appendChild(el('svg',{class:'plc-relay-svg',viewBox:'0 0 54 32',html:'<path d="M7 16h12"/><path d="M35 16h12"/><path d="M19 24V8"/><path d="M35 24V8"/><path class="blade" d="M20 22 L34 11"/>'}));
      face.appendChild(g);
    });
    node.appendChild(face);
    buildPlcTerms().forEach(term=> node.appendChild(buildTerm(item,term,true)));
  }

  function buildTerm(item, term, isPlc){
    const p = item.type==='plc' ? {x:term.x,y:term.y} : applyRotationToPoint(term.x, term.y, item.w, item.h, item.rotation||0);
    const t = el('div',{class:'term'+(isPlc?' plc-term':''), 'data-element-id':item.id, 'data-term-id':term.id});
    t.style.left=p.x+'px'; t.style.top=p.y+'px';
    const mini = el('span',{class:'mini',text:term.label||''});
    mini.style.left=(p.x < item.w/2 ? '-4px':'14px');
    mini.style.top='-4px';
    t.appendChild(mini);
    t.addEventListener('click', onTermClick);
    if(state.pendingTerminal && state.pendingTerminal.elementId===item.id && state.pendingTerminal.termId===term.id){ t.classList.add('pending'); }
    return t;
  }

  function renderWires(){
    const svg = dom.wires; svg.innerHTML='';
    state.wires.forEach(w=>{
      const a=state.elements.find(e=>e.id===w.from.elementId), b=state.elements.find(e=>e.id===w.to.elementId); if(!a||!b) return;
      const p1=terminalAbs(a,w.from.termId), p2=terminalAbs(b,w.to.termId);
      const path = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      svg.insertAdjacentHTML('beforeend', `<path class="wire${state.selectedWireId===w.id?' selected':''}" d="${path}" data-id="${w.id}"></path><path class="wire-hit" d="${path}" data-id="${w.id}"></path>`);
    });
    svg.querySelectorAll('.wire-hit').forEach(hit=> hit.addEventListener('click', function(ev){ state.selectedWireId=this.dataset.id; state.selectedId=null; closeProperties(); render(); ev.stopPropagation(); }));
  }

  function onTermClick(ev){
    ev.stopPropagation();
    const term = {elementId:this.dataset.elementId, termId:this.dataset.termId};
    if(!state.pendingTerminal){ state.pendingTerminal=term; render(); return; }
    if(state.pendingTerminal.elementId===term.elementId && state.pendingTerminal.termId===term.termId){ state.pendingTerminal=null; render(); return; }
    const exists = state.wires.find(w=> (w.from.elementId===state.pendingTerminal.elementId && w.from.termId===state.pendingTerminal.termId && w.to.elementId===term.elementId && w.to.termId===term.termId) || (w.to.elementId===state.pendingTerminal.elementId && w.to.termId===state.pendingTerminal.termId && w.from.elementId===term.elementId && w.from.termId===term.termId));
    if(!exists) state.wires.push({id:uid('w'), from:clone(state.pendingTerminal), to:term});
    state.pendingTerminal=null; render(); showToast('Cable creado');
  }

  function startDrag(ev){
    if(ev.target.classList.contains('term')) return;
    const node = ev.currentTarget; const id=node.dataset.id; const item=state.elements.find(e=>e.id===id); if(!item) return;
    state.selectedId=id; state.selectedWireId=null; openProperties(item); render();
    const startX=ev.clientX, startY=ev.clientY, ox=item.x, oy=item.y;
    function move(e){ item.x=Math.round(ox+(e.clientX-startX)/state.zoom); item.y=Math.round(oy+(e.clientY-startY)/state.zoom); node.style.left=item.x+'px'; node.style.top=item.y+'px'; renderWires(); }
    function up(){ window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); render(); }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function openProperties(item){
    if(!item){ closeProperties(); return; }
    const part = partByType(item.type) || {};
    dom.properties.classList.add('open');
    q('propLabel').value=item.label||''; q('propTag').value=item.tag||''; q('propState').value=String(item.visualState?1:0);
    q('propHelp').textContent = part.name ? (part.name + (part.type==='plc' ? '. Bloque especial con bornes de entradas y salidas.' : '. Doble clic en simulación visual para alternar su estado gráfico.')) : '';
    q('propStateWrap').style.display = part.stateful ? 'block' : 'none';
    q('propTagWrap').style.display = part.special==='plc' ? 'none' : 'block';
  }
  function closeProperties(){ dom.properties.classList.remove('open'); }
  function applyProperties(){
    const item = state.elements.find(e=>e.id===state.selectedId); if(!item) return;
    item.label = q('propLabel').value.trim() || item.label;
    item.tag = q('propTag').value.trim();
    item.visualState = Number(q('propState').value||0) ? 1 : 0;
    render(); openProperties(item); showToast('Propiedades actualizadas');
  }

  function setZoom(z){ state.zoom=clamp(z,0.35,2.4); q('workspace').style.transform='scale(' + state.zoom + ')'; }
  function fitToView(){
    const vp = dom.viewport.getBoundingClientRect();
    const scale = Math.min(vp.width/3600, vp.height/2400, 1);
    setZoom(clamp(scale,0.35,1));
    dom.viewport.scrollLeft=0; dom.viewport.scrollTop=0;
  }

  function getProject(){
    return {type:'simuplc-control-v1',version:1,profileId:(window.SimuPLCPLCProfile&&window.SimuPLCPLCProfile.getId?window.SimuPLCPLCProfile.getId():'classic'),elements:clone(state.elements),wires:clone(state.wires)};
  }
  function setProject(project){
    const p = project && project.type==='simuplc-control-v1' ? project : defaultProject();
    state.elements = clone(p.elements||[]);
    state.wires = clone(p.wires||[]);
    state.selectedId=null; state.selectedWireId=null; state.pendingTerminal=null;
    const maxE = state.elements.reduce((m,e)=> Math.max(m, Number(String(e.id||'').replace(/\D/g,''))||0), 0);
    const maxW = state.wires.reduce((m,w)=> Math.max(m, Number(String(w.id||'').replace(/\D/g,''))||0), 0);
    state.uid = Math.max(maxE, maxW, 0) + 1;
    closeProperties(); render(); return true;
  }

  function initMessaging(){
    window.addEventListener('message', async function(ev){
      const msg = ev.data || {};
      if(!msg || !msg.__simuplcControlHost) return;
      const reply = (data)=>{ try{ ev.source && ev.source.postMessage(Object.assign({__simuplcControlHost:true, requestId:msg.requestId}, data), '*'); }catch(_){ } };
      if(msg.cmd==='getProject') reply({ok:true, data:getProject()});
      else if(msg.cmd==='setProject') reply({ok:!!setProject(msg.data)});
      else if(msg.cmd==='focus') { showToast('Editor CONTROL activo'); reply({ok:true}); }
      else if(msg.cmd==='clear') { clearAll(); reply({ok:true}); }
      else if(msg.cmd==='ping') reply({ok:true, ready:true});
    });
  }

  function bindEvents(){
    dom.workspace.addEventListener('click', function(){ state.selectedId=null; state.selectedWireId=null; render(); closeProperties(); });
    q('libraryBtn').addEventListener('click', ()=> document.body.classList.toggle('library-open'));
    q('fitBtn').addEventListener('click', fitToView); q('clearBtn').addEventListener('click', clearAll);
    q('duplicateBtn').addEventListener('click', duplicateSelected); q('rotateBtn').addEventListener('click', rotateSelected); q('deleteBtn').addEventListener('click', removeSelected);
    q('propDelete').addEventListener('click', removeSelected); q('propApply').addEventListener('click', applyProperties);
    q('zoomInBtn').addEventListener('click', ()=>{ setZoom(state.zoom+0.1); render(); }); q('zoomOutBtn').addEventListener('click', ()=>{ setZoom(state.zoom-0.1); render(); }); q('zoomBadge').addEventListener('click', fitToView);
    q('runBtn').addEventListener('click', ()=>{ state.running=true; render(); }); q('stopBtn').addEventListener('click', ()=>{ state.running=false; render(); });
    document.addEventListener('keydown', function(ev){ if(ev.key==='Delete' || ev.key==='Backspace'){ if(document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName)) return; removeSelected(); } });
  }

  function init(){
    Object.assign(dom,{workspace:q('workspace'),wires:q('wires'),viewport:q('viewport'),properties:q('properties'),toast:q('toast')});
    syncProfile(); buildLibrary(); bindEvents(); initMessaging(); setZoom(1); render();
    setProject(defaultProject());
    window.SimuPLCControlEditor = { getProject, setProject, clearAll, focus:function(){ showToast('CONTROL listo'); }, getState:()=>clone(state) };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
