#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SHOT=ROOT/'docs'/'ladder-electrical-network.png'
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
 page.wait_for_timeout(1500)
 result=page.evaluate('''async()=>{
   resetDemoProject();
   setPendingType('NO'); addElementAtPointer(430,270);
   setPendingType('COIL'); addElementAtPointer(900,270);
   setPendingType('NO'); addElementAtPointer(610,470);
   setPendingType('NO'); addElementAtPointer(770,470);
   drawCanvasOnly();
   const els=state.ladder.rungs[0].elements, a=els[0], coil=els[1], b=els[2], c=els[3];
   const pin=id=>getProPinById(id), click=p=>handleProPointerDown({x:p.x,y:p.y});
   const rail1=pin('rail:left:1'), rail2=pin('rail:left:2');
   click(rail1); click(pin(a.id+':in'));
   click(pin(a.id+':out')); click(pin(coil.id+':in'));
   click(rail2); click(pin(b.id+':in'));
   drawCanvasOnly();

   // T sobre el cable horizontal principal.
   let main=state.proWires.find(w=>(w.from===a.id+':out'&&w.to===coil.id+':in')||(w.to===a.id+':out'&&w.from===coil.id+':in'));
   let pts=wirePointsFor(main); let h0=pts.findIndex((p,i)=>i<pts.length-1&&Math.abs(p.y-pts[i+1].y)<.01);
   let hp={x:(pts[h0].x+pts[h0+1].x)/2,y:pts[h0].y};
   click(hp); click(pin(b.id+':out')); drawCanvasOnly();
   let j=state.proJunctions[0];
   const related=()=>state.proWires.filter(w=>w.from===j.id||w.to===j.id);
   function incident(w){const r=wirePointsFor(w),start=w.from===j.id,e=start?r[0]:r[r.length-1],n=start?r[1]:r[r.length-2];return {r,e,n,vertical:Math.abs(e.x-n.x)<.01,horizontal:Math.abs(e.y-n.y)<.01};}
   let infos=related().map(incident);
   const vertical=infos.find(i=>i.vertical), horizontals=infos.filter(i=>i.horizontal);
   const exactT=!!j&&!!vertical&&horizontals.length>=2&&Math.abs(j.x-vertical.n.x)<.01&&horizontals.every(i=>Math.abs(j.y-i.n.y)<.01);

   // Zoom no altera coordenadas lógicas.
   const beforeZoom={x:j.x,y:j.y}; setProZoom(.62); drawCanvasOnly(); setProZoom(1.42); drawCanvasOnly();
   j=state.proJunctions.find(x=>x.id===j.id);
   const zoomStable=Math.abs(j.x-beforeZoom.x)<.01&&Math.abs(j.y-beforeZoom.y)<.01;

   // Arrastrar nodo: solo X; toda la derivación vertical acompaña.
   const old={x:j.x,y:j.y};
   handleProPointerDown({x:j.x,y:j.y});
   handleProPointerMove({x:j.x+55,y:j.y+120});
   handleProPointerUp({x:j.x+55,y:j.y+120});
   drawCanvasOnly();
   j=state.proJunctions.find(x=>x.id===j.id); infos=related().map(incident);
   const movedX=j.x!==old.x, yLocked=Math.abs(j.y-old.y)<.01;
   const branchMoves=infos.filter(i=>i.vertical).every(i=>Math.abs(i.e.x-j.x)<.01&&Math.abs(i.n.x-j.x)<.01);
   const horizontalAdapt=infos.filter(i=>i.horizontal).every(i=>Math.abs(i.e.x-j.x)<.01&&Math.abs(i.e.y-j.y)<.01);

   // Un cable horizontal no se desplaza al arrastrarlo.
   const hw=related().find(w=>incident(w).horizontal); const hb=wirePointsFor(hw); const hi=hb.findIndex((p,i)=>i<hb.length-1&&Math.abs(p.y-hb[i+1].y)<.01);
   const hmid={x:(hb[hi].x+hb[hi+1].x)/2,y:hb[hi].y}; const routeBefore=JSON.stringify(hw.points||[]);
   handleProPointerDown(hmid); handleProPointerMove({x:hmid.x,y:hmid.y+90}); handleProPointerUp({x:hmid.x,y:hmid.y+90});
   const horizontalLocked=JSON.stringify(hw.points||[])===routeBefore;

   // Entrada con entrada y múltiples conexiones desde el mismo terminal.
   const ii=validateProConnection(pin(b.id+':in'),pin(c.id+':in'));
   if(ii.ok) completeProConnection(pin(b.id+':in'),pin(c.id+':in'));
   const inputInputOk=ii.ok&&state.proWires.some(w=>(w.from===b.id+':in'&&w.to===c.id+':in')||(w.to===b.id+':in'&&w.from===c.id+':in'));
   const multi=validateProConnection(rail2,pin(c.id+':in'));
   if(multi.ok) completeProConnection(rail2,pin(c.id+':in'));
   const multipleConnectionsOk=multi.ok&&state.proWires.filter(w=>w.from===c.id+':in'||w.to===c.id+':in').length>=2;

   // Grafo bidireccional: todos los nodos de la red reciben el potencial.
   rebuildElectricalGraph();
   const graph=state.proElectricalGraph, svc=window.SimuPLCLadderWiring;
   const flood=svc.floodElectricalGraph(graph,[rail2.id]);
   const bidirectional=flood.nodeIds.has(b.id+':in')&&flood.nodeIds.has(c.id+':in');

   // Derivación creada durante simulación recibe señal inmediatamente.
   state.simValues[a.label]=true; state.simValues[b.label]=false; state.simValues[c.label]=false; state.simulationOn=true; drawCanvasOnly();
   const poweredBefore=!!state.coilStates[coil.label];
   state.selectedWireId=null; state.proWireTapPoint=null; state.proWireEditDrag=null;
   // Nueva rama desde un conductor energizado hacia entrada C.
   const activeWire=state.proWires.find(w=>w.from===rail1.id||w.to===rail1.id); const ap=wirePointsFor(activeWire); const ai=ap.length>1?0:-1;
   const activePoint={x:(ap[ai].x+ap[ai+1].x)/2,y:(ap[ai].y+ap[ai+1].y)/2};
   handleProPointerDown(activePoint); handleProPointerDown({x:pin(c.id+':in').x,y:pin(c.id+':in').y}); drawCanvasOnly();
   const immediate=!!state.freePinEnergy[c.id+':in'];
   state.simValues[a.label]=false; drawCanvasOnly();
   const deenergized=!state.coilStates[coil.label];

   // Guardado/carga conserva geometría y metadatos de red.
   state.simulationOn=false; resetLadderRuntimeState(); drawCanvasOnly();
   const saved=getSerializableLadder();
   const savedJ=saved.proJunctions.find(x=>x.id===j.id);
   const metadataSaved=!!savedJ&&Array.isArray(savedJ.connectedWireIds)&&savedJ.networkId;
   const snapshot={x:j.x,y:j.y,wires:state.proWires.length,junctions:state.proJunctions.length};
   tryLoadModel(JSON.parse(JSON.stringify(saved))); await new Promise(r=>setTimeout(r,50)); drawCanvasOnly();
   const loaded=state.proJunctions.find(x=>x.id===j.id);
   const roundTrip=!!loaded&&Math.abs(loaded.x-snapshot.x)<.01&&Math.abs(loaded.y-snapshot.y)<.01&&state.proWires.length===snapshot.wires&&state.proJunctions.length===snapshot.junctions;

   return {version:svc.version,exactT,zoomStable,movedX,yLocked,branchMoves,horizontalAdapt,horizontalLocked,inputInputOk,multipleConnectionsOk,bidirectional,poweredBefore,immediate,deenergized,metadataSaved:!!metadataSaved,roundTrip,networkCount:(state.proElectricalNetworks||[]).length};
 }''')
 page.locator('.ladder-canvas-wrap').screenshot(path=str(SHOT))
 b.close()
print(json.dumps({'result':result,'pageErrors':errors,'screenshot':str(SHOT.relative_to(ROOT))},ensure_ascii=False,indent=2))
required=['exactT','zoomStable','movedX','yLocked','branchMoves','horizontalAdapt','horizontalLocked','inputInputOk','multipleConnectionsOk','bidirectional','poweredBefore','immediate','deenergized','metadataSaved','roundTrip']
raise SystemExit(0 if not errors and result.get('version')=='1.3.2-phase2' and all(result.get(k) for k in required) else 1)
