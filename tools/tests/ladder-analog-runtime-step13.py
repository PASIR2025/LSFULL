#!/usr/bin/env python3
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
MOCK = """<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});}catch(e){}})();</script>"""

def inline(html):
    def script(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<script>' + target.read_text(encoding='utf-8') + '</script>' if target.exists() else match.group(0)
    def css(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<style>' + target.read_text(encoding='utf-8') + '</style>' if target.exists() else match.group(0)
    html = re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script, html, flags=re.I)
    return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', css, html, flags=re.I)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1200, 'height': 760})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(MOCK + inline((ROOT / 'ladder_mobile_compact.html').read_text(encoding='utf-8')), wait_until='load', timeout=180000)
    page.wait_for_timeout(1200)
    result = page.evaluate("""() => {
      resetDemoProject();
      state.ladder.rungs=[{id:'r',elements:[]}]; state.proWires=[]; state.proJunctions=[]; state.coilStates={};
      const ai=buildPendingElement('analog_input'); Object.assign(ai,{id:'ai',label:'AI1',x:280,y:250,rawMin:0,rawMax:100,engMin:0,engMax:100,rawValue:50,outputMode:'scaled',unit:'°C'});
      const ge=buildPendingElement('gte'); Object.assign(ge,{id:'ge',label:'GE1',x:520,y:250,threshold:50,unit:'°C'});
      const q=buildPendingElement('COIL'); Object.assign(q,{id:'q',label:'Q1',x:760,y:250});
      state.ladder.rungs[0].elements.push(ai,ge,q); drawCanvasOnly();
      const first=completeProConnection(getProPinById('ai:out'),getProPinById('ge:in'));
      const second=completeProConnection(getProPinById('ge:out'),getProPinById('q:in'));
      // Simula un cable guardado por una versión que no incluía signalType.
      state.proWires[0].signalType=undefined;
      state.freeSelectedId=ge.id; state.selectedId=ge.id; state.simulationOn=true;
      const originalArc=CanvasRenderingContext2D.prototype.arc, arcs=[];
      CanvasRenderingContext2D.prototype.arc=function(x,y,r){arcs.push({x,y,r});return originalArc.apply(this,arguments);};
      const cycles=[];
      for(let index=0;index<6;index+=1){
        drawCanvasOnly();
        cycles.push({
          index,
          input:state.analogElementRuntime.ge && state.analogElementRuntime.ge.inputValue,
          comparator:!!(state.analogElementRuntime.ge && state.analogElementRuntime.ge.digitalOutput),
          coil:!!state.coilStates.Q1,
          drawCoil:!!(state._sim && state._sim.coils && state._sim.coils.Q1)
        });
      }
      CanvasRenderingContext2D.prototype.arc=originalArc;
      const pinCenters=(state.proPins||[]).filter(pin=>pin.kind!=='junction').map(pin=>({x:pin.x,y:pin.y}));
      const pinArcs=arcs.filter(arc=>pinCenters.some(pin=>Math.abs(pin.x-arc.x)<.01&&Math.abs(pin.y-arc.y)<.01));
      return {
        connections:[first.ok,second.ok],
        cycles,
        pinArcs:pinArcs.length,
        analogWireType:state.proWires[0].signalType,
        digitalWireEnergized:!!state.proWires[1].energized,
        topology:state.analogTopologyDiagnostics
      };
    }""")
    page.screenshot(path=str(ROOT / 'docs/ladder-analog-signal-fixed.png'), full_page=True)
    browser.close()

ok = (
    not errors and all(result['connections']) and result['pinArcs'] == 0 and
    result['analogWireType'] == 'analog' and result['digitalWireEnergized'] and
    all(cycle['input'] == 50 and cycle['comparator'] and cycle['coil'] and cycle['drawCoil'] for cycle in result['cycles'])
)
print(json.dumps({'ok': ok, 'result': result, 'pageErrors': errors, 'screenshot': 'docs/ladder-analog-signal-fixed.png'}, ensure_ascii=False, indent=2))
raise SystemExit(0 if ok else 1)
