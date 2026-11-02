#!/usr/bin/env python3
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});}catch(e){}})();</script>"""

def inline(html):
    def script(match):
        target=ROOT/match.group(1).replace('./','')
        return '<script>'+target.read_text(encoding='utf-8')+'</script>' if target.exists() else match.group(0)
    def css(match):
        target=ROOT/match.group(1).replace('./','')
        return '<style>'+target.read_text(encoding='utf-8')+'</style>' if target.exists() else match.group(0)
    html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',script,html,flags=re.I)
    html=re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',css,html,flags=re.I)
    return html

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':850})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=180000)
    page.wait_for_timeout(2000)
    result=page.evaluate("""() => {
      resetDemoProject();
      state.ladder.rungs=[{id:'r1',elements:[]}]; state.proWires=[]; state.proJunctions=[]; state.coilStates={}; state.simValues={};
      const ai=buildPendingElement('analog_input'); ai.id='ai1'; ai.label='AI1'; ai.x=260; ai.y=220; ai.rawMin=0; ai.rawMax=4095; ai.engMin=0; ai.engMax=100; ai.rawValue=4095; ai.outputMode='scaled'; ai.unit='%';
      const scale=buildPendingElement('scale'); scale.id='s1'; scale.label='SCL1'; scale.x=470; scale.y=220; scale.inMin=0; scale.inMax=100; scale.outMin=0; scale.outMax=200; scale.unit='°C';
      const gt=buildPendingElement('gt'); gt.id='g1'; gt.label='GT1'; gt.x=680; gt.y=220; gt.threshold=150; gt.unit='°C';
      const q=buildPendingElement('COIL'); q.id='q1'; q.label='Q1'; q.x=890; q.y=220;
      state.ladder.rungs[0].elements.push(ai,scale,gt,q);
      drawCanvasOnly();
      state.proWires=[
        {id:'w1',from:proPinId(ai,'out'),to:proPinId(scale,'in'),points:[],routeVersion:2,signalType:'analog'},
        {id:'w2',from:proPinId(scale,'out'),to:proPinId(gt,'in'),points:[],routeVersion:2,signalType:'analog'},
        {id:'w3',from:proPinId(gt,'out'),to:proPinId(q,'in'),points:[],routeVersion:2,signalType:'digital'}
      ];
      state.simulationOn=true;
      drawCanvasOnly();
      const scan=computeFreeSimulation();
      const proc=window.SimuPLCLadderAnalogProcessing;
      const pinAi=getProPinById(proPinId(ai,'out'));
      const pinQ=getProPinById(proPinId(q,'in'));
      const invalid=proc.validateConnection(pinAi,pinQ);
      const types=Array.from(document.querySelectorAll('.ladder-lib-section[data-family="analog"] [data-ladder-type]')).map(n=>n.getAttribute('data-ladder-type'));
      return {
        service:!!proc,
        types,
        scale:state.analogElementRuntime.s1,
        gt:state.analogElementRuntime.g1,
        q1:!!state.coilStates.Q1,
        scanGt:scan.elements.g1,
        analogWires:Object.keys(state.analogWireValues||{}),
        invalid,
        diagnostics:proc.getDiagnostics()
      };
    }""")
    hyst=page.evaluate("""() => {
      if(state.simulationOn) state.simulationOn=false;
      state.ladder.rungs=[{id:'r1',elements:[]}];state.proWires=[];state.proJunctions=[];state.coilStates={};
      const ai=buildPendingElement('analog_input');ai.id='ai2';ai.label='AI2';ai.x=260;ai.y=420;ai.rawMin=0;ai.rawMax=100;ai.engMin=0;ai.engMax=100;ai.outputMode='scaled';ai.rawValue=30;
      const h=buildPendingElement('hyst');h.id='h1';h.label='HYS1';h.x=500;h.y=420;h.low=40;h.high=60;h.unit='%';
      const q=buildPendingElement('COIL');q.id='q2';q.label='Q2';q.x=740;q.y=420;
      state.ladder.rungs[0].elements.push(ai,h,q);drawCanvasOnly();
      state.proWires=[{id:'ha',from:proPinId(ai,'out'),to:proPinId(h,'in'),points:[],signalType:'analog'},{id:'hd',from:proPinId(h,'out'),to:proPinId(q,'in'),points:[],signalType:'digital'}];
      state.simulationOn=true;
      function step(v){ai.rawValue=v;drawCanvasOnly();computeFreeSimulation();return !!state.coilStates.Q2;}
      return {at30:step(30),at50Before:step(50),at60:step(60),at50After:step(50),at40:step(40)};
    }""")
    compact=page.evaluate("""() => {
      const ai=state.ladder.rungs[0].elements.find(e=>e.type==='analog_input');
      window.SimuPLCLadderAnalogInput.openQuickControl(ai,{clientX:420,clientY:300});
      const overlay=document.getElementById('ladderAiQuickOverlay');
      const card=overlay.querySelector('.ladder-ai-quick-card');
      const os=getComputedStyle(overlay),cs=getComputedStyle(card),r=card.getBoundingClientRect();
      return {show:overlay.classList.contains('show'),background:os.backgroundColor,pointerEvents:os.pointerEvents,width:r.width,height:r.height,position:cs.position};
    }""")
    browser.close()

required={'analog_input','scale','gt','lt','eq','gte','lte','hyst'}
ok=(not errors and result['service'] and required.issubset(set(result['types'])) and result['q1'] and abs(result['scale']['outputValue']-200)<0.001 and result['gt']['digitalOutput'] and set(result['analogWires'])=={'w1','w2'} and not result['invalid']['ok'] and not hyst['at30'] and not hyst['at50Before'] and hyst['at60'] and hyst['at50After'] and not hyst['at40'] and compact['show'] and compact['background']=='rgba(0, 0, 0, 0)' and compact['height']<180)
print(json.dumps({'ok':ok,'processing':result,'hysteresis':hyst,'compact':compact,'pageErrors':errors},ensure_ascii=False,indent=2))
raise SystemExit(0 if ok else 1)
