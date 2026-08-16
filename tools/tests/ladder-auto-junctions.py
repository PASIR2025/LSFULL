#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SHOT=ROOT/'docs'/'ladder-visual-junctions.png'
LOCAL='''<script>(function(){var d=new Map(),s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true})}catch(e){}})();</script>'''
def inline(html):
 def repl(m):
  fp=ROOT/m.group(1).replace('./','')
  return '<script>\n'+fp.read_text(encoding='utf-8')+'\n</script>' if fp.exists() else m.group(0)
 return re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',repl,html,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900})
 errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(LOCAL+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=120000)
 page.wait_for_timeout(1400)
 result=page.evaluate('''async()=>{
   resetDemoProject();
   setPendingType('NO'); addElementAtPointer(420,250);
   setPendingType('NO'); addElementAtPointer(800,250);
   setPendingType('NO'); addElementAtPointer(800,430);
   drawCanvasOnly();
   const els=state.ladder.rungs[0].elements, source=els[0], top=els[1], bottom=els[2];
   const pin=id=>getProPinById(id), click=p=>handleProPointerDown({x:p.x,y:p.y});
   const pointOnRoute=(point,wire)=>{
     const pts=wirePointsFor(wire);
     for(let i=0;i<pts.length-1;i++) if(pointSegmentDistance(point.x,point.y,pts[i],pts[i+1])<.1) return true;
     return false;
   };

   click(pin(source.id+':out')); click(pin(top.id+':in'));
   click(pin(source.id+':out')); click(pin(bottom.id+':in'));
   drawCanvasOnly();

   const sourcePinBefore=pin(source.id+':out');
   const beforeMarkers=getAutomaticJunctionMarkers();
   const visualBefore=beforeMarkers.find(m=>m.source==='visual-branch' && m.terminalId===source.id+':out');
   const markerAtVisualUnion=!!visualBefore && state.proWires.every(w=>pointOnRoute(visualBefore,w));
   const notOnElementTerminal=!!visualBefore && Math.hypot(visualBefore.x-sourcePinBefore.x,visualBefore.y-sourcePinBefore.y)>5;

   const old={x:visualBefore&&visualBefore.x,y:visualBefore&&visualBefore.y};
   handleProPointerDown({x:source.x,y:source.y});
   handleProPointerMove({x:source.x+110,y:source.y});
   handleProPointerUp({x:source.x+110,y:source.y});
   drawCanvasOnly();
   const visualAfter=getAutomaticJunctionMarkers().find(m=>m.source==='visual-branch' && m.terminalId===source.id+':out');
   const followsMovedWires=!!visualAfter && Math.abs(visualAfter.x-old.x)>20 && state.proWires.every(w=>pointOnRoute(visualAfter,w));

   // El zoom no cambia la coordenada lógica de la unión.
   const beforeZoom={x:visualAfter.x,y:visualAfter.y};
   state.proZoom=1.45; drawCanvasOnly();
   const zoomMarker=getAutomaticJunctionMarkers().find(m=>m.source==='visual-branch' && m.terminalId===source.id+':out');
   const zoomStable=!!zoomMarker && Math.abs(zoomMarker.x-beforeZoom.x)<.01 && Math.abs(zoomMarker.y-beforeZoom.y)<.01;

   // Tocar cables no crea nodos ni conductores adicionales.
   const wiresBeforeTap=state.proWires.length, junctionsBeforeTap=state.proJunctions.length;
   const firstWire=state.proWires[0], pts=wirePointsFor(firstWire);
   const mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
   handleProPointerDown(mid); handleProPointerUp(mid);
   handleProPointerDown(mid); handleProPointerUp(mid);
   const wireTapSafe=state.proWires.length===wiresBeforeTap && state.proJunctions.length===junctionsBeforeTap;
   const manualNodeDisabled=createJunctionOnWire()===null && splitWireAtPoint()===null && moveVerticalBranch('none',999)===false;

   // Entrada con entrada y múltiples conexiones permanecen habilitadas.
   const ii=completeProConnection(pin(top.id+':in'),pin(bottom.id+':in'));
   drawCanvasOnly();
   const inputInputOk=!!ii.ok;
   const multipleConnections=(state.proWires||[]).filter(w=>w.from===top.id+':in'||w.to===top.id+':in').length>=2;

   rebuildElectricalGraph();
   const flooded=SimuPLCLadderWiring.floodElectricalGraph(state.proElectricalGraph,[source.id+':out']);
   const propagation=flooded.nodeIds.has(top.id+':in') && flooded.nodeIds.has(bottom.id+':in');

   // Durante simulación no se edita ni se conecta.
   state.simulationOn=true;
   const wiresBeforeSim=state.proWires.length, elementsBeforeSim=state.ladder.rungs[0].elements.length;
   const blockedConnection=completeProConnection(pin(top.id+':out'),pin(bottom.id+':out'));
   const pendingBlocked=setPendingType('COIL')===false;
   addElementAtPointer(900,520);
   const pointerBlocked=handleProPointerDown({x:pin(source.id+':out').x,y:pin(source.id+':out').y})===false;
   state.selectedWireId=state.proWires[0].id; deleteSelectedElement();
   const simulationLocked=!blockedConnection.ok && pendingBlocked && pointerBlocked && state.proWires.length===wiresBeforeSim && state.ladder.rungs[0].elements.length===elementsBeforeSim;
   state.simulationOn=false; state.selectedWireId=null;

   const saved=getSerializableLadder();
   tryLoadModel(JSON.parse(JSON.stringify(saved)));
   await new Promise(r=>setTimeout(r,60)); drawCanvasOnly();
   const loaded=getAutomaticJunctionMarkers().find(m=>m.source==='visual-branch' && m.terminalId===source.id+':out');
   const roundTrip=state.proWires.length===3 && !!loaded && Math.hypot(loaded.x-pin(source.id+':out').x,loaded.y-pin(source.id+':out').y)>5;

   return {version:SimuPLCLadderWiring.version,markerAtVisualUnion,notOnElementTerminal,followsMovedWires,zoomStable,wireTapSafe,manualNodeDisabled,inputInputOk,multipleConnections,propagation,simulationLocked,roundTrip,wireCount:state.proWires.length,junctionCount:state.proJunctions.length,markers:getAutomaticJunctionMarkers()};
 }''')
 page.locator('.ladder-canvas-wrap').screenshot(path=str(SHOT))
 b.close()
required=['markerAtVisualUnion','notOnElementTerminal','followsMovedWires','zoomStable','wireTapSafe','manualNodeDisabled','inputInputOk','multipleConnections','propagation','simulationLocked','roundTrip']
out={'result':result,'pageErrors':errors,'screenshot':str(SHOT.relative_to(ROOT))}
print(json.dumps(out,ensure_ascii=False,indent=2))
raise SystemExit(0 if not errors and all(result.get(k) for k in required) else 1)
