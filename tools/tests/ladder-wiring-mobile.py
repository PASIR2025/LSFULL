#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SHOT=ROOT/'docs'/'ladder-wiring-mobile.png'
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});}catch(e){}})();</script>"""
def inline(h):
 def r(m):
  f=ROOT/m.group(1).replace('./','')
  return '<script>'+f.read_text(encoding='utf-8')+'</script>' if f.exists() else m.group(0)
 return re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',r,h,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=120000)
 page.wait_for_timeout(2000)
 out=page.evaluate('''async()=>{
  resetDemoProject();
  setPendingType('NO'); addElementAtPointer(350,270);
  setPendingType('COIL'); addElementAtPointer(720,270);
  setPendingType('NO'); addElementAtPointer(530,460);
  await new Promise(r=>setTimeout(r,60)); drawCanvasOnly();
  const e=state.ladder.rungs[0].elements, a=e[0], q=e[1], b=e[2], pin=id=>getProPinById(id), click=p=>handleProPointerDown({x:p.x,y:p.y});
  click(pin(q.id+':in')); click(pin(a.id+':out'));
  click(pin('rail:left:2')); click(pin(b.id+':in'));
  let w=state.proWires.find(x=>(x.from===a.id+':out'&&x.to===q.id+':in')||(x.to===a.id+':out'&&x.from===q.id+':in'));
  let pts=wirePointsFor(w), hi=pts.findIndex((p,i)=>i<pts.length-1&&Math.abs(p.y-pts[i+1].y)<.01);
  const tap={x:(pts[hi].x+pts[hi+1].x)/2,y:pts[hi].y}; click(tap); click(pin(b.id+':out')); drawCanvasOnly();
  let j=state.proJunctions[0], old={x:j.x,y:j.y};
  handleProPointerDown({x:j.x,y:j.y}); handleProPointerMove({x:j.x+42,y:j.y+80}); handleProPointerUp({x:j.x+42,y:j.y+80}); drawCanvasOnly();
  j=state.proJunctions.find(x=>x.id===j.id);
  const mobileVerticalMoved=j.x!==old.x&&Math.abs(j.y-old.y)<.01;
  const near=window.findProPinAt(pin(b.id+':in').x+22,pin(b.id+':in').y+3);
  const degree=state.proWires.filter(x=>x.from===j.id||x.to===j.id).length;
  const saved=getSerializableLadder(), sj=saved.proJunctions.find(x=>x.id===j.id);
  return {version:window.SimuPLCLadderWiring.version,wireCount:state.proWires.length,junctionCount:state.proJunctions.length,touchTarget:near&&near.id,expected:pin(b.id+':in').id,mobileVerticalMoved,degree,metadata:!!sj&&Array.isArray(sj.connectedWireIds)&&!!sj.networkId};
 }''')
 page.locator('.ladder-canvas-wrap').screenshot(path=str(SHOT))
 b.close()
result={'ok':not errors and out['version']=='1.3.2-phase2' and out['wireCount']==4 and out['junctionCount']==1 and out['touchTarget']==out['expected'] and out['mobileVerticalMoved'] and out['degree']==3 and out['metadata'],'result':out,'pageErrors':errors,'screenshot':str(SHOT.relative_to(ROOT))}
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(0 if result['ok'] else 1)
