#!/usr/bin/env python3
import re,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var data=new Map([['logicsoft_full_v1','1']]);var storage={getItem:function(k){k=String(k);return data.has(k)?data.get(k):null;},setItem:function(k,v){data.set(String(k),String(v));},removeItem:function(k){data.delete(String(k));},clear:function(){data.clear();},key:function(i){return Array.from(data.keys())[i]||null;}};Object.defineProperty(storage,'length',{get:function(){return data.size;}});try{Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}catch(e){}window.isFull=true;})();</script>"""
def inline_assets(html):
 def sr(m):
  src=m.group(1).split('?',1)[0].replace('./',''); p=ROOT/src
  return '<script>\n'+p.read_text(encoding='utf-8')+'\n</script>' if p.exists() else m.group(0)
 def cr(m):
  href=m.group(1).split('?',1)[0].replace('./',''); p=ROOT/href
  return '<style>\n'+p.read_text(encoding='utf-8')+'\n</style>' if p.exists() else m.group(0)
 html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sr,html,flags=re.I)
 html=re.sub(r'<link[^>]+href=["\']([^"\']+\.css(?:\?[^"\']*)?)["\'][^>]*>',cr,html,flags=re.I)
 return html
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=MOCK+inline_assets((ROOT/'index.html').read_text(encoding='utf-8'))
 html=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',html,flags=re.I)
 page.set_content(html,wait_until='load',timeout=120000);page.wait_for_timeout(3500)
 res=page.evaluate('''async()=>{
  localStorage.setItem('logicsoft_full_v1','1'); window.isFull=true; document.getElementById('modeHMIBtn').click(); await new Promise(r=>setTimeout(r,150));
  window.__fakeHmiState={ready:true,inputs:{},outputs:{Q1:false,Q2:false,Q3:false,Q4:false},physicalInputs:{},hmiInputs:{},analogInputs:{},analogOutputs:{},analogRuntime:{},simulationOn:true,receivedAt:Date.now()};
  window.SimuPLCExternalIO={isConnected:()=>true,getState:()=>window.__fakeHmiState,requestStateThrottled:()=>{},sendInput:async()=>{},sendAnalogInput:async()=>{}};
  const project={type:'simuplc-hmi-v1',version:33,name:'Prueba animación',template:'blank',source:'fbd',mode:'design',canvas:{width:1200,height:720},elements:[
   {id:'door1',type:'vertical-door',label:'PORTON',tag:'Q1',tag2:'Q2',tag3:'I5',tag4:'I6',doorMode:'digital',position:0,speed:100,x:50,y:40,w:300,h:390,color:'gray'},
   {id:'cyl1',type:'cylinder',label:'PISTON',tag:'Q3',tag2:'Q4',tag3:'I7',tag4:'I8',position:0,speed:100,x:400,y:120,w:330,h:170,color:'gray',retractSensorPos:12,extendSensorPos:88}
  ]};
  window.SimuPLCHMI.loadProject(project); window.SimuPLCHMI.start();
  window.__fakeHmiState.outputs.Q1=true;window.__fakeHmiState.outputs.Q3=true;window.__fakeHmiState.receivedAt=Date.now();
  await new Promise(r=>setTimeout(r,700));
  const p1=window.SimuPLCHMI.getProject(); const dbg={running:window.SimuPLCHMI.isRunning(),operation:window.SimuPLCHMI.isOperationMode(),extConnected:window.SimuPLCExternalIO.isConnected(),extState:window.SimuPLCExternalIO.getState(),badge:document.getElementById('hmiConnectionBadge')&&document.getElementById('hmiConnectionBadge').textContent};
  const door=document.querySelector('[data-id="door1"]'),cyl=document.querySelector('[data-id="cyl1"]');
  const panel=door&&door.querySelector('.hmi-door-panel'),frame=door&&door.querySelector('.hmi-door-frame'),rod=cyl&&cyl.querySelector('.hmi-cylinder-rod'),head=cyl&&cyl.querySelector('.hmi-cylinder-rod-end');
  if(!door||!cyl||!panel||!frame||!rod||!head)return {missing:true,ids:[...document.querySelectorAll('#hmiCanvas [data-id]')].map(n=>n.dataset.id),p1};
  const up={doorPos:p1.elements.find(e=>e.id==='door1').position,cylPos:p1.elements.find(e=>e.id==='cyl1').position,panelTransform:panel.style.transform,frameVar:frame.style.getPropertyValue('--door-y'),rodWidth:rod.style.width,headLeft:head.style.left};
  window.__fakeHmiState.outputs.Q1=false;window.__fakeHmiState.outputs.Q3=false;window.__fakeHmiState.outputs.Q2=true;window.__fakeHmiState.outputs.Q4=true;window.__fakeHmiState.receivedAt=Date.now();
  await new Promise(r=>setTimeout(r,700));
  const p2=window.SimuPLCHMI.getProject();
  const down={doorPos:p2.elements.find(e=>e.id==='door1').position,cylPos:p2.elements.find(e=>e.id==='cyl1').position,panelTransform:panel.style.transform,frameVar:frame.style.getPropertyValue('--door-y'),rodWidth:rod.style.width,headLeft:head.style.left};
  return {up,down,dbg};
 }''')
 print(json.dumps({'result':res,'errors':errors},indent=2,ensure_ascii=False))
 ok=(not errors and not res.get('missing') and res['up']['doorPos']>30 and res['up']['cylPos']>30 and 'translate3d' in res['up']['panelTransform'] and float(res['up']['rodWidth'].rstrip('%'))>20 and res['down']['doorPos']<res['up']['doorPos'] and res['down']['cylPos']<res['up']['cylPos'])
 b.close(); raise SystemExit(0 if ok else 1)
