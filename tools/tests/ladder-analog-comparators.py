#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});}catch(e){}})();</script>"""
def inline(h):
 def sc(m):
  p=ROOT/m.group(1).replace('./','');return '<script>'+p.read_text(encoding='utf-8')+'</script>' if p.exists() else m.group(0)
 def cs(m):
  p=ROOT/m.group(1).replace('./','');return '<style>'+p.read_text(encoding='utf-8')+'</style>' if p.exists() else m.group(0)
 h=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sc,h,flags=re.I)
 return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',cs,h,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 pg=b.new_page(viewport={'width':1280,'height':900});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content(MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=180000);pg.wait_for_timeout(1400)
 result=pg.evaluate("""() => {
   const service=SimuPLCLadderAnalogProcessing;
   function run(type,value,config){
     resetDemoProject();state.ladder.rungs=[{id:'r',elements:[]}];state.proWires=[];state.proJunctions=[];state.coilStates={};
     const ai=buildPendingElement('analog_input');ai.id='ai';ai.label='AI1';ai.x=260;ai.y=200;ai.rawMin=0;ai.rawMax=100;ai.engMin=0;ai.engMax=100;ai.rawValue=value;ai.outputMode='scaled';
     const cmp=buildPendingElement(type);cmp.id='cmp';cmp.x=520;cmp.y=200;Object.assign(cmp,config||{});
     const q=buildPendingElement('COIL');q.id='q';q.label='Q1';q.x=780;q.y=200;
     state.ladder.rungs[0].elements.push(ai,cmp,q);drawCanvasOnly();
     state.proWires=[{id:'a',from:proPinId(ai,'out'),to:proPinId(cmp,'in'),points:[],signalType:'analog'},{id:'d',from:proPinId(cmp,'out'),to:proPinId(q,'in'),points:[],signalType:'digital'}];state.simulationOn=true;drawCanvasOnly();computeFreeSimulation();return !!state.coilStates.Q1;
   }
   const tests={
     gtOff:run('gt',50,{threshold:50}),gtOn:run('gt',51,{threshold:50}),
     ltOn:run('lt',49,{threshold:50}),ltOff:run('lt',50,{threshold:50}),
     eqOn:run('eq',50.4,{threshold:50,tolerance:.5}),eqOff:run('eq',50.6,{threshold:50,tolerance:.5}),
     gteOn:run('gte',50,{threshold:50}),gteOff:run('gte',49,{threshold:50}),
     lteOn:run('lte',50,{threshold:50}),lteOff:run('lte',51,{threshold:50})
   };
   // Roundtrip + modal
   state.simulationOn=false;
   resetDemoProject();state.ladder.rungs=[{id:'r',elements:[]}];const e=buildPendingElement('scale');e.id='scale1';e.x=450;e.y=250;e.inMin=0;e.inMax=4095;e.outMin=-20;e.outMax=80;e.unit='°C';state.ladder.rungs[0].elements.push(e);drawCanvasOnly();state.freeSelectedId=e.id;state.selectedId=e.id;openEditModalFromSelection();
   const modal={shown:editOverlay.classList.contains('show'),fields:getComputedStyle(document.getElementById('ladderAnalogProcessingFields')).display};
   document.getElementById('ladderAnalogOutMax').value='120';document.getElementById('ladderAnalogUnit').value='bar';document.getElementById('saveEditModal').click();
   const model=getSerializableLadder();resetDemoProject();tryLoadModel(model);const loaded=state.ladder.rungs[0].elements[0];
   return {tests,modal,loaded:{type:loaded.type,inMin:loaded.inMin,inMax:loaded.inMax,outMin:loaded.outMin,outMax:loaded.outMax,unit:loaded.unit}};
 }""")
 b.close()
expected={'gtOff':False,'gtOn':True,'ltOn':True,'ltOff':False,'eqOn':True,'eqOff':False,'gteOn':True,'gteOff':False,'lteOn':True,'lteOff':False}
ok=not errors and result['tests']==expected and result['modal']['shown'] and result['modal']['fields']=='grid' and result['loaded']['type']=='scale' and result['loaded']['outMax']==120 and result['loaded']['unit']=='bar'
print(json.dumps({'ok':ok,'result':result,'pageErrors':errors},ensure_ascii=False,indent=2));raise SystemExit(0 if ok else 1)
