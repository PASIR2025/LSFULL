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
HTML=MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8'))
def setup(page, mobile=False):
 page.set_content(HTML,wait_until='load',timeout=180000);page.wait_for_timeout(1400)
 result=page.evaluate("""() => {
   resetDemoProject();
   state.ladder.rungs=[{id:'r1',elements:[]}];state.proWires=[];state.proJunctions=[];state.coilStates={};state.simValues={};
   const ai=buildPendingElement('analog_input');ai.id='ai1';ai.label='AI1';ai.reference='Sensor de temperatura';ai.description='Sensor de temperatura';ai.x=260;ai.y=230;ai.rawMin=0;ai.rawMax=4095;ai.engMin=0;ai.engMax=100;ai.rawValue=3072;ai.outputMode='scaled';ai.unit='°C';ai.decimals=1;
   const scale=buildPendingElement('scale');scale.id='scale1';scale.label='SCALE1';scale.reference='Escalamiento';scale.description='Escalamiento';scale.x=485;scale.y=230;scale.inMin=0;scale.inMax=100;scale.outMin=0;scale.outMax=100;scale.unit='°C';
   const cmp=buildPendingElement('gte');cmp.id='cmp1';cmp.label='≥';cmp.reference='Temperatura alta';cmp.description='Temperatura alta';cmp.x=710;cmp.y=230;cmp.threshold=70;cmp.unit='°C';
   const q=buildPendingElement('COIL');q.id='q1';q.label='Q1';q.reference='Ventilador';q.description='Ventilador';q.x=930;q.y=230;
   state.ladder.rungs[0].elements.push(ai,scale,cmp,q);drawCanvasOnly();
   state.proWires=[
    {id:'w1',from:proPinId(ai,'out'),to:proPinId(scale,'in'),points:[],routeVersion:2,signalType:'analog'},
    {id:'w2',from:proPinId(scale,'out'),to:proPinId(cmp,'in'),points:[],routeVersion:2,signalType:'analog'},
    {id:'w3',from:proPinId(cmp,'out'),to:proPinId(q,'in'),points:[],routeVersion:2,signalType:'digital'}
   ];
   state.simulationOn=true;drawCanvasOnly();computeFreeSimulation();
   document.body.classList.add('library-collapsed');
   window.SimuPLCLadderAnalogInput.openQuickControl(ai,{clientX:360,clientY:380});
   const sup=[...document.querySelectorAll('button')].filter(b=>/ACTIVA FUNCIONES/i.test(b.textContent)).map(b=>({id:b.id,cls:b.className,display:getComputedStyle(b).display,body:document.body.className})); return {q:!!state.coilStates.Q1,quick:document.getElementById('ladderAiQuickOverlay')?.classList.contains('show'),sup};
 }""")
 page.wait_for_timeout(400)
 return result
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 errors=[]
 d=b.new_page(viewport={'width':1365,'height':850});d.on('pageerror',lambda e:errors.append(str(e)));dr=setup(d);d.screenshot(path=str(ROOT/'docs/ladder-analog-complete.png'),full_page=True)
 m=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1);m.on('pageerror',lambda e:errors.append(str(e)));mr=setup(m,True);m.screenshot(path=str(ROOT/'docs/ladder-ai-compact-mobile.png'),full_page=True)
 b.close()
 ok=dr['q'] and dr['quick'] and mr['q'] and mr['quick'] and all(x['display']=='none' for x in dr.get('sup',[])+mr.get('sup',[])) and not errors
 print(json.dumps({'ok':ok,'desktop':dr,'mobile':mr,'pageErrors':errors,'screenshots':['docs/ladder-analog-complete.png','docs/ladder-ai-compact-mobile.png']},ensure_ascii=False,indent=2))
 raise SystemExit(0 if ok else 1)
