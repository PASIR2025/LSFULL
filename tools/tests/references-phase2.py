#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});}catch(e){}})();</script>"""

def inline(html):
 def repl(m):
  p=ROOT/m.group(1).replace('./','')
  return '<script>\n'+p.read_text(encoding='utf-8')+'\n</script>' if p.exists() else m.group(0)
 def css(m):
  p=ROOT/m.group(1).replace('./','')
  return '<style>\n'+p.read_text(encoding='utf-8')+'\n</style>' if p.exists() else m.group(0)
 html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',repl,html,flags=re.I)
 return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',css,html,flags=re.I)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 out={'fbd':{},'ladder':{},'errors':{'fbd':[],'ladder':[]}}

 page=browser.new_page(viewport={'width':1440,'height':900})
 page.on('pageerror',lambda e:out['errors']['fbd'].append(str(e)))
 html=MOCK+inline((ROOT/'index.html').read_text(encoding='utf-8'))
 html=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',html,flags=re.I)
 page.set_content(html,wait_until='load',timeout=120000)
 page.wait_for_timeout(6000)
 out['fbd']=page.evaluate('''() => {
   clearAll();
   createNode('and',420,300);
   const n=nodes[0];
   selectNode(n);
   document.getElementById('btnEdit').click();
   document.getElementById('editIOLabel').value='Control de bomba principal';
   document.getElementById('editDescriptionFormat').value='title';
   document.getElementById('editDescriptionFont').value='Verdana';
   document.getElementById('editDescriptionSize').value='18';
   document.getElementById('editDescriptionWidth').value='320';
   document.getElementById('editDescriptionBold').checked=true;
   document.getElementById('editDescriptionItalic').checked=true;
   SimuPLCTextPalette.set(document,'editDescriptionColor','#003366');
   SimuPLCTextPalette.set(document,'editDescriptionBg','#eaf2ff');
   document.getElementById('btnEditSave').click();

   const associated=n.el.querySelector('.node-associated-description');
   const associatedBefore={
     text:associated&&associated.textContent,
     format:n.descriptionFormat,font:n.descriptionFontFamily,size:n.descriptionFontSize,
     width:n.descriptionMaxWidth,bold:n.descriptionBold,italic:n.descriptionItalic,
     color:n.descriptionColor,background:n.descriptionBackground
   };

   SimuPLCFbdDocumentation.beginText();
   document.getElementById('fbdTextValue').value='ARRANQUE AUTOMÁTICO';
   document.getElementById('fbdTextFormat').value='title';
   document.getElementById('fbdTextFont').value='Arial';
   document.getElementById('fbdTextSize').value='30';
   document.getElementById('fbdTextWidth').value='520';
   document.getElementById('fbdTextBold').checked=true;
   SimuPLCTextPalette.set(document.getElementById('fbdTextModal'),'fbdTextColor','#ffffff');
   SimuPLCTextPalette.set(document.getElementById('fbdTextModal'),'fbdTextBg','#003366');
   document.getElementById('fbdTextSave').click();

   const free=document.querySelector('.fbd-free-text');
   const canonical=serializeFBD();
   const saved=JSON.parse(JSON.stringify(canonical));
   clearAll();
   loadFromData(saved);
   const restored=nodes[0];
   const restoredAssociated=restored.el.querySelector('.node-associated-description');
   const restoredFree=document.querySelector('.fbd-free-text');

   clearAll();
   loadFromData({nodes:[{id:'legacy1',type:'and',x:300,y:220,reference:'Referencia antigua',params:{}}],connections:[]});
   const migrated=nodes[0];

   return {
     aaExists:!!document.getElementById('btnReferenceText'),
     associatedBefore,
     associatedClass:associated&&associated.className,
     freeText:free&&free.textContent,
     freeClass:free&&free.className,
     canonicalDescription:saved.nodes[0].description,
     canonicalDescriptionParams:saved.nodes[0].params&&saved.nodes[0].params.description,
     canonicalFreeTexts:saved.freeTexts,
     restoredDescription:restored.description,
     restoredAssociated:restoredAssociated&&restoredAssociated.textContent,
     restoredFree:restoredFree&&restoredFree.textContent,
     migratedDescription:migrated.description,
     diagnostics:SimuPLCFbdDocumentation.getDiagnostics(),
     ok:!!associated && associated.textContent==='Control de bomba principal'
       && n.descriptionFormat==='title' && n.descriptionFontFamily==='Verdana'
       && n.descriptionFontSize===18 && n.descriptionMaxWidth===320
       && n.descriptionBold===true && n.descriptionItalic===true
       && n.descriptionColor==='#003366' && n.descriptionBackground==='#eaf2ff'
       && !!free && free.textContent==='ARRANQUE AUTOMÁTICO'
       && Array.isArray(saved.freeTexts) && saved.freeTexts.length===1
       && saved.freeTexts[0].format==='title' && saved.freeTexts[0].fontSize===30
       && saved.nodes[0].description==='Control de bomba principal'
       && restored.description==='Control de bomba principal'
       && restoredAssociated && restoredAssociated.textContent==='Control de bomba principal'
       && restoredFree && restoredFree.textContent==='ARRANQUE AUTOMÁTICO'
       && migrated.description==='Referencia antigua'
   };
 }''')
 page.close()

 page=browser.new_page(viewport={'width':1400,'height':900})
 page.on('pageerror',lambda e:out['errors']['ladder'].append(str(e)))
 html=MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8'))
 page.set_content(html,wait_until='load',timeout=120000)
 page.wait_for_timeout(5500)
 out['ladder']=page.evaluate('''async () => {
   const element=makeElement('NO','I1');
   element.x=420;element.y=300;
   state.ladder={version:3,type:'ladder-free-pro-industrial',rungs:[{id:'r1',elements:[element]}],proWires:[],referenceTexts:[]};
   state.selectedId=element.id;state.freeSelectedId=element.id;
   openEditModalForElement(element);
   document.getElementById('editReferenceInput').value='Pulsador de arranque';
   document.getElementById('editDescriptionFormat').value='comment';
   document.getElementById('editDescriptionFont').value='Verdana';
   document.getElementById('editDescriptionSize').value='18';
   document.getElementById('editDescriptionWidth').value='320';
   document.getElementById('editDescriptionBold').checked=true;
   document.getElementById('editDescriptionItalic').checked=true;
   SimuPLCTextPalette.set(document,'editDescriptionColor','#003366');
   SimuPLCTextPalette.set(document,'editDescriptionBg','#eaf2ff');
   saveEditModalChanges();

   SimuPLCReferenceText.add();
   document.getElementById('referenceTextInput').value='TABLERO DE CONTROL';
   document.getElementById('referenceTextFormat').value='title';
   document.getElementById('referenceTextFont').value='Arial';
   document.getElementById('referenceTextSize').value='30';
   document.getElementById('referenceTextWidth').value='520';
   document.getElementById('referenceTextBold').checked=true;
   SimuPLCTextPalette.set(document.getElementById('referenceTextOverlay'),'referenceTextColor','#ffffff');
   SimuPLCTextPalette.set(document.getElementById('referenceTextOverlay'),'referenceTextBg','#003366');
   document.getElementById('saveReferenceText').click();

   window.__docDraw=[];
   const old=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(t,x,y){window.__docDraw.push(String(t));return old.call(this,t,x,y);};
   draw(); await new Promise(resolve=>setTimeout(resolve,250));
   CanvasRenderingContext2D.prototype.fillText=old;

   const serialized=getSerializableLadder();
   const saved=JSON.parse(JSON.stringify(serialized));
   tryLoadModel(saved);draw();await new Promise(resolve=>setTimeout(resolve,150));
   const restored=state.ladder.rungs[0].elements[0];
   const restoredText=state.ladder.referenceTexts[0];

   tryLoadModel({version:3,type:'ladder-free-pro-industrial',rungs:[{id:'r2',elements:[{id:'e2',type:'NO',label:'I2',reference:'Parada general',x:300,y:220}]}],proWires:[]});
   const migrated=state.ladder.rungs[0].elements[0];

   return {
     aaExists:!!document.getElementById('addReferenceTextTop'),
     description:element.description,format:element.descriptionFormat,font:element.descriptionFontFamily,
     size:element.descriptionFontSize,width:element.descriptionMaxWidth,bold:element.descriptionBold,
     italic:element.descriptionItalic,color:element.descriptionColor,background:element.descriptionBackground,
     drawnAssociated:window.__docDraw.includes('Pulsador de arranque'),
     drawnFree:window.__docDraw.includes('TABLERO DE CONTROL'),
     serializedDescription:saved.rungs[0].elements[0].description,
     serializedTexts:saved.referenceTexts,
     restoredDescription:restored.description,
     restoredFree:restoredText&&restoredText.text,
     migratedDescription:migrated.description,
     diagnostics:SimuPLCLadderDocumentation.getDiagnostics(),
     ok:element.description==='Pulsador de arranque'
       && element.descriptionFormat==='comment' && element.descriptionFontFamily==='Verdana'
       && element.descriptionFontSize===18 && element.descriptionMaxWidth===320
       && element.descriptionBold===true && element.descriptionItalic===true
       && element.descriptionColor==='#003366' && element.descriptionBackground==='#eaf2ff'
       && window.__docDraw.includes('Pulsador de arranque')
       && window.__docDraw.includes('TABLERO DE CONTROL')
       && saved.rungs[0].elements[0].description==='Pulsador de arranque'
       && Array.isArray(saved.referenceTexts) && saved.referenceTexts.length===1
       && saved.referenceTexts[0].text==='TABLERO DE CONTROL'
       && restored.description==='Pulsador de arranque'
       && restoredText && restoredText.text==='TABLERO DE CONTROL'
       && migrated.description==='Parada general'
   };
 }''')
 page.close();browser.close()
 print(json.dumps(out,ensure_ascii=False,indent=2))
 if out['errors']['fbd'] or out['errors']['ladder'] or not out['fbd'].get('ok') or not out['ladder'].get('ok'):
  raise SystemExit(1)
