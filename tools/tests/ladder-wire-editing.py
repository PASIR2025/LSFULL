#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SHOT=ROOT/'docs'/'ladder-wire-editing.png'
LOCAL='''<script>(function(){var d=new Map(),s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true})}catch(e){}})();</script>'''
def inline(html):
 def repl(m):
  fp=ROOT/m.group(1).replace('./','')
  return '<script>\n'+fp.read_text(encoding='utf-8')+'\n</script>' if fp.exists() else m.group(0)
 return re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',repl,html,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1365,'height':850})
 errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(LOCAL+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=120000)
 page.wait_for_timeout(1600)
 result=page.evaluate('''async()=>{
   resetDemoProject();
   setPendingType('NO'); addElementAtPointer(430,270);
   setPendingType('COIL'); addElementAtPointer(900,270);
   setPendingType('NO'); addElementAtPointer(610,470);
   drawCanvasOnly();
   const els=state.ladder.rungs[0].elements, a=els[0], coil=els[1], b=els[2];
   const pin=id=>getProPinById(id), click=p=>handleProPointerDown({x:p.x,y:p.y});
   click(pin('rail:left:1')); click(pin(a.id+':in'));
   click(pin(a.id+':out')); click(pin(coil.id+':in'));
   click(pin('rail:left:2')); click(pin(b.id+':in'));
   drawCanvasOnly();

   let main=state.proWires.find(w=>(w.from===a.id+':out'&&w.to===coil.id+':in')||(w.to===a.id+':out'&&w.from===coil.id+':in'));
   let pts=wirePointsFor(main);
   let hi=pts.findIndex((p,i)=>i<pts.length-1&&Math.abs(p.y-pts[i+1].y)<.01);
   const tap={x:(pts[hi].x+pts[hi+1].x)/2,y:pts[hi].y};
   click(tap); click(pin(b.id+':out')); drawCanvasOnly();
   let junction=state.proJunctions[0];
   const incidentWire=()=>state.proWires.find(w=>{
     if(w.from!==junction.id&&w.to!==junction.id) return false;
     const r=wirePointsFor(w), atStart=w.from===junction.id;
     const e=atStart?r[0]:r[r.length-1], n=atStart?r[1]:r[r.length-2];
     return Math.abs(e.x-n.x)<.01;
   });
   let verticalWire=incidentWire();
   let verticalPts=wirePointsFor(verticalWire);
   const verticalMid={x:verticalPts[0].x,y:(verticalPts[0].y+verticalPts[verticalPts.length-1].y)/2};
   const beforeJ={x:junction.x,y:junction.y};
   handleProPointerDown(verticalMid);
   handleProPointerMove({x:verticalMid.x+52,y:verticalMid.y+100});
   handleProPointerUp({x:verticalMid.x+52,y:verticalMid.y+100});
   drawCanvasOnly();
   junction=state.proJunctions.find(j=>j.id===junction.id);
   verticalWire=state.proWires.find(w=>w.id===verticalWire.id);
   verticalPts=wirePointsFor(verticalWire);
   const verticalMoved=junction.x!==beforeJ.x;
   const verticalYLocked=Math.abs(junction.y-beforeJ.y)<.01;
   const branchVertical=verticalPts.every((p,i)=>i===0||Math.abs(p.x-verticalPts[i-1].x)<.01||Math.abs(p.y-verticalPts[i-1].y)<.01);
   const selectedAfterDrag=state.selectedWireId===verticalWire.id;

   const horizontalWire=state.proWires.find(w=>{
     if(w.from!==junction.id&&w.to!==junction.id) return false;
     const r=wirePointsFor(w), atStart=w.from===junction.id;
     const e=atStart?r[0]:r[r.length-1], n=atStart?r[1]:r[r.length-2];
     return Math.abs(e.y-n.y)<.01;
   });
   const hp=wirePointsFor(horizontalWire); const hidx=hp.findIndex((p,i)=>i<hp.length-1&&Math.abs(p.y-hp[i+1].y)<.01);
   const hmid={x:(hp[hidx].x+hp[hidx+1].x)/2,y:hp[hidx].y};
   const horizontalBefore=JSON.stringify(horizontalWire.points||[]);
   handleProPointerDown(hmid); handleProPointerMove({x:hmid.x,y:hmid.y+80}); handleProPointerUp({x:hmid.x,y:hmid.y+80});
   const horizontalLocked=JSON.stringify(horizontalWire.points||[])===horizontalBefore;

   const saved=getSerializableLadder();
   const savedJ=saved.proJunctions.find(j=>j.id===junction.id);
   tryLoadModel(JSON.parse(JSON.stringify(saved))); await new Promise(r=>setTimeout(r,50)); drawCanvasOnly();
   const loadedJ=state.proJunctions.find(j=>j.id===junction.id);
   const routePersisted=!!loadedJ&&Math.abs(loadedJ.x-savedJ.x)<.01&&Math.abs(loadedJ.y-savedJ.y)<.01;
   const degree=state.proWires.filter(w=>w.from===loadedJ.id||w.to===loadedJ.id).length;
   const realTJunction=degree===3;
   handleProPointerDown({x:1200,y:700}); handleProPointerUp({x:1200,y:700});
   const controlsHidden=state.selectedWireId===null&&state.proWireEditDrag===null;
   return {version:window.SimuPLCLadderWiring.version,verticalMoved,verticalYLocked,branchVertical,selectedAfterDrag,horizontalLocked,routePersisted,realTJunction,controlsHidden,junctionDegree:degree};
 }''')
 page.locator('.ladder-canvas-wrap').screenshot(path=str(SHOT))
 b.close()
print(json.dumps({'result':result,'pageErrors':errors,'screenshot':str(SHOT.relative_to(ROOT))},ensure_ascii=False,indent=2))
required=['verticalMoved','verticalYLocked','branchVertical','selectedAfterDrag','horizontalLocked','routePersisted','realTJunction','controlsHidden']
raise SystemExit(0 if not errors and result.get('version')=='1.3.2-phase2' and all(result.get(k) for k in required) else 1)
