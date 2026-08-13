(function(global){
  'use strict';
  if(global.SimuPLCFbdDocumentation) return;

  const diagnostics={renders:0,freeTextCreates:0,associatedSaves:0,loads:0,serializations:0,migrations:0};
  const defaults={
    format:'comment',fontFamily:'Arial',fontSize:14,maxWidth:230,bold:true,italic:false,
    color:'#263548',background:'#f8fafc',offsetX:0,offsetY:-8
  };
  let freeTexts=[];
  let selectedTextId=null;
  let selectedDescriptionNode=null;
  let pendingPoint=null;
  let nextTextId=1;
  let editDraftNode=null;

  function adapter(){ return global.SimuPLCFBDAdapter || null; }
  function nodes(){
    try{ return adapter() && adapter().getNodes ? adapter().getNodes() : (Array.isArray(global.nodes) ? global.nodes : []); }
    catch(_){ return []; }
  }
  function workspace(){ return document.getElementById('workspace'); }
  function canvas(){ return document.getElementById('canvas'); }
  function scale(){
    try{ return adapter() && adapter().getScale ? Number(adapter().getScale()) || 1 : (Number(global.scale)||1); }
    catch(_){ return 1; }
  }
  function activeFBD(){ return !(document.body && document.body.classList.contains('mode-ladder')); }
  function cleanText(value,max){ return String(value == null ? '' : value).trim().slice(0,max || 1000); }
  function clone(value){ try{return JSON.parse(JSON.stringify(value));}catch(_){return value;} }
  function number(value,fallback){ value=Number(value); return Number.isFinite(value)?value:fallback; }
  function currentNode(){
    if(selectedDescriptionNode) return selectedDescriptionNode;
    try{
      const a=adapter();
      const node=a && a.getSelectedNode ? a.getSelectedNode() : global.selectedNode;
      if(node && node.el) return node;
    }catch(_){ }
    return editDraftNode;
  }
  function nodeByElement(el){ return nodes().find(function(node){return node && node.el===el;}) || null; }
  function nodeById(id,index){
    const list=nodes();
    return list.find(function(node){return node && String(node.id)===String(id);}) || list[index] || null;
  }
  function markChanged(label){
    try{ if(typeof global.pushHistory==='function') global.pushHistory(label || 'documentación FBD'); }
    catch(_){ }
    try{ document.dispatchEvent(new CustomEvent('simuplc:fbd-documentation-change',{detail:{label:label||''}})); }
    catch(_){ }
  }

  function ensureDefaults(node){
    if(!node) return node;
    const legacy=cleanText(node.description || node.reference || (node.el && node.el.dataset && (node.el.dataset.reference || node.el.dataset.ioLabel)) || '',300);
    if(!node.description && legacy){ node.description=legacy; diagnostics.migrations++; }
    node.description=cleanText(node.description,300);
    node.reference=node.description;
    node.descriptionOffsetX=number(node.descriptionOffsetX,defaults.offsetX);
    node.descriptionOffsetY=number(node.descriptionOffsetY,defaults.offsetY);
    node.descriptionFormat=node.descriptionFormat || defaults.format;
    node.descriptionFontFamily=node.descriptionFontFamily || defaults.fontFamily;
    node.descriptionFontSize=number(node.descriptionFontSize,defaults.fontSize);
    node.descriptionMaxWidth=number(node.descriptionMaxWidth,defaults.maxWidth);
    node.descriptionBold=typeof node.descriptionBold==='boolean' ? node.descriptionBold : defaults.bold;
    node.descriptionItalic=!!node.descriptionItalic;
    node.descriptionColor=node.descriptionColor || defaults.color;
    node.descriptionBackground=node.descriptionBackground || defaults.background;
    if(node.el && node.el.dataset){
      if(node.description){
        node.el.dataset.reference=node.description;
        node.el.dataset.ioLabel=node.description;
      }else{
        delete node.el.dataset.reference;
        delete node.el.dataset.ioLabel;
      }
    }
    return node;
  }

  function applyAssociatedStyle(node,element){
    ensureDefaults(node);
    element.style.left='calc(50% + '+node.descriptionOffsetX+'px)';
    element.style.top=node.descriptionOffsetY+'px';
    element.style.transform='translate(-50%,-100%)';
    element.style.fontFamily=node.descriptionFontFamily;
    element.style.fontSize=node.descriptionFontSize+'px';
    element.style.maxWidth=node.descriptionMaxWidth+'px';
    element.style.fontWeight=(node.descriptionBold || node.descriptionFormat==='title')?'800':'500';
    element.style.fontStyle=node.descriptionItalic?'italic':'normal';
    element.style.color=node.descriptionColor;
    element.style.background=node.descriptionBackground;
    element.classList.remove('format-comment','format-title','format-free');
    element.classList.add('format-'+node.descriptionFormat);
  }

  function renderAssociated(element,node){
    if(!element) return;
    node=node || nodeByElement(element);
    if(!node) return;
    ensureDefaults(node);
    element.querySelectorAll('.element-reference-badge,.io-badge').forEach(function(old){old.remove();});
    element.classList.remove('has-reference-badge','has-io-badge');
    let description=element.querySelector('.node-associated-description');
    if(!node.description){ if(description) description.remove(); return; }
    if(!description){
      description=document.createElement('div');
      description.className='node-associated-description';
      element.appendChild(description);
      bindAssociatedEvents(description,node);
    }
    description.textContent=node.description;
    description.title=node.description;
    description.classList.toggle('selected-description',selectedDescriptionNode===node);
    applyAssociatedStyle(node,description);
    diagnostics.renders++;
  }
  function refreshAssociated(){ nodes().forEach(function(node){ if(node && node.el) renderAssociated(node.el,node); }); }

  function clearAssociatedSelection(){
    selectedDescriptionNode=null;
    document.querySelectorAll('.node-associated-description.selected-description').forEach(function(el){el.classList.remove('selected-description');});
  }
  function selectAssociated(node){
    clearAssociatedSelection();
    selectedTextId=null;
    updateFreeSelection();
    selectedDescriptionNode=node;
    try{ if(adapter() && adapter().setSelectedNode) adapter().setSelectedNode(node); global.selectedNode=node; }catch(_){ }
    if(node && node.el) renderAssociated(node.el,node);
  }
  function removeAssociated(){
    const node=selectedDescriptionNode || currentNode();
    if(!node) return false;
    node.description=''; node.reference='';
    ensureDefaults(node);
    if(node.el) renderAssociated(node.el,node);
    clearAssociatedSelection();
    markChanged('eliminar texto asociado FBD');
    return true;
  }

  function bindAssociatedEvents(element,node){
    if(element.__simuplcDocBound) return;
    element.__simuplcDocBound=true;
    ['mousedown','touchstart'].forEach(function(type){
      element.addEventListener(type,function(event){event.stopPropagation();},{passive:type==='touchstart'?false:undefined});
    });
    element.addEventListener('click',function(event){ event.preventDefault(); event.stopPropagation(); selectAssociated(node); });
    element.addEventListener('dblclick',function(event){
      event.preventDefault(); event.stopPropagation();
      selectAssociated(node);
      const edit=document.getElementById('btnEdit'); if(edit) edit.click();
    });
    element.addEventListener('pointerdown',function(event){
      if(event.button!==undefined && event.button!==0) return;
      event.preventDefault(); event.stopPropagation();
      if(event.stopImmediatePropagation) event.stopImmediatePropagation();
      selectAssociated(node); ensureDefaults(node);
      const startX=event.clientX,startY=event.clientY;
      const originX=node.descriptionOffsetX,originY=node.descriptionOffsetY;
      let moved=false;
      try{ element.setPointerCapture(event.pointerId); }catch(_){ }
      function move(ev){
        node.descriptionOffsetX=originX+(ev.clientX-startX)/scale();
        node.descriptionOffsetY=originY+(ev.clientY-startY)/scale();
        applyAssociatedStyle(node,element); moved=true;
        ev.preventDefault(); ev.stopPropagation();
      }
      function finish(ev){
        element.removeEventListener('pointermove',move);
        element.removeEventListener('pointerup',finish);
        element.removeEventListener('pointercancel',finish);
        if(moved) markChanged('mover texto asociado FBD');
        ev.preventDefault(); ev.stopPropagation();
      }
      element.addEventListener('pointermove',move);
      element.addEventListener('pointerup',finish);
      element.addEventListener('pointercancel',finish);
    });
  }

  function normalizeFreeText(item,index){
    item=item && typeof item==='object' ? Object.assign({},item) : {};
    item.id=item.id || ('FT'+(index+1));
    item.text=cleanText(item.text || item.value || item.label || 'Texto de referencia',1000);
    item.x=number(item.x,120+index*20); item.y=number(item.y,100+index*20);
    item.format=item.format || defaults.format;
    item.fontFamily=item.fontFamily || defaults.fontFamily;
    item.fontSize=Math.max(10,Math.min(48,number(item.fontSize,18)));
    item.maxWidth=Math.max(160,Math.min(760,number(item.maxWidth,360)));
    item.bold=!!item.bold || item.format==='title'; item.italic=!!item.italic;
    item.color=item.color || defaults.color; item.background=item.background || defaults.background;
    return item;
  }
  function calculateVisiblePoint(){
    const host=canvas();
    const s=scale();
    let px=0,py=0;
    try{ px=typeof panX!=='undefined'?Number(panX)||0:Number(global.panX)||0; }catch(_){ px=Number(global.panX)||0; }
    try{ py=typeof panY!=='undefined'?Number(panY)||0:Number(global.panY)||0; }catch(_){ py=Number(global.panY)||0; }
    return {
      x:Math.max(20,((host?host.clientWidth:900)/2-px)/s-150),
      y:Math.max(20,((host?host.clientHeight:600)/2-py)/s-45)
    };
  }
  function updateFreeSelection(){
    const root=workspace(); if(!root) return;
    root.querySelectorAll('.fbd-free-text').forEach(function(el){el.classList.toggle('selected',el.dataset.id===selectedTextId);});
  }
  function renderFreeTexts(){
    const root=workspace(); if(!root) return;
    root.querySelectorAll('.fbd-free-text').forEach(function(el){el.remove();});
    freeTexts=freeTexts.map(normalizeFreeText);
    freeTexts.forEach(function(item){
      const div=document.createElement('div');
      div.className='fbd-free-text format-'+item.format+(item.id===selectedTextId?' selected':'');
      div.dataset.id=item.id; div.textContent=item.text; div.title='Doble clic para editar';
      div.style.left=item.x+'px'; div.style.top=item.y+'px';
      div.style.fontFamily=item.fontFamily; div.style.fontSize=item.fontSize+'px';
      div.style.maxWidth=item.maxWidth+'px'; div.style.fontWeight=(item.bold||item.format==='title')?'800':'500';
      div.style.fontStyle=item.italic?'italic':'normal'; div.style.color=item.color; div.style.background=item.background;
      root.appendChild(div);
      bindFreeEvents(div,item);
    });
  }
  function bindFreeEvents(element,item){
    ['mousedown','touchstart'].forEach(function(type){element.addEventListener(type,function(event){event.stopPropagation();},{passive:type==='touchstart'?false:undefined});});
    element.addEventListener('click',function(event){
      event.preventDefault(); event.stopPropagation(); selectedTextId=item.id; clearAssociatedSelection(); updateFreeSelection();
    });
    element.addEventListener('dblclick',function(event){
      event.preventDefault(); event.stopPropagation(); selectedTextId=item.id; updateFreeSelection(); openFreeModal(item);
    });
    element.addEventListener('pointerdown',function(event){
      if(event.button!==undefined && event.button!==0) return;
      event.preventDefault(); event.stopPropagation(); if(event.stopImmediatePropagation)event.stopImmediatePropagation();
      selectedTextId=item.id; clearAssociatedSelection(); updateFreeSelection();
      const startX=event.clientX,startY=event.clientY,originX=item.x,originY=item.y;
      let moved=false;
      function move(ev){
        item.x=originX+(ev.clientX-startX)/scale(); item.y=originY+(ev.clientY-startY)/scale();
        element.style.left=item.x+'px'; element.style.top=item.y+'px'; moved=true;
        ev.preventDefault();ev.stopPropagation();
      }
      function finish(ev){
        document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',finish,true);document.removeEventListener('pointercancel',finish,true);
        if(moved) markChanged('mover texto libre FBD');
        ev.preventDefault();ev.stopPropagation();
      }
      document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',finish,true);document.addEventListener('pointercancel',finish,true);
    });
  }

  function createModal(){
    if(document.getElementById('fbdTextModal')) return;
    const modal=document.createElement('div'); modal.id='fbdTextModal';
    modal.innerHTML='<div class="fbd-text-card" role="dialog" aria-modal="true">'
      +'<div class="fbd-text-head"><h3>Texto libre FBD</h3><button type="button" id="fbdTextClose">Cerrar</button></div>'
      +'<div class="fbd-text-body"><label>Texto o comentario<textarea id="fbdTextValue" maxlength="1000" placeholder="Escribe un título, comentario o explicación..."></textarea></label>'
      +'<div class="fbd-text-grid">'
      +'<label>Formato<select id="fbdTextFormat"><option value="comment">Comentario PLC</option><option value="title">Título de red</option><option value="free">Texto libre</option></select></label>'
      +'<label>Fuente<select id="fbdTextFont"><option>Arial</option><option>Verdana</option><option>Tahoma</option><option>Georgia</option><option>Courier New</option></select></label>'
      +'<label>Tamaño<select id="fbdTextSize"><option value="14">Pequeño</option><option value="18">Normal</option><option value="24">Grande</option><option value="30">Título</option><option value="38">Muy grande</option></select></label>'
      +'<label>Ancho máximo<select id="fbdTextWidth"><option value="240">Corto</option><option value="360">Normal</option><option value="520">Ancho</option><option value="700">Muy ancho</option></select></label>'
      +'<label class="wide">Color del texto'+global.SimuPLCTextPalette.markup('fbdTextColor','text',defaults.color)+'</label>'
      +'<label class="wide">Color de fondo'+global.SimuPLCTextPalette.markup('fbdTextBg','background',defaults.background)+'</label>'
      +'</div><div class="fbd-text-checks"><label><input id="fbdTextBold" type="checkbox"> Negrita</label><label><input id="fbdTextItalic" type="checkbox"> Cursiva</label></div>'
      +'<div class="fbd-text-help">Este texto es informativo y no interviene en la simulación. Puedes moverlo libremente.</div>'
      +'<div class="fbd-text-actions"><button type="button" id="fbdTextDelete">Eliminar</button><button type="button" id="fbdTextSave" class="primary">Guardar texto</button></div>'
      +'</div></div>';
    document.body.appendChild(modal);
    global.SimuPLCTextPalette.bind(modal);
    modal.addEventListener('click',function(event){if(event.target===modal)closeFreeModal();});
    document.getElementById('fbdTextClose').addEventListener('click',closeFreeModal);
    document.getElementById('fbdTextSave').addEventListener('click',saveFreeModal);
    document.getElementById('fbdTextDelete').addEventListener('click',deleteSelectedFree);
  }
  function openFreeModal(item){
    createModal();
    const current=item || (selectedTextId && freeTexts.find(function(t){return t.id===selectedTextId;}));
    document.getElementById('fbdTextValue').value=current?current.text:'';
    document.getElementById('fbdTextFormat').value=current?current.format:'comment';
    document.getElementById('fbdTextFont').value=current?current.fontFamily:'Arial';
    document.getElementById('fbdTextSize').value=String(current?current.fontSize:18);
    document.getElementById('fbdTextWidth').value=String(current?current.maxWidth:360);
    document.getElementById('fbdTextBold').checked=!!(current&&current.bold);
    document.getElementById('fbdTextItalic').checked=!!(current&&current.italic);
    global.SimuPLCTextPalette.set(document.getElementById('fbdTextModal'),'fbdTextColor',current?current.color:defaults.color);
    global.SimuPLCTextPalette.set(document.getElementById('fbdTextModal'),'fbdTextBg',current?current.background:defaults.background);
    document.getElementById('fbdTextDelete').style.display=current?'inline-flex':'none';
    document.getElementById('fbdTextModal').classList.add('show');
    setTimeout(function(){const input=document.getElementById('fbdTextValue');if(input){input.focus();if(!current)input.select();}},30);
  }
  function closeFreeModal(){ const modal=document.getElementById('fbdTextModal');if(modal)modal.classList.remove('show');pendingPoint=null; }
  function saveFreeModal(){
    const text=cleanText(document.getElementById('fbdTextValue').value,1000); if(!text) return;
    let item=selectedTextId && freeTexts.find(function(t){return t.id===selectedTextId;});
    if(!item){
      const point=pendingPoint || calculateVisiblePoint();
      item={id:'FT'+(nextTextId++),x:point.x,y:point.y}; freeTexts.push(item); selectedTextId=item.id; diagnostics.freeTextCreates++;
    }
    item.text=text; item.format=document.getElementById('fbdTextFormat').value || 'comment';
    item.fontFamily=document.getElementById('fbdTextFont').value || 'Arial';
    item.fontSize=Number(document.getElementById('fbdTextSize').value)||18;
    item.maxWidth=Number(document.getElementById('fbdTextWidth').value)||360;
    item.bold=!!document.getElementById('fbdTextBold').checked; item.italic=!!document.getElementById('fbdTextItalic').checked;
    item.color=document.getElementById('fbdTextColor').value || defaults.color; item.background=document.getElementById('fbdTextBg').value || defaults.background;
    renderFreeTexts(); closeFreeModal(); markChanged('texto libre FBD');
  }
  function deleteSelectedFree(){
    if(!selectedTextId) return false;
    freeTexts=freeTexts.filter(function(item){return item.id!==selectedTextId;}); selectedTextId=null;
    renderFreeTexts(); closeFreeModal(); markChanged('eliminar texto libre FBD'); return true;
  }
  function beginText(){
    if(!activeFBD()){
      const frame=document.getElementById('ladderFrame');
      try{
        if(frame && frame.contentWindow && frame.contentWindow.SimuPLCReferenceText){frame.contentWindow.SimuPLCReferenceText.add();return;}
      }catch(_){ }
      try{if(frame && frame.contentWindow)frame.contentWindow.postMessage({type:'SIMUPLC_ADD_FREE_REFERENCE_TEXT'},'*');}catch(_){ }
      return;
    }
    selectedTextId=null; clearAssociatedSelection(); pendingPoint=calculateVisiblePoint(); openFreeModal(null);
  }

  function installEditFields(){
    const group=document.getElementById('ioLabelGroup'); if(!group || group.dataset.richDocumentation==='1') return;
    const inputModes=document.getElementById('inputModeGroup');
    if(inputModes && group.contains(inputModes)) group.parentNode.insertBefore(inputModes,group.nextSibling);
    group.dataset.richDocumentation='1';
    group.innerHTML='<label class="doc-main-label">Texto de referencia del elemento</label>'
      +'<input id="editIOLabel" maxlength="300" placeholder="Ejemplo: Sensor de nivel / Contactor de bomba">'
      +'<div class="doc-edit-grid">'
      +'<label>Formato<select id="editDescriptionFormat"><option value="comment">Comentario PLC</option><option value="title">Título</option><option value="free">Texto simple</option></select></label>'
      +'<label>Fuente<select id="editDescriptionFont"><option>Arial</option><option>Verdana</option><option>Tahoma</option><option>Georgia</option><option>Courier New</option></select></label>'
      +'<label>Tamaño<select id="editDescriptionSize"><option value="12">Pequeño</option><option value="14">Normal</option><option value="18">Grande</option><option value="22">Muy grande</option><option value="28">Título</option></select></label>'
      +'<label>Ancho<select id="editDescriptionWidth"><option value="170">Corto</option><option value="230">Normal</option><option value="320">Ancho</option><option value="440">Muy ancho</option></select></label>'
      +'<label class="wide">Color del texto'+global.SimuPLCTextPalette.markup('editDescriptionColor','text',defaults.color)+'</label>'
      +'<label class="wide">Color de fondo'+global.SimuPLCTextPalette.markup('editDescriptionBg','background',defaults.background)+'</label>'
      +'</div><div class="doc-checks"><label><input id="editDescriptionBold" type="checkbox" checked> Negrita</label><label><input id="editDescriptionItalic" type="checkbox"> Cursiva</label></div>'
      +'<div class="doc-edit-help">El texto seguirá al bloque y podrás moverlo de forma independiente.</div>';
    global.SimuPLCTextPalette.bind(group);
  }
  function fillEdit(node){
    if(!node) return; ensureDefaults(node); editDraftNode=node;
    const values={
      editIOLabel:node.description,editDescriptionFormat:node.descriptionFormat,editDescriptionFont:node.descriptionFontFamily,
      editDescriptionSize:String(node.descriptionFontSize),editDescriptionWidth:String(node.descriptionMaxWidth)
    };
    Object.keys(values).forEach(function(id){const element=document.getElementById(id);if(element && document.activeElement!==element)element.value=values[id];});
    const bold=document.getElementById('editDescriptionBold'),italic=document.getElementById('editDescriptionItalic');
    if(bold)bold.checked=node.descriptionBold!==false;if(italic)italic.checked=!!node.descriptionItalic;
    global.SimuPLCTextPalette.set(document,'editDescriptionColor',node.descriptionColor);
    global.SimuPLCTextPalette.set(document,'editDescriptionBg',node.descriptionBackground);
  }
  function saveEdit(){
    const node=currentNode(); if(!node) return;
    ensureDefaults(node);
    node.description=cleanText((document.getElementById('editIOLabel')||{}).value,300);
    node.reference=node.description;
    node.descriptionFormat=(document.getElementById('editDescriptionFormat')||{}).value || defaults.format;
    node.descriptionFontFamily=(document.getElementById('editDescriptionFont')||{}).value || defaults.fontFamily;
    node.descriptionFontSize=number((document.getElementById('editDescriptionSize')||{}).value,defaults.fontSize);
    node.descriptionMaxWidth=number((document.getElementById('editDescriptionWidth')||{}).value,defaults.maxWidth);
    node.descriptionBold=!!((document.getElementById('editDescriptionBold')||{}).checked);
    node.descriptionItalic=!!((document.getElementById('editDescriptionItalic')||{}).checked);
    node.descriptionColor=(document.getElementById('editDescriptionColor')||{}).value || defaults.color;
    node.descriptionBackground=(document.getElementById('editDescriptionBg')||{}).value || defaults.background;
    ensureDefaults(node); renderAssociated(node.el,node); diagnostics.associatedSaves++;
    selectedDescriptionNode=node.description?node:null;
  }

  function descriptionData(node){
    ensureDefaults(node);
    return {
      description:node.description || '',reference:node.description || '',ioLabel:node.description || '',
      descriptionOffsetX:node.descriptionOffsetX,descriptionOffsetY:node.descriptionOffsetY,
      descriptionFormat:node.descriptionFormat,descriptionFontFamily:node.descriptionFontFamily,
      descriptionFontSize:node.descriptionFontSize,descriptionMaxWidth:node.descriptionMaxWidth,
      descriptionBold:node.descriptionBold,descriptionItalic:node.descriptionItalic,
      descriptionColor:node.descriptionColor,descriptionBackground:node.descriptionBackground
    };
  }
  function decorateSnapshot(snapshot){
    if(!snapshot || typeof snapshot!=='object') return snapshot;
    const target=snapshot.editors&&snapshot.editors.fbd?snapshot.editors.fbd:(snapshot.fbd&&snapshot.fbd.nodes?snapshot.fbd:(snapshot.data&&Array.isArray(snapshot.data.nodes)?snapshot.data:snapshot));
    if(!target || !Array.isArray(target.nodes)) return snapshot;
    target.freeTexts=clone(freeTexts);
    target.nodes.forEach(function(saved,index){
      const node=nodeById(saved.id,index); if(!node) return;
      Object.assign(saved,descriptionData(node));
      saved.params=Object.assign({},saved.params||{},descriptionData(node));
    });
    diagnostics.serializations++;
    return snapshot;
  }
  function normalizeIncoming(source){
    if(!source || typeof source!=='object') return source;
    const target=source.editors&&source.editors.fbd?source.editors.fbd:(source.fbd&&source.fbd.nodes?source.fbd:(source.data&&Array.isArray(source.data.nodes)?source.data:source));
    if(!target || !Array.isArray(target.nodes)) return source;
    target.nodes.forEach(function(saved){
      const p=saved.params||{};
      const description=cleanText(saved.description ?? p.description ?? saved.reference ?? p.reference ?? saved.ioLabel ?? p.ioLabel ?? '',300);
      saved.description=description; saved.reference=description; saved.ioLabel=description;
    });
    return source;
  }
  function applyLoaded(source){
    if(!source || typeof source!=='object') return;
    const target=source.editors&&source.editors.fbd?source.editors.fbd:(source.fbd&&source.fbd.nodes?source.fbd:(source.data&&Array.isArray(source.data.nodes)?source.data:source));
    if(!target || !Array.isArray(target.nodes)) return;
    freeTexts=(target.freeTexts || target.referenceTexts || target.annotations || target.texts || []).map(normalizeFreeText);
    nextTextId=freeTexts.reduce(function(max,item){const n=parseInt(String(item.id||'').replace(/\D/g,''),10)||0;return Math.max(max,n+1);},1);
    target.nodes.forEach(function(saved,index){
      const node=nodeById(saved.id,index);if(!node)return;
      const p=saved.params||{};
      node.description=cleanText(saved.description ?? p.description ?? saved.reference ?? p.reference ?? saved.ioLabel ?? p.ioLabel ?? '',300);
      node.descriptionOffsetX=number(saved.descriptionOffsetX ?? p.descriptionOffsetX,defaults.offsetX);
      node.descriptionOffsetY=number(saved.descriptionOffsetY ?? p.descriptionOffsetY,defaults.offsetY);
      node.descriptionFormat=saved.descriptionFormat || p.descriptionFormat || defaults.format;
      node.descriptionFontFamily=saved.descriptionFontFamily || p.descriptionFontFamily || defaults.fontFamily;
      node.descriptionFontSize=number(saved.descriptionFontSize ?? p.descriptionFontSize,defaults.fontSize);
      node.descriptionMaxWidth=number(saved.descriptionMaxWidth ?? p.descriptionMaxWidth,defaults.maxWidth);
      node.descriptionBold=(saved.descriptionBold ?? p.descriptionBold) !== false;
      node.descriptionItalic=!!(saved.descriptionItalic ?? p.descriptionItalic);
      node.descriptionColor=saved.descriptionColor || p.descriptionColor || defaults.color;
      node.descriptionBackground=saved.descriptionBackground || p.descriptionBackground || defaults.background;
      ensureDefaults(node); renderAssociated(node.el,node);
    });
    selectedTextId=null;selectedDescriptionNode=null;renderFreeTexts();refreshAssociated();diagnostics.loads++;
  }
  function wrapSerializer(name){
    const original=global[name]; if(typeof original!=='function' || original.__simuplcDocWrapped) return;
    const wrapped=function(){ return decorateSnapshot(original.apply(this,arguments)); };
    wrapped.__simuplcDocWrapped=true; wrapped.__original=original; global[name]=wrapped;
  }
  function wrapLoader(name){
    const original=global[name]; if(typeof original!=='function' || original.__simuplcDocWrapped) return;
    const wrapped=function(data){
      const normalized=normalizeIncoming(clone(data));
      const result=original.call(this,normalized);
      applyLoaded(normalized); return result;
    };
    wrapped.__simuplcDocWrapped=true; wrapped.__original=original; global[name]=wrapped;
  }
  function wrapClear(){
    const original=global.clearAll; if(typeof original!=='function' || original.__simuplcDocWrapped) return;
    const wrapped=function(){ const result=original.apply(this,arguments);freeTexts=[];selectedTextId=null;selectedDescriptionNode=null;renderFreeTexts();return result; };
    wrapped.__simuplcDocWrapped=true;global.clearAll=wrapped;
  }

  function installStyles(){
    if(document.getElementById('simuplc-documentation-style')) return;
    const style=document.createElement('style');style.id='simuplc-documentation-style';
    style.textContent=`
      .simuplc-color-palette{display:flex;flex-wrap:wrap;gap:7px;padding:8px;border:1px solid #b8c6d6;border-radius:10px;background:#f8fafc;min-height:38px;align-items:center}.simuplc-color-swatch{width:30px;height:30px;border:2px solid #fff;border-radius:7px;box-shadow:0 0 0 1px #8191a3;cursor:pointer;padding:0;position:relative;flex:0 0 auto}.simuplc-color-swatch:hover{transform:translateY(-1px);box-shadow:0 0 0 2px #5d7187}.simuplc-color-swatch.is-selected{box-shadow:0 0 0 3px #0066cc}.simuplc-color-swatch.is-selected::after{content:'✓';position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:900;font-size:17px;text-shadow:0 1px 3px #000}.simuplc-color-swatch.is-transparent{background-color:#fff!important;background-image:linear-gradient(45deg,#d8dee8 25%,transparent 25%),linear-gradient(-45deg,#d8dee8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d8dee8 75%),linear-gradient(-45deg,transparent 75%,#d8dee8 75%);background-size:10px 10px;background-position:0 0,0 5px,5px -5px,-5px 0}.simuplc-color-swatch.is-transparent::before{content:'Ø';position:absolute;inset:0;display:grid;place-items:center;color:#c62828;font-weight:900;font-size:18px}.simuplc-palette-caption{font-size:11px;color:#526173;margin-top:4px;font-weight:600}
      #btnReferenceText{font-weight:900;min-width:44px!important;font-size:16px}.fbd-free-text{position:absolute;z-index:95;min-width:100px;padding:8px 12px;border:1.5px solid #9eb4ca;border-radius:7px;white-space:pre-wrap;line-height:1.3;color:#263548;background:#f8fafc;box-shadow:0 2px 5px rgba(15,23,42,.18);cursor:move;user-select:none;touch-action:none;box-sizing:border-box}.fbd-free-text.format-comment,.node-associated-description.format-comment{border-left:5px solid #0066cc!important;text-align:left}.fbd-free-text.format-title,.node-associated-description.format-title{border:0;border-bottom:2px solid #4776a4;border-radius:0;box-shadow:none;text-align:left}.fbd-free-text.format-free,.node-associated-description.format-free{border:1px solid #94a3b8;text-align:left}.fbd-free-text.selected,.node-associated-description.selected-description{outline:3px solid rgba(0,102,204,.45);outline-offset:3px;box-shadow:0 0 0 1px #0066cc}.node-associated-description{position:absolute;z-index:20;width:max-content;padding:7px 11px;border:1.5px solid #9eb4ca;border-radius:7px;text-align:left;line-height:1.25;white-space:normal;cursor:move;user-select:none;touch-action:none;pointer-events:auto;background:#f8fafc;box-shadow:0 2px 5px rgba(15,23,42,.18);box-sizing:border-box}
      #fbdTextModal{position:fixed;inset:0;z-index:10050;background:rgba(10,20,35,.55);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(3px)}#fbdTextModal.show{display:flex}.fbd-text-card{width:min(640px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;border:1px solid #d8e0ea;box-shadow:0 24px 70px rgba(0,0,0,.32)}.fbd-text-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #dfe6ee}.fbd-text-head h3{margin:0;color:#0b3f76}.fbd-text-head button,.fbd-text-actions button{padding:9px 13px;border:1px solid #b8c6d6;border-radius:9px;background:#fff;font-weight:800;cursor:pointer}.fbd-text-actions .primary{background:#08783d;color:#fff;border-color:#08783d}.fbd-text-body{padding:18px;display:grid;gap:14px}.fbd-text-body label{display:grid;gap:6px;font-weight:800;font-size:13px;color:#263548}.fbd-text-body textarea,.fbd-text-body select{width:100%;box-sizing:border-box;border:1px solid #b8c6d6;border-radius:10px;padding:10px 12px;font:inherit}.fbd-text-body textarea{min-height:128px;resize:vertical}.fbd-text-grid,.doc-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fbd-text-grid .wide,.doc-edit-grid .wide{grid-column:1/-1}.fbd-text-checks,.doc-checks{display:flex;gap:14px;flex-wrap:wrap}.fbd-text-actions{display:flex;justify-content:flex-end;gap:10px}.fbd-text-help,.doc-edit-help{padding:9px 11px;border-radius:9px;background:#eef6ff;border-left:4px solid #0066cc;font-size:12px;line-height:1.4;color:#31445a}.doc-main-label{font-weight:800;color:#003366;display:block;margin-bottom:4px}#ioLabelGroup input,#ioLabelGroup select{width:100%;box-sizing:border-box;padding:8px;border:2px solid #bbb;border-radius:8px;font-weight:700}#ioLabelGroup .doc-edit-grid label{font-size:12px;font-weight:800;color:#334155;display:grid;gap:4px}
      @media(max-width:620px), (pointer:coarse){.fbd-text-grid,.doc-edit-grid{grid-template-columns:1fr}#fbdTextModal{align-items:flex-start;padding:6px}.fbd-text-card{max-height:calc(100dvh - 12px)}#editPanel{max-height:calc(100dvh - 78px)!important;overflow-y:auto!important;padding-bottom:calc(18px + env(safe-area-inset-bottom))!important}}
    `;
    document.head.appendChild(style);
  }

  function installButton(){
    if(document.getElementById('btnReferenceText')) return;
    const topbar=document.getElementById('topbar'); if(!topbar) return;
    const button=document.createElement('button');button.id='btnReferenceText';button.type='button';button.title='Insertar texto libre de referencia';button.setAttribute('aria-label','Insertar texto libre de referencia');button.innerHTML='<span aria-hidden="true" style="font-weight:900;font-size:16px">Aa</span>';
    const edit=document.getElementById('btnEdit'); if(edit && edit.parentNode===topbar)topbar.insertBefore(button,edit);else topbar.appendChild(button);
    button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();beginText();});
  }
  function installInteractions(){
    const edit=document.getElementById('btnEdit'),save=document.getElementById('btnEditSave'),del=document.getElementById('deleteBtn');
    if(edit)edit.addEventListener('click',function(event){
      if(selectedTextId){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();const item=freeTexts.find(function(t){return t.id===selectedTextId;});if(item)openFreeModal(item);return;}
      if(selectedDescriptionNode){try{if(adapter()&&adapter().setSelectedNode)adapter().setSelectedNode(selectedDescriptionNode);global.selectedNode=selectedDescriptionNode;}catch(_){ }}
      setTimeout(function(){fillEdit(currentNode());},0);setTimeout(function(){fillEdit(currentNode());},50);
    },true);
    if(save)save.addEventListener('click',saveEdit,true);
    if(del)del.addEventListener('click',function(event){
      if(selectedTextId){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();deleteSelectedFree();return;}
      if(selectedDescriptionNode){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();removeAssociated();}
    },true);
    document.addEventListener('click',function(event){
      if(!(event.target.closest && event.target.closest('.node-associated-description,#editPanel')))clearAssociatedSelection();
      if(!(event.target.closest && event.target.closest('.fbd-free-text,#fbdTextModal'))){selectedTextId=null;updateFreeSelection();}
    });
    document.addEventListener('keydown',function(event){
      const tag=document.activeElement&&document.activeElement.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
      if((event.key==='Delete'||event.key==='Backspace')&&selectedDescriptionNode){event.preventDefault();removeAssociated();return;}
      if((event.key==='Delete'||event.key==='Backspace')&&selectedTextId){event.preventDefault();deleteSelectedFree();return;}
      if(event.key==='Enter'&&selectedTextId){const item=freeTexts.find(function(t){return t.id===selectedTextId;});if(item){event.preventDefault();openFreeModal(item);}}
    });
  }
  function observeNodes(){
    const root=workspace() || document.body;
    new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(function(item){if(item.nodeType!==1)return;if(item.classList&&item.classList.contains('node'))renderAssociated(item);if(item.querySelectorAll)item.querySelectorAll('.node').forEach(renderAssociated);});});}).observe(root,{childList:true,subtree:true});
  }
  function installWrappers(){
    ['serializeFBD','serialize','exportState','getFBDState','__getCanonicalFBDProject'].forEach(wrapSerializer);
    ['loadFromData','deserializeFBD','loadFBDState','importState','__loadCanonicalFBDProject'].forEach(wrapLoader);
    wrapClear();
  }
  function init(){
    installStyles();installButton();installEditFields();createModal();installInteractions();observeNodes();installWrappers();
    refreshAssociated();renderFreeTexts();
    // Los módulos de proyecto terminan de cargar después. Reintentamos los envoltorios.
    setTimeout(installWrappers,300);setTimeout(installWrappers,1200);
  }

  global.ensureReferenceBadge=renderAssociated;
  global.ensureIOBadge=renderAssociated;
  global.refreshAllIOBadges=refreshAssociated;
  global.SimuPLCFBDReferences=Object.freeze({
    get:function(node){ensureDefaults(node);return node?node.description:'';},
    set:function(node,value){if(!node)return '';node.description=cleanText(value,300);ensureDefaults(node);renderAssociated(node.el,node);return node.description;},
    render:renderAssociated,refresh:refreshAssociated,getDiagnostics:function(){return Object.assign({ok:true},diagnostics);}
  });
  global.SimuPLCFbdDocumentation=Object.freeze({
    refresh:refreshAssociated,beginText:beginText,render:renderFreeTexts,
    getTexts:function(){return clone(freeTexts);},
    setTexts:function(list){freeTexts=(Array.isArray(list)?list:[]).map(normalizeFreeText);nextTextId=freeTexts.length+1;renderFreeTexts();},
    getDiagnostics:function(){return Object.assign({ok:true,freeTextCount:freeTexts.length},diagnostics);}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
