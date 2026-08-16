(function(global){
  'use strict';
  if(global.SimuPLCLadderDocumentation) return;

  const DEFAULT_TEXT='Texto de referencia';
  const defaults={format:'comment',fontFamily:'Arial',fontSize:14,maxWidth:230,bold:true,italic:false,color:'#263548',background:'#f8fafc',offsetX:0,offsetY:-104};
  const diagnostics={freeCreates:0,associatedSaves:0,draws:0,loads:0,serializations:0,migrations:0};
  let paintPending=false;
  let newlyCreatedId=null;

  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}}
  function num(value,fallback){value=Number(value);return Number.isFinite(value)?value:fallback;}
  function text(value,max){return String(value==null?'':value).trim().slice(0,max||1000);}
  function uid(){return 'ref_'+Math.random().toString(36).slice(2,10);}
  function isPro(){try{return typeof isProMode==='function'?!!isProMode():state.ladderMode==='pro';}catch(_){return true;}}
  function redraw(){try{if(typeof draw==='function')draw();else if(global.draw)global.draw();}catch(_){}}
  function dirty(){try{if(typeof markModelDirty==='function')markModelDirty();else if(global.markModelDirty)global.markModelDirty();}catch(_){}}
  function setStatus(message){try{if(typeof statusText!=='undefined'&&statusText)statusText.textContent=message;}catch(_){}}
  function zoom(){try{return typeof getProZoom==='function'?Number(getProZoom())||1:Number(state.proZoom)||1;}catch(_){return 1;}}
  function screenPoint(x,y){try{return typeof worldToScreen==='function'?worldToScreen(x,y):{x:x,y:y};}catch(_){return{x:x,y:y};}}
  function pointerWorld(event){
    let point=typeof getPointerPos==='function'?getPointerPos(event):{x:event.offsetX,y:event.offsetY};
    try{if(isPro()&&typeof screenToWorld==='function')point=screenToWorld(point.x,point.y);}catch(_){ }
    return point;
  }

  function walkElements(elements,callback){
    (elements||[]).forEach(function(element){
      if(!element)return;callback(element);
      if(element.type==='BRANCH')(element.branches||[]).forEach(function(lane){walkElements(lane,callback);});
    });
  }
  function allElements(){
    const result=[];
    try{(state.ladder.rungs||[]).forEach(function(rung){walkElements(rung.elements,function(el){result.push(el);});});}catch(_){ }
    return result;
  }
  function elementById(id){
    try{if(typeof findElementById==='function')return findElementById(id);}catch(_){ }
    return allElements().find(function(el){return el&&el.id===id;})||null;
  }
  function ensureElement(element){
    if(!element)return element;
    const legacy=text(element.description || element.reference || element.referenceText || element.ref || '',300);
    if(!element.description&&legacy){element.description=legacy;diagnostics.migrations++;}
    element.description=text(element.description,300);element.reference=element.description;
    element.descriptionOffsetX=num(element.descriptionOffsetX,defaults.offsetX);
    element.descriptionOffsetY=num(element.descriptionOffsetY,defaults.offsetY);
    element.descriptionFormat=element.descriptionFormat||defaults.format;
    element.descriptionFontFamily=element.descriptionFontFamily||defaults.fontFamily;
    element.descriptionFontSize=num(element.descriptionFontSize,defaults.fontSize);
    element.descriptionMaxWidth=num(element.descriptionMaxWidth,defaults.maxWidth);
    element.descriptionBold=typeof element.descriptionBold==='boolean'?element.descriptionBold:defaults.bold;
    element.descriptionItalic=!!element.descriptionItalic;
    element.descriptionColor=element.descriptionColor||defaults.color;
    element.descriptionBackground=element.descriptionBackground||defaults.background;
    return element;
  }
  function normalizeAllElements(){allElements().forEach(ensureElement);}

  function normalizeFree(ref,index){
    ref=ref&&typeof ref==='object'?Object.assign({},ref):{};
    ref.id=ref.id||uid();ref.text=text(ref.text||ref.value||DEFAULT_TEXT,1000)||DEFAULT_TEXT;
    ref.x=num(ref.x,250+(index||0)*20);ref.y=num(ref.y,110+(index||0)*24);
    ref.format=ref.format||'comment';ref.fontSize=Math.max(12,Math.min(48,num(ref.fontSize,ref.format==='title'?28:18)));
    ref.maxWidth=Math.max(160,Math.min(760,num(ref.maxWidth,360)));ref.bold=ref.bold===true||ref.format==='title';ref.italic=!!ref.italic;
    ref.color=ref.color||defaults.color;ref.fontFamily=ref.fontFamily||defaults.fontFamily;ref.background=ref.background||defaults.background;
    return ref;
  }
  function references(){
    if(!state.ladder||typeof state.ladder!=='object')state.ladder={version:3,type:'ladder-free-pro-industrial',rungs:[{id:uid(),elements:[]}]};
    if(!Array.isArray(state.ladder.referenceTexts))state.ladder.referenceTexts=[];
    state.ladder.referenceTexts=state.ladder.referenceTexts.map(normalizeFree);
    return state.ladder.referenceTexts;
  }
  function freeById(id){return references().find(function(ref){return ref.id===id;})||null;}

  function font(ref,screenScale){
    const size=Math.max(10,ref.fontSize*(screenScale||1));
    return (ref.italic?'italic ':'')+(ref.bold?'800 ':'500 ')+Math.round(size)+'px '+(ref.fontFamily||'Arial')+', sans-serif';
  }
  function wrapFreeLines(ref){
    const paragraphs=String(ref.text||'').replace(/\r/g,'').split('\n'),result=[];
    ctx.save();ctx.font=font(ref,1);
    paragraphs.forEach(function(paragraph){
      if(paragraph===''){result.push('');return;}
      let line='';paragraph.split(/\s+/).forEach(function(word){const trial=line?line+' '+word:word;if(line&&ctx.measureText(trial).width>ref.maxWidth){result.push(line);line=word;}else line=trial;});result.push(line||'');
    });ctx.restore();return result.length?result:[''];
  }
  function freeMetrics(ref){
    ref=normalizeFree(ref,0);const lines=wrapFreeLines(ref),lineHeight=ref.fontSize*1.36,padX=ref.format==='free'?5:15,padY=ref.format==='free'?5:11;
    let maxText=40;ctx.save();ctx.font=font(ref,1);lines.forEach(function(line){maxText=Math.max(maxText,ctx.measureText(line||' ').width);});ctx.restore();
    return{lines:lines,lineHeight:lineHeight,padX:padX,padY:padY,width:Math.min(ref.maxWidth,maxText)+padX*2,height:Math.max(lineHeight,lines.length*lineHeight)+padY*2+(ref.format==='title'?5:0)};
  }
  function drawFreeTexts(){
    if(!canvas||!canvas.isConnected)return;
    state.referenceTextHitMap=[];const list=references();if(!list.length)return;
    ctx.save();
    if(isPro()){
      try{const p0=screenPoint(0,0),p1=screenPoint(1,1),z=zoom();ctx.transform((p1.x-p0.x)||z,0,0,(p1.y-p0.y)||z,p0.x,p0.y);}catch(_){ }
    }
    list.forEach(function(ref){
      const m=freeMetrics(ref),x=ref.x,y=ref.y,w=m.width,h=m.height,selected=state.referenceTextSelectedId===ref.id;
      if(ref.format==='comment'){
        ctx.fillStyle=ref.background||defaults.background;ctx.strokeStyle='#9eb4ca';ctx.lineWidth=1.3;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,8);else ctx.rect(x,y,w,h);ctx.fill();ctx.stroke();ctx.fillStyle='#0066cc';ctx.fillRect(x,y,5,h);
      }else if(ref.format==='title'){
        ctx.fillStyle=ref.background||'rgba(248,250,252,.94)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#4776a4';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h);ctx.stroke();
      }else{ctx.fillStyle=ref.background||defaults.background;ctx.strokeStyle='#9aa7b5';ctx.lineWidth=1;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}
      ctx.font=font(ref,1);ctx.fillStyle=ref.color||defaults.color;ctx.textAlign='left';ctx.textBaseline='top';
      const tx=x+m.padX,ty=y+m.padY;m.lines.forEach(function(line,i){ctx.fillText(line,tx,ty+i*m.lineHeight);});
      if(selected&&!state.simulationOn){ctx.save();ctx.strokeStyle='#0066ff';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.strokeRect(x-5,y-5,w+10,h+10);ctx.restore();}
      state.referenceTextHitMap.push({id:ref.id,ref:ref,x:x,y:y,w:w,h:h});
    });ctx.restore();diagnostics.draws++;
  }

  function wrapDescriptionLines(value,maxWidth){
    const words=String(value||'').trim().split(/\s+/),lines=[];let line='';
    words.forEach(function(word){const trial=line?line+' '+word:word;if(line&&ctx.measureText(trial).width>maxWidth){lines.push(line);line=word;}else line=trial;});if(line)lines.push(line);return lines.slice(0,5);
  }
  function drawAssociated(element,x,y){
    if(!element)return;ensureElement(element);if(!element.description)return;
    const format=element.descriptionFormat||'comment',fontSize=Math.max(10,S(num(element.descriptionFontSize,14)));
    const centerX=x+S(num(element.descriptionOffsetX,0)),centerY=y+S(num(element.descriptionOffsetY,-104)),maxWidth=S(num(element.descriptionMaxWidth,230));
    const padX=S(format==='free'?6:12),padY=S(format==='free'?5:8),stripe=S(5);
    ctx.save();const weight=(element.descriptionBold||format==='title')?'800':'500';ctx.font=(element.descriptionItalic?'italic ':'')+weight+' '+fontSize+'px '+(element.descriptionFontFamily||'Arial');ctx.textAlign='left';ctx.textBaseline='middle';
    const lines=wrapDescriptionLines(element.description,Math.max(S(80),maxWidth-padX*2-stripe)),lineH=fontSize*1.24;
    const measured=Math.max.apply(null,lines.map(function(line){return ctx.measureText(line).width;}).concat([S(40)]));
    const boxW=Math.min(maxWidth,measured+padX*2+(format==='comment'?stripe:0)),boxH=Math.max(lineH,lines.length*lineH)+padY*2,left=centerX-boxW/2,top=centerY-boxH/2,bg=element.descriptionBackground||defaults.background;
    if(format==='comment'){
      ctx.fillStyle=bg;ctx.strokeStyle=state.associatedDescriptionSelectedId===element.id?'#0066cc':'#9eb4ca';ctx.lineWidth=Math.max(1,S(1.4));ctx.beginPath();if(ctx.roundRect)ctx.roundRect(left,top,boxW,boxH,S(7));else ctx.rect(left,top,boxW,boxH);ctx.fill();ctx.stroke();ctx.fillStyle='#0066cc';ctx.fillRect(left,top,stripe,boxH);
    }else if(format==='title'){
      ctx.fillStyle=bg;ctx.fillRect(left,top,boxW,boxH);ctx.strokeStyle=state.associatedDescriptionSelectedId===element.id?'#0066cc':'#4776a4';ctx.lineWidth=Math.max(1,S(1.5));ctx.beginPath();ctx.moveTo(left,top+boxH);ctx.lineTo(left+boxW,top+boxH);ctx.stroke();
    }else{ctx.fillStyle=bg;ctx.strokeStyle=state.associatedDescriptionSelectedId===element.id?'#0066cc':'#94a3b8';ctx.lineWidth=Math.max(1,S(1));ctx.fillRect(left,top,boxW,boxH);ctx.strokeRect(left,top,boxW,boxH);}
    ctx.fillStyle=element.descriptionColor||defaults.color;const tx=left+padX+(format==='comment'?stripe:0),startY=centerY-((lines.length-1)*lineH)/2;lines.forEach(function(line,index){ctx.fillText(line,tx,startY+index*lineH);});
    if(state.associatedDescriptionSelectedId===element.id){ctx.save();ctx.strokeStyle='#0066cc';ctx.setLineDash([S(5),S(4)]);ctx.strokeRect(left-S(4),top-S(4),boxW+S(8),boxH+S(8));ctx.restore();}
    ctx.restore();state.associatedDescriptionHitMap.push({id:element.id,element:element,x:left-S(7),y:top-S(7),w:boxW+S(14),h:boxH+S(14)});
  }
  function paintProAssociated(){
    if(!isPro())return;state.associatedDescriptionHitMap=[];const seen=Object.create(null);ctx.save();
    try{const p0=screenPoint(0,0),p1=screenPoint(1,1);ctx.transform((p1.x-p0.x)||1,0,0,(p1.y-p0.y)||1,p0.x,p0.y);}catch(_){ }
    (state.hitMap||[]).forEach(function(hit){const el=hit&&hit.element;if(!el||seen[el.id]||!ensureElement(el).description)return;seen[el.id]=true;drawAssociated(el,hit.centerX,hit.centerY);});ctx.restore();
  }
  function paintOverlays(){paintPending=false;paintProAssociated();drawFreeTexts();}
  function schedulePaint(){if(paintPending)return;paintPending=true;requestAnimationFrame(paintOverlays);}

  function findHit(map,x,y){for(let i=(map||[]).length-1;i>=0;i--){const hit=map[i];if(x>=hit.x&&x<=hit.x+hit.w&&y>=hit.y&&y<=hit.y+hit.h)return hit;}return null;}
  function freeHit(point){return findHit(state.referenceTextHitMap,point.x,point.y);}
  function associatedHit(point){return findHit(state.associatedDescriptionHitMap,point.x,point.y);}

  function installStyle(){
    if(document.getElementById('simuplc-ladder-documentation-style'))return;
    const style=document.createElement('style');style.id='simuplc-ladder-documentation-style';style.textContent=`
      .simuplc-color-palette{display:flex;flex-wrap:wrap;gap:7px;padding:8px;border:1px solid #b8c6d6;border-radius:10px;background:#f8fafc;min-height:38px;align-items:center}.simuplc-color-swatch{width:30px;height:30px;border:2px solid #fff;border-radius:7px;box-shadow:0 0 0 1px #8191a3;cursor:pointer;padding:0;position:relative}.simuplc-color-swatch.is-selected{box-shadow:0 0 0 3px #0066cc}.simuplc-color-swatch.is-selected::after{content:'✓';position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:900;text-shadow:0 1px 3px #000}.simuplc-color-swatch.is-transparent{background-color:#fff!important;background-image:linear-gradient(45deg,#d8dee8 25%,transparent 25%),linear-gradient(-45deg,#d8dee8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d8dee8 75%),linear-gradient(-45deg,transparent 75%,#d8dee8 75%);background-size:10px 10px;background-position:0 0,0 5px,5px -5px,-5px 0}.simuplc-color-swatch.is-transparent::before{content:'Ø';position:absolute;inset:0;display:grid;place-items:center;color:#c62828;font-weight:900}.simuplc-palette-caption{font-size:11px;color:#526173;margin-top:4px;font-weight:600}
      #addReferenceTextTop{font-weight:900;min-width:48px}.reference-text-overlay{position:fixed;inset:0;z-index:10080;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(8,18,32,.62);backdrop-filter:blur(3px)}.reference-text-overlay.show{display:flex}.reference-text-card{width:min(640px,96vw);max-height:92vh;overflow:auto;background:#fff;color:#172033;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.32);border:1px solid #d8e0ea}.reference-text-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #dfe6ee}.reference-text-head h3{margin:0;color:#0b3f76}.reference-text-body{padding:18px;display:grid;gap:14px}.reference-text-body label{display:grid;gap:6px;font-weight:800;font-size:13px;color:#263548}.reference-text-body textarea,.reference-text-body select{width:100%;box-sizing:border-box;border:1px solid #b8c6d6;border-radius:10px;padding:10px 12px;font:inherit}.reference-text-body textarea{min-height:128px;resize:vertical}.reference-text-grid,.associated-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.reference-text-grid .wide,.associated-edit-grid .wide{grid-column:1/-1}.reference-text-checks,.associated-checks{display:flex;gap:14px;flex-wrap:wrap}.reference-text-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.reference-text-help,.associated-help{padding:9px 11px;border-radius:9px;background:#eef6ff;border-left:4px solid #0066cc;font-size:12px;line-height:1.4;color:#31445a}.associated-edit-grid label{display:grid;gap:4px;font-size:12px;font-weight:800;color:#39414a}.associated-edit-grid select{width:100%;padding:9px;border-radius:9px;border:1px solid #ced4da;background:#fff}
      @media(max-width:620px),(pointer:coarse){.reference-text-grid,.associated-edit-grid{grid-template-columns:1fr}.reference-text-overlay{align-items:flex-start;padding:6px}.reference-text-card{max-height:calc(100dvh - 12px)}#editOverlay{align-items:flex-start!important;overflow:hidden!important;padding:6px!important}#editOverlay .edit-card{width:min(620px,calc(100vw - 12px))!important;max-height:calc(100dvh - 12px)!important;overflow-y:auto!important}}
    `;document.head.appendChild(style);
  }
  function addTopButton(){
    if(document.getElementById('addReferenceTextTop'))return;
    const group=document.querySelector('.toolbar .toolbar-group:nth-of-type(2)')||document.querySelector('.toolbar-group');if(!group)return;
    const button=document.createElement('button');button.className='btn secondary';button.id='addReferenceTextTop';button.title='Insertar texto libre de referencia';button.innerHTML='<strong>Aa</strong>';
    const edit=document.getElementById('editLabel');if(edit&&edit.parentNode===group)group.insertBefore(button,edit);else group.appendChild(button);
    button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();beginFreeText();});
  }

  function createFreeModal(){
    if(document.getElementById('referenceTextOverlay'))return;
    const overlay=document.createElement('div');overlay.id='referenceTextOverlay';overlay.className='reference-text-overlay';overlay.innerHTML='<div class="reference-text-card" role="dialog" aria-modal="true">'
      +'<div class="reference-text-head"><h3>Texto libre Ladder</h3><button type="button" class="btn secondary" id="closeReferenceText">Cerrar</button></div>'
      +'<div class="reference-text-body"><label>Texto o comentario<textarea id="referenceTextInput" maxlength="1000" placeholder="Ejemplo: Arranque automático de la bomba principal"></textarea></label>'
      +'<div class="reference-text-grid"><label>Formato<select id="referenceTextFormat"><option value="comment">Comentario PLC</option><option value="title">Título de red</option><option value="free">Texto libre</option></select></label>'
      +'<label>Fuente<select id="referenceTextFont"><option>Arial</option><option>Verdana</option><option>Tahoma</option><option>Georgia</option><option>Courier New</option></select></label>'
      +'<label>Tamaño<select id="referenceTextSize"><option value="14">Pequeño</option><option value="18">Normal</option><option value="24">Grande</option><option value="30">Título</option><option value="38">Muy grande</option></select></label>'
      +'<label>Ancho máximo<select id="referenceTextWidth"><option value="240">Corto</option><option value="360">Normal</option><option value="520">Ancho</option><option value="700">Muy ancho</option></select></label>'
      +'<label class="wide">Color del texto'+global.SimuPLCTextPalette.markup('referenceTextColor','text',defaults.color)+'</label><label class="wide">Color de fondo'+global.SimuPLCTextPalette.markup('referenceTextBg','background',defaults.background)+'</label></div>'
      +'<div class="reference-text-checks"><label><input id="referenceTextBold" type="checkbox"> Negrita</label><label><input id="referenceTextItalic" type="checkbox"> Cursiva</label></div>'
      +'<div class="reference-text-help">El texto no interviene en la simulación. Puedes moverlo libremente y se guarda en el proyecto.</div>'
      +'<div class="reference-text-actions"><button type="button" class="btn secondary" id="deleteReferenceTextModal">Eliminar texto</button><button type="button" class="btn primary" id="saveReferenceText">Guardar texto</button></div></div></div>';
    document.body.appendChild(overlay);global.SimuPLCTextPalette.bind(overlay);
    overlay.addEventListener('click',function(event){if(event.target===overlay)closeFreeModal(false);});
    document.getElementById('closeReferenceText').addEventListener('click',function(){closeFreeModal(false);});
    document.getElementById('saveReferenceText').addEventListener('click',saveFreeModal);
    document.getElementById('deleteReferenceTextModal').addEventListener('click',function(){deleteFree();closeFreeModal(true);});
  }
  function openFreeModal(ref,isNew){
    createFreeModal();if(!ref)return;newlyCreatedId=isNew?ref.id:null;state.referenceTextEditingId=ref.id;
    document.getElementById('referenceTextInput').value=ref.text||'';document.getElementById('referenceTextFormat').value=ref.format||'comment';document.getElementById('referenceTextFont').value=ref.fontFamily||'Arial';document.getElementById('referenceTextSize').value=String(ref.fontSize||18);document.getElementById('referenceTextWidth').value=String(ref.maxWidth||360);document.getElementById('referenceTextBold').checked=!!ref.bold;document.getElementById('referenceTextItalic').checked=!!ref.italic;
    const overlay=document.getElementById('referenceTextOverlay');global.SimuPLCTextPalette.set(overlay,'referenceTextColor',ref.color||defaults.color);global.SimuPLCTextPalette.set(overlay,'referenceTextBg',ref.background||defaults.background);overlay.classList.add('show');setTimeout(function(){const field=document.getElementById('referenceTextInput');if(field){field.focus();field.select();}},20);
  }
  function closeFreeModal(saved){
    const overlay=document.getElementById('referenceTextOverlay');if(overlay)overlay.classList.remove('show');
    if(!saved&&newlyCreatedId){const ref=freeById(newlyCreatedId);if(ref&&(!text(ref.text)||ref.text===DEFAULT_TEXT)){state.ladder.referenceTexts=references().filter(function(item){return item.id!==newlyCreatedId;});state.referenceTextSelectedId=null;}}
    newlyCreatedId=null;state.referenceTextEditingId=null;redraw();
  }
  function saveFreeModal(){
    const ref=freeById(state.referenceTextEditingId);if(!ref){closeFreeModal(true);return;}
    const value=text(document.getElementById('referenceTextInput').value,1000);if(!value){alert('Escribe el texto de referencia.');return;}
    ref.text=value;ref.format=document.getElementById('referenceTextFormat').value||'comment';ref.fontFamily=document.getElementById('referenceTextFont').value||'Arial';ref.fontSize=Number(document.getElementById('referenceTextSize').value)||18;ref.maxWidth=Number(document.getElementById('referenceTextWidth').value)||360;ref.color=document.getElementById('referenceTextColor').value||defaults.color;ref.background=document.getElementById('referenceTextBg').value||defaults.background;ref.bold=!!document.getElementById('referenceTextBold').checked||ref.format==='title';ref.italic=!!document.getElementById('referenceTextItalic').checked;dirty();setStatus('Texto de referencia guardado. Puedes arrastrarlo para moverlo.');closeFreeModal(true);
  }
  function visibleCenter(){
    const wrap=canvas.parentElement,sx=(wrap&&wrap.scrollLeft||0)+Math.max(160,(wrap&&wrap.clientWidth||canvas.clientWidth||640)/2),sy=(wrap&&wrap.scrollTop||0)+Math.max(120,(wrap&&wrap.clientHeight||canvas.clientHeight||420)/2);
    try{if(isPro()&&typeof screenToWorld==='function')return screenToWorld(sx,sy);}catch(_){ }return{x:sx,y:sy};
  }
  function beginFreeText(){
    if(state.simulationOn){setStatus('Detén la simulación para agregar texto.');return;}
    state.referenceTextSelectedId=null;state.associatedDescriptionSelectedId=null;state.selectedId=null;state.freeSelectedId=null;state.selectedWireId=null;state.pendingType=null;
    const center=visibleCenter(),ref=normalizeFree({id:uid(),text:DEFAULT_TEXT,x:Math.round(Math.max(30,center.x-150)/10)*10,y:Math.round(Math.max(30,center.y-45)/10)*10},references().length);
    references().push(ref);state.referenceTextSelectedId=ref.id;diagnostics.freeCreates++;dirty();redraw();openFreeModal(ref,true);
  }
  function deleteFree(){
    const id=state.referenceTextSelectedId||state.referenceTextEditingId;if(!id)return false;state.ladder.referenceTexts=references().filter(function(ref){return ref.id!==id;});state.referenceTextSelectedId=null;state.referenceTextEditingId=null;state.referenceTextDrag=null;dirty();redraw();setStatus('Texto libre eliminado.');return true;
  }
  function editFree(){const ref=freeById(state.referenceTextSelectedId);if(!ref)return false;openFreeModal(ref,false);return true;}

  function installAssociatedFields(){
    const input=document.getElementById('editReferenceInput');if(!input||input.dataset.richDocumentation==='1')return;input.dataset.richDocumentation='1';input.maxLength=300;input.placeholder='Ejemplo: Pulsador de marcha / Contactor de bomba';
    const label=input.closest('label');if(!label)return;const title=label.querySelector('.edit-label');if(title)title.textContent='Texto de referencia del elemento';
    const block=document.createElement('div');block.innerHTML='<div class="associated-edit-grid">'
      +'<label>Formato<select id="editDescriptionFormat"><option value="comment">Comentario PLC</option><option value="title">Título</option><option value="free">Texto simple</option></select></label>'
      +'<label>Fuente<select id="editDescriptionFont"><option>Arial</option><option>Verdana</option><option>Tahoma</option><option>Georgia</option><option>Courier New</option></select></label>'
      +'<label>Tamaño<select id="editDescriptionSize"><option value="12">Pequeño</option><option value="14">Normal</option><option value="18">Grande</option><option value="22">Muy grande</option><option value="28">Título</option></select></label>'
      +'<label>Ancho<select id="editDescriptionWidth"><option value="170">Corto</option><option value="230">Normal</option><option value="320">Ancho</option><option value="440">Muy ancho</option></select></label>'
      +'<label class="wide">Color del texto'+global.SimuPLCTextPalette.markup('editDescriptionColor','text',defaults.color)+'</label><label class="wide">Color de fondo'+global.SimuPLCTextPalette.markup('editDescriptionBg','background',defaults.background)+'</label></div>'
      +'<div class="associated-checks"><label><input id="editDescriptionBold" type="checkbox" checked> Negrita</label><label><input id="editDescriptionItalic" type="checkbox"> Cursiva</label></div><div class="associated-help">El texto seguirá al elemento y podrás moverlo de forma independiente.</div>';
    label.appendChild(block);global.SimuPLCTextPalette.bind(label);
  }
  function fillAssociated(element){
    if(!element)return;ensureElement(element);const input=document.getElementById('editReferenceInput');if(input)input.value=element.description;
    const values={editDescriptionFormat:element.descriptionFormat,editDescriptionFont:element.descriptionFontFamily,editDescriptionSize:String(element.descriptionFontSize),editDescriptionWidth:String(element.descriptionMaxWidth)};Object.keys(values).forEach(function(id){const field=document.getElementById(id);if(field)field.value=values[id];});
    const bold=document.getElementById('editDescriptionBold'),italic=document.getElementById('editDescriptionItalic');if(bold)bold.checked=element.descriptionBold!==false;if(italic)italic.checked=!!element.descriptionItalic;global.SimuPLCTextPalette.set(document,'editDescriptionColor',element.descriptionColor);global.SimuPLCTextPalette.set(document,'editDescriptionBg',element.descriptionBackground);
  }
  function saveAssociated(){
    const element=elementById(state.editTargetId);if(!element)return;ensureElement(element);element.description=text((document.getElementById('editReferenceInput')||{}).value,300);element.reference=element.description;element.descriptionFormat=(document.getElementById('editDescriptionFormat')||{}).value||defaults.format;element.descriptionFontFamily=(document.getElementById('editDescriptionFont')||{}).value||defaults.fontFamily;element.descriptionFontSize=num((document.getElementById('editDescriptionSize')||{}).value,defaults.fontSize);element.descriptionMaxWidth=num((document.getElementById('editDescriptionWidth')||{}).value,defaults.maxWidth);element.descriptionBold=!!((document.getElementById('editDescriptionBold')||{}).checked);element.descriptionItalic=!!((document.getElementById('editDescriptionItalic')||{}).checked);element.descriptionColor=(document.getElementById('editDescriptionColor')||{}).value||defaults.color;element.descriptionBackground=(document.getElementById('editDescriptionBg')||{}).value||defaults.background;state.associatedDescriptionSelectedId=element.description?element.id:null;diagnostics.associatedSaves++;dirty();
  }
  function deleteAssociated(){const element=elementById(state.associatedDescriptionSelectedId);if(!element)return false;element.description='';element.reference='';state.associatedDescriptionSelectedId=null;state.associatedDescriptionDrag=null;dirty();redraw();setStatus('Texto asociado eliminado; el elemento eléctrico se conserva.');return true;}

  function patchFunctions(){
    try{drawReference=function(){};global.drawReference=drawReference;}catch(_){global.drawReference=function(){};}
    const oldBasic=global.drawBasicElement||((typeof drawBasicElement==='function')?drawBasicElement:null);
    if(oldBasic&&!oldBasic.__docWrapped){const wrapped=function(element,x,y){const result=oldBasic.apply(this,arguments);if(!isPro())drawAssociated(element,x,y);return result;};wrapped.__docWrapped=true;global.drawBasicElement=drawBasicElement=wrapped;}
    const oldDraw=global.draw||((typeof draw==='function')?draw:null);
    if(oldDraw&&!oldDraw.__docWrapped){const wrapped=function(){state.associatedDescriptionHitMap=[];const result=oldDraw.apply(this,arguments);schedulePaint();return result;};wrapped.__docWrapped=true;global.draw=draw=wrapped;}
    const oldCanvasOnly=global.drawCanvasOnly;if(typeof oldCanvasOnly==='function'&&!oldCanvasOnly.__docWrapped){const wrapped=function(){state.associatedDescriptionHitMap=[];const result=oldCanvasOnly.apply(this,arguments);paintOverlays();return result;};wrapped.__docWrapped=true;global.drawCanvasOnly=wrapped;}
    const oldOpen=global.openEditModalForElement||((typeof openEditModalForElement==='function')?openEditModalForElement:null);
    if(oldOpen&&!oldOpen.__docWrapped){const wrapped=function(element){const result=oldOpen.apply(this,arguments);fillAssociated(element);return result;};wrapped.__docWrapped=true;global.openEditModalForElement=openEditModalForElement=wrapped;}
    const oldSave=global.saveEditModalChanges||((typeof saveEditModalChanges==='function')?saveEditModalChanges:null);
    if(oldSave&&!oldSave.__docWrapped){const wrapped=function(){saveAssociated();const result=oldSave.apply(this,arguments);normalizeAllElements();redraw();return result;};wrapped.__docWrapped=true;global.saveEditModalChanges=saveEditModalChanges=wrapped;}
    const oldSerial=global.getSerializableLadder||((typeof getSerializableLadder==='function')?getSerializableLadder:null);
    if(oldSerial&&!oldSerial.__docWrapped){const wrapped=function(){normalizeAllElements();const model=oldSerial.apply(this,arguments);model.referenceTexts=clone(references());diagnostics.serializations++;return model;};wrapped.__docWrapped=true;global.getSerializableLadder=getSerializableLadder=wrapped;}
    const oldLoad=global.tryLoadModel||((typeof tryLoadModel==='function')?tryLoadModel:null);
    if(oldLoad&&!oldLoad.__docWrapped){const wrapped=function(model){model=clone(model||{});model.referenceTexts=(model.referenceTexts||model.annotations||model.texts||[]).map(normalizeFree);const result=oldLoad.call(this,model);normalizeAllElements();references();state.referenceTextSelectedId=null;state.associatedDescriptionSelectedId=null;diagnostics.loads++;redraw();return result;};wrapped.__docWrapped=true;global.tryLoadModel=tryLoadModel=wrapped;}
    const oldReset=global.resetDemoProject||((typeof resetDemoProject==='function')?resetDemoProject:null);
    if(oldReset&&!oldReset.__docWrapped){const wrapped=function(){const result=oldReset.apply(this,arguments);if(state.ladder)state.ladder.referenceTexts=[];state.referenceTextSelectedId=null;state.associatedDescriptionSelectedId=null;redraw();return result;};wrapped.__docWrapped=true;global.resetDemoProject=resetDemoProject=wrapped;}
  }

  function bindPointer(){
    state.referenceTextHitMap=[];state.associatedDescriptionHitMap=[];state.referenceTextSelectedId=null;state.associatedDescriptionSelectedId=null;
    let drag=null;
    canvas.addEventListener('pointerdown',function(event){
      if(state.simulationOn)return;const point=pointerWorld(event),free=freeHit(point),associated=associatedHit(point);if(!free&&!associated)return;
      event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();
      if(free){const ref=free.ref||freeById(free.id);if(!ref)return;state.referenceTextSelectedId=ref.id;state.associatedDescriptionSelectedId=null;state.selectedId=null;state.selectedWireId=null;drag={type:'free',id:ref.id,startX:point.x,startY:point.y,originX:ref.x,originY:ref.y,moved:false,pointerId:event.pointerId};}
      else{const element=associated.element||elementById(associated.id);if(!element)return;ensureElement(element);state.associatedDescriptionSelectedId=element.id;state.referenceTextSelectedId=null;state.selectedId=null;state.selectedWireId=null;drag={type:'associated',id:element.id,startX:point.x,startY:point.y,originX:element.descriptionOffsetX,originY:element.descriptionOffsetY,moved:false,pointerId:event.pointerId};}
      try{canvas.setPointerCapture(event.pointerId);}catch(_){ }redraw();
    },true);
    canvas.addEventListener('pointermove',function(event){
      if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();const point=pointerWorld(event);
      if(drag.type==='free'){const ref=freeById(drag.id);if(ref){ref.x=Math.round((drag.originX+point.x-drag.startX)/10)*10;ref.y=Math.round((drag.originY+point.y-drag.startY)/10)*10;drag.moved=true;}}
      else{const element=elementById(drag.id);if(element){element.descriptionOffsetX=drag.originX+point.x-drag.startX;element.descriptionOffsetY=drag.originY+point.y-drag.startY;drag.moved=true;}}
      redraw();
    },true);
    function finish(event){if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();if(drag.moved)dirty();drag=null;redraw();}
    canvas.addEventListener('pointerup',finish,true);canvas.addEventListener('pointercancel',finish,true);
    canvas.addEventListener('dblclick',function(event){if(state.simulationOn)return;const point=pointerWorld(event),free=freeHit(point),associated=associatedHit(point);if(!free&&!associated)return;event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();if(free){state.referenceTextSelectedId=free.id;openFreeModal(free.ref||freeById(free.id),false);}else{state.associatedDescriptionSelectedId=associated.id;openEditModalForElement(associated.element||elementById(associated.id));}},true);
  }
  function bindButtons(){
    const edit=document.getElementById('editLabel'),del=document.getElementById('deleteElement'),save=document.getElementById('saveEditModal'),aa=document.getElementById('addReferenceTextTop');
    if(aa&&!aa.__docBound){aa.__docBound=true;aa.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();beginFreeText();});}
    if(save)save.addEventListener('click',saveAssociated,true);
    if(edit)edit.addEventListener('click',function(event){
      if(state.referenceTextSelectedId){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();editFree();return;}
      if(state.associatedDescriptionSelectedId){const element=elementById(state.associatedDescriptionSelectedId);if(element){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();openEditModalForElement(element);}}
    },true);
    if(del)del.addEventListener('click',function(event){
      if(state.referenceTextSelectedId){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();deleteFree();return;}
      if(state.associatedDescriptionSelectedId){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();deleteAssociated();}
    },true);
    global.addEventListener('keydown',function(event){const tag=document.activeElement&&document.activeElement.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;if((event.key==='Delete'||event.key==='Backspace')&&state.referenceTextSelectedId){event.preventDefault();deleteFree();}else if((event.key==='Delete'||event.key==='Backspace')&&state.associatedDescriptionSelectedId){event.preventDefault();deleteAssociated();}else if(event.key==='Enter'&&state.referenceTextSelectedId){event.preventDefault();editFree();}else if(event.key==='Enter'&&state.associatedDescriptionSelectedId){const element=elementById(state.associatedDescriptionSelectedId);if(element){event.preventDefault();openEditModalForElement(element);}}});
    global.addEventListener('message',function(event){const message=event.data||{};if(message.type==='SIMUPLC_ADD_FREE_REFERENCE_TEXT'){beginFreeText();try{if(event.source)event.source.postMessage({type:'SIMUPLC_FREE_REFERENCE_TEXT_OPENED'},'*');}catch(_){ }}});
  }
  function init(){
    if(typeof state==='undefined'||typeof canvas==='undefined'||typeof ctx==='undefined')return;
    installStyle();addTopButton();createFreeModal();installAssociatedFields();normalizeAllElements();references();patchFunctions();bindPointer();bindButtons();redraw();
  }

  global.SimuPLCReferenceText=Object.freeze({add:beginFreeText,edit:editFree,remove:deleteFree,list:references});
  global.SimuPLCLadderAssociatedText=Object.freeze({remove:deleteAssociated});
  global.SimuPLCLadderDocumentation=Object.freeze({
    getFreeTexts:function(){return clone(references());},
    refresh:function(){normalizeAllElements();redraw();},
    getDiagnostics:function(){return Object.assign({ok:true,freeTextCount:references().length,associatedCount:allElements().filter(function(el){return !!ensureElement(el).description;}).length},diagnostics);}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
