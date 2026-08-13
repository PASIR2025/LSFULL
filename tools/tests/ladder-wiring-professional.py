#!/usr/bin/env python3
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SCREENSHOT = ROOT / 'docs' / 'ladder-wiring-professional.png'

LOCAL_STORAGE_MOCK = """<script>
(function(){
  var data = new Map();
  var storage = {
    getItem:function(k){ k=String(k); return data.has(k) ? data.get(k) : null; },
    setItem:function(k,v){ data.set(String(k), String(v)); },
    removeItem:function(k){ data.delete(String(k)); },
    clear:function(){ data.clear(); },
    key:function(i){ return Array.from(data.keys())[i] || null; }
  };
  Object.defineProperty(storage, 'length', {get:function(){ return data.size; }});
  try{ Object.defineProperty(window, 'localStorage', {value:storage, configurable:true}); }catch(e){}
})();
</script>"""

def inline_assets(html: str) -> str:
    def script_repl(match):
        src = match.group(1).replace('./', '')
        target = ROOT / src
        if target.exists():
            return '<script>\n' + target.read_text(encoding='utf-8') + '\n</script>'
        return match.group(0)
    return re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script_repl, html, flags=re.I)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    html=LOCAL_STORAGE_MOCK+inline_assets((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8'))
    page.set_content(html, wait_until='load', timeout=120000)
    page.wait_for_timeout(2500)
    result=page.evaluate('''async () => {
      resetDemoProject();
      setPendingType('NO'); addElementAtPointer(430,270);
      setPendingType('COIL'); addElementAtPointer(850,270);
      setPendingType('NO'); addElementAtPointer(610,460);
      await new Promise(r=>setTimeout(r,100));
      drawCanvasOnly();

      const els=state.ladder.rungs[0].elements;
      const no1=els[0], coil=els[1], no2=els[2];
      const pin=id => getProPinById(id);
      let no1In=pin(no1.id+':in'), no1Out=pin(no1.id+':out');
      let coilIn=pin(coil.id+':in');
      let no2In=pin(no2.id+':in'), no2Out=pin(no2.id+':out');
      const rail1=pin('rail:left:1');
      const rail2=pin('rail:left:2');

      // Se puede comenzar por la entrada y terminar por la salida.
      handleProPointerDown({x:coilIn.x,y:coilIn.y});
      handleProPointerDown({x:no1Out.x,y:no1Out.y});
      const reverseOk=state.proWires.some(w=>w.from===no1Out.id && w.to===coilIn.id);

      // Arrastrar y soltar desde el rail hasta una entrada.
      handleProPointerDown({x:rail1.x,y:rail1.y});
      handleProPointerMove({x:no1In.x,y:no1In.y});
      handleProPointerUp({x:no1In.x,y:no1In.y});
      const dragOk=state.proWires.some(w=>w.from===rail1.id && w.to===no1In.id);

      // Zona táctil ampliada alrededor del terminal.
      const nearPin=window.findProPinAt(no2In.x+24,no2In.y+4);
      const touchOk=!!nearPin && nearPin.id===no2In.id;

      // Seleccionar un cable y tocar otro terminal crea una derivación real.
      const main=state.proWires.find(w=>w.from===no1Out.id && w.to===coilIn.id);
      const mainPts=orthogonalPoints(pin(main.from),pin(main.to));
      const branchPoint={
        x:(mainPts[0].x+mainPts[mainPts.length-1].x)/2,
        y:(mainPts[0].y+mainPts[mainPts.length-1].y)/2
      };
      handleProPointerDown(branchPoint);
      const selectedBefore=state.selectedWireId===main.id;
      handleProPointerDown({x:no2Out.x,y:no2Out.y});
      await new Promise(r=>setTimeout(r,60));
      drawCanvasOnly();
      const junction=state.proJunctions[0];
      const junctionOk=!!junction && state.proWires.filter(w=>w.from===junction.id || w.to===junction.id).length===3;
      const branchOk=!!junction && state.proWires.some(w=>w.from===no2Out.id && w.to===junction.id);

      // Segunda rama: otra vez puede comenzarse por la entrada.
      handleProPointerDown({x:no2In.x,y:no2In.y});
      handleProPointerDown({x:rail2.x,y:rail2.y});
      const inputFirstOk=state.proWires.some(w=>w.from===rail2.id && w.to===no2In.id);

      // Simulación: cualquiera de las dos ramas alimenta la bobina.
      state.simValues[no1.label]=true;
      state.simValues[no2.label]=false;
      state.simulationOn=true;
      drawCanvasOnly();
      const mainBranchPower=!!state.coilStates[coil.label];
      state.simValues[no1.label]=false;
      state.simValues[no2.label]=true;
      drawCanvasOnly();
      const parallelBranchPower=!!state.coilStates[coil.label];
      state.simulationOn=false;
      resetLadderRuntimeState();
      drawCanvasOnly();
      const simulationOk=mainBranchPower && parallelBranchPower;

      // Al mover un componente, los cables se recalculan y continúan ortogonales.
      no1.x += 90;
      no1.y += 10;
      markModelDirty();
      drawCanvasOnly();
      no1In=pin(no1.id+':in'); no1Out=pin(no1.id+':out'); coilIn=pin(coil.id+':in');
      const orthogonalOk=state.proWires.every(w=>{
        const pa=pin(w.from), pb=pin(w.to);
        const pts=orthogonalPoints(pa,pb);
        return pts.length>=2 && pts.every((point,index)=>index===0 || point.x===pts[index-1].x || point.y===pts[index-1].y);
      });
      const movedWire=state.proWires.find(w=>w.from===no1Out.id && (w.to===coilIn.id || w.to===junction.id));
      const moveUpdateOk=!!movedWire && orthogonalPoints(pin(movedWire.from),pin(movedWire.to))[0].x===no1Out.x;

      // Persistencia completa de cables y puntos de unión.
      const saved=getSerializableLadder();
      const savedJunctions=Array.isArray(saved.proJunctions) && saved.proJunctions.length===1;
      const beforeLoad={wires:state.proWires.length,junctions:state.proJunctions.length};
      tryLoadModel(JSON.parse(JSON.stringify(saved)));
      await new Promise(r=>setTimeout(r,80));
      drawCanvasOnly();
      const roundTripOk=state.proWires.length===beforeLoad.wires && state.proJunctions.length===beforeLoad.junctions && !!pin(junction.id);

      // Duplicados siguen bloqueados.
      const duplicate=validateProConnection(pin(no1.id+':out'),pin(junction.id));
      const duplicateOk=duplicate.ok===false;

      // Al borrar la rama, una unión de grado 2 se limpia y el cable principal se recompone.
      const branchWire=state.proWires.find(w=>w.from===no2.id+':out' && w.to===junction.id);
      state.selectedWireId=branchWire && branchWire.id;
      deleteSelectedElement();
      drawCanvasOnly();
      const cleanupOk=state.proJunctions.length===0 && state.proWires.some(w=>w.from===no1.id+':out' && w.to===coil.id+':in');

      // Restaura el modelo completo para la captura y las pruebas siguientes.
      tryLoadModel(JSON.parse(JSON.stringify(saved)));
      await new Promise(r=>setTimeout(r,80));
      drawCanvasOnly();

      return {
        version:window.SimuPLCLadderWiring && window.SimuPLCLadderWiring.version,
        reverseOk,dragOk,touchOk,selectedBefore,junctionOk,branchOk,inputFirstOk,
        simulationOk,orthogonalOk,moveUpdateOk,savedJunctions,roundTripOk,duplicateOk,cleanupOk,
        wireCount:state.proWires.length,junctionCount:state.proJunctions.length,modelType:saved.type
      };
    }''')
    page.locator('.ladder-canvas-wrap').screenshot(path=str(SCREENSHOT))
    browser.close()

output={'result':result,'pageErrors':errors,'screenshot':str(SCREENSHOT.relative_to(ROOT))}
print(json.dumps(output,ensure_ascii=False,indent=2))
required=[
    'reverseOk','dragOk','touchOk','selectedBefore','junctionOk','branchOk','inputFirstOk',
    'simulationOk','orthogonalOk','moveUpdateOk','savedJunctions','roundTripOk','duplicateOk','cleanupOk'
]
ok=not errors and result.get('version')=='1.3.2-phase2' and all(result.get(key) for key in required)
raise SystemExit(0 if ok else 1)
