#!/usr/bin/env python3
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
LOCAL_STORAGE_MOCK = """<script>
(function(){
  var data=new Map();
  var storage={getItem:function(k){return data.has(String(k))?data.get(String(k)):null;},setItem:function(k,v){data.set(String(k),String(v));},removeItem:function(k){data.delete(String(k));},clear:function(){data.clear();},key:function(i){return Array.from(data.keys())[i]||null;}};
  Object.defineProperty(storage,'length',{get:function(){return data.size;}});
  try{Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}catch(e){}
})();
</script>"""

def inline_assets(html: str) -> str:
    def repl(match):
        src = match.group(1).replace('./', '')
        target = ROOT / src
        return '<script>\n' + target.read_text(encoding='utf-8') + '\n</script>' if target.exists() else match.group(0)
    return re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', repl, html, flags=re.I)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    html=LOCAL_STORAGE_MOCK+inline_assets((ROOT/'index.html').read_text(encoding='utf-8'))
    html=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',html,flags=re.I)
    page.set_content(html,wait_until='load',timeout=120000)
    page.wait_for_timeout(5200)
    result=page.evaluate('''async () => {
      function reset(){
        if(window.SimuPLCFBDSimulation && SimuPLCFBDSimulation.isRunning()) SimuPLCFBDSimulation.stop({silent:true});
        clearAll();
      }
      function wire(fromNode,toNode,inputIndex){
        const c=SimuPLCFBDWiring.create(fromNode.output,toNode.inputs[inputIndex||0]);
        if(!c) throw new Error('No se pudo crear conexión');
        return c;
      }
      function active(node,on){ node.el.classList.toggle('active',!!on); }
      const tests={};

      reset();
      createNode('input',100,100); createNode('input',100,260); createNode('and',380,180); createNode('output',680,180);
      let [i1,i2,and,q1]=nodes; wire(i1,and,0); wire(i2,and,1); wire(and,q1,0);
      SimuPLCFBDSimulation.start(); active(i1,true); active(i2,true); SimuPLCFBDSimulation.scan();
      const andOn=and.value===1 && q1.value===1 && q1.el.classList.contains('active');
      active(i2,false); SimuPLCFBDSimulation.scan();
      tests.and={ok:andOn && and.value===0 && q1.value===0,on:andOn,off:and.value===0 && q1.value===0};
      SimuPLCFBDSimulation.stop({silent:true});

      reset();
      createNode('input',100,100); createNode('input',100,260); createNode('sr',380,180); createNode('output',680,180);
      let [s,r,sr,qs]=nodes; wire(s,sr,0); wire(r,sr,1); wire(sr,qs,0);
      SimuPLCFBDSimulation.start(); active(s,true); SimuPLCFBDSimulation.scan();
      const setOk=sr.value===1 && qs.value===1;
      active(s,false); SimuPLCFBDSimulation.scan(); const latchOk=sr.value===1 && qs.value===1;
      active(r,true); SimuPLCFBDSimulation.scan(); const resetOk=sr.value===0 && qs.value===0;
      tests.sr={ok:setOk&&latchOk&&resetOk,set:setOk,latch:latchOk,reset:resetOk};
      SimuPLCFBDSimulation.stop({silent:true});

      reset();
      createNode('input',100,180); createNode('ton',380,180); createNode('output',680,180);
      let [iton,ton,qton]=nodes; ton.delayMs=50; wire(iton,ton,0); wire(ton,qton,0);
      SimuPLCFBDSimulation.start(); active(iton,true); SimuPLCFBDSimulation.scan(); const tonBefore=ton.value===0;
      await new Promise(resolve=>setTimeout(resolve,80)); SimuPLCFBDSimulation.scan(); const tonAfter=ton.value===1 && qton.value===1;
      active(iton,false); SimuPLCFBDSimulation.scan(); const tonReset=ton.value===0 && qton.value===0;
      tests.ton={ok:tonBefore&&tonAfter&&tonReset,before:tonBefore,after:tonAfter,reset:tonReset};
      SimuPLCFBDSimulation.stop({silent:true});

      reset();
      createNode('input',100,180); createNode('toff',380,180); createNode('output',680,180);
      let [itoff,toff,qtoff]=nodes; toff.delayMs=50; wire(itoff,toff,0); wire(toff,qtoff,0);
      SimuPLCFBDSimulation.start(); active(itoff,true); SimuPLCFBDSimulation.scan(); const toffOn=toff.value===1 && qtoff.value===1;
      active(itoff,false); SimuPLCFBDSimulation.scan(); const toffHold=toff.value===1 && qtoff.value===1;
      await new Promise(resolve=>setTimeout(resolve,80)); SimuPLCFBDSimulation.scan(); const toffOff=toff.value===0 && qtoff.value===0;
      tests.toff={ok:toffOn&&toffHold&&toffOff,on:toffOn,hold:toffHold,off:toffOff};
      SimuPLCFBDSimulation.stop({silent:true});

      reset();
      createNode('input',80,80); createNode('input',80,200); createNode('input',80,320); createNode('cnt',380,200); createNode('output',680,200);
      let [ires,icnt,idir,cnt,qcnt]=nodes; wire(ires,cnt,0); wire(icnt,cnt,1); wire(idir,cnt,2); wire(cnt,qcnt,0);
      SimuPLCFBDSimulation.start(); active(icnt,true); SimuPLCFBDSimulation.scan(); const up1=cnt.cv===1 && cnt.value===1 && qcnt.value===1;
      active(icnt,false); SimuPLCFBDSimulation.scan(); active(icnt,true); SimuPLCFBDSimulation.scan(); const up2=cnt.cv===2;
      active(icnt,false); SimuPLCFBDSimulation.scan(); active(idir,true); active(icnt,true); SimuPLCFBDSimulation.scan(); const down=cnt.cv===1;
      active(ires,true); SimuPLCFBDSimulation.scan(); const counterReset=cnt.cv===0 && cnt.value===0 && qcnt.value===0;
      tests.counter={ok:up1&&up2&&down&&counterReset,up1:up1,up2:up2,down:down,reset:counterReset};
      SimuPLCFBDSimulation.stop({silent:true});

      const diagnostics=SimuPLCFBDSimulation.getDiagnostics();
      return {ok:Object.values(tests).every(t=>t.ok),tests,diagnostics,runningAfterStop:SimuPLCFBDSimulation.isRunning()};
    }''')
    browser.close()
    output={'result':result,'pageErrors':errors}
    print(json.dumps(output,ensure_ascii=False,indent=2))
    if errors or not result.get('ok') or result.get('runningAfterStop'):
        raise SystemExit(1)
