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
    page=browser.new_page(viewport={'width':1200,'height':800})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=180000)
    page.wait_for_timeout(1800)
    result=page.evaluate("""() => {
      const item=document.querySelector('[data-ladder-type="analog_input"]');
      resetDemoProject();
      setPendingType('analog_input');
      addElementAtPointer(420,270);
      const el=state.ladder.rungs[0].elements[0];
      const created={type:el.type,label:el.label,rawMin:el.rawMin,rawMax:el.rawMax,engMin:el.engMin,engMax:el.engMax,unit:el.unit,decimals:el.decimals,outputMode:el.outputMode};
      state.selectedId=el.id; state.freeSelectedId=el.id; openEditModalFromSelection();
      return new Promise(resolve => requestAnimationFrame(() => resolve({
        library:!!item,
        itemText:item?item.textContent.replace(/\s+/g,' ').trim():'',
        created,
        modalShown:document.getElementById('editOverlay').classList.contains('show'),
        analogFieldsVisible:getComputedStyle(document.getElementById('ladderAnalogEditFields')).display,
        behaviorVisible:getComputedStyle(document.getElementById('editBehaviorSelect').closest('label')).display,
        pins:(state.proPins||[]).filter(p=>p.elementId===el.id).map(p=>({side:p.side,signalType:p.signalType,kind:p.kind}))
      })));
    }""")
    page.locator('#editNameInput').fill('AI7')
    page.locator('#editReferenceInput').fill('Sensor de temperatura')
    page.locator('#ladderAiRawValue').fill('2048')
    page.locator('#ladderAiEngMin').fill('0')
    page.locator('#ladderAiEngMax').fill('100')
    page.locator('#ladderAiUnit').fill('°C')
    page.locator('#ladderAiDecimals').fill('1')
    page.locator('#saveEditModal').click()
    page.wait_for_timeout(250)
    post=page.evaluate("""() => {
      const el=state.ladder.rungs[0].elements[0];
      refreshVariablesPanel();
      const row=document.querySelector('.ladder-ai-var-row');
      const model=getSerializableLadder();
      const saved=model.rungs[0].elements[0];
      const before=SimuPLCLadderAnalogInput.outputValue(el);
      const slider=row && row.querySelector('input[type=range]');
      if(slider){slider.value='4095';slider.dispatchEvent(new Event('input',{bubbles:true}));}
      const after=SimuPLCLadderAnalogInput.outputValue(el);
      return {
        label:el.label,reference:el.reference,description:el.description,rawValue:el.rawValue,unit:el.unit,
        before,after,row:!!row,rowText:row?row.textContent.replace(/\s+/g,' ').trim():'',
        saved:{type:saved.type,label:saved.label,rawValue:saved.rawValue,unit:saved.unit,outputMode:saved.outputMode},
        diagnostics:SimuPLCLadderAnalogInput.getDiagnostics(),catalog:SimuPLCAnalogCatalog.getDiagnostics()
      };
    }""")
    sim=page.evaluate("""async () => {
      toggleSimulationMode();
      drawCanvasOnly();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const el=state.ladder.rungs[0].elements[0];
      const hit=(state.freeElementHitMap||[]).find(h=>h.id===el.id);
      const rect=canvas.getBoundingClientRect();
      const p=typeof worldToScreen==='function'?worldToScreen(hit.centerX,hit.centerY):{x:hit.centerX,y:hit.centerY};
      canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:rect.left+p.x,clientY:rect.top+p.y,pointerId:1,pointerType:'mouse'}));
      return {simulationOn:state.simulationOn,quick:document.getElementById('ladderAiQuickOverlay').classList.contains('show'),analogValue:state.analogValues && state.analogValues[el.label]};
    }""")
    # save/load roundtrip
    roundtrip=page.evaluate("""() => {
      if(state.simulationOn) toggleSimulationMode();
      const model=getSerializableLadder();
      resetDemoProject();
      tryLoadModel(model);
      const el=state.ladder.rungs[0].elements[0];
      return {count:state.ladder.rungs[0].elements.length,type:el.type,label:el.label,rawValue:el.rawValue,unit:el.unit,output:SimuPLCLadderAnalogInput.outputValue(el)};
    }""")
    browser.close()

ok=(not errors and result['library'] and result['created']['type']=='analog_input' and result['created']['label']=='AI1' and result['analogFieldsVisible']!='none' and result['behaviorVisible']=='none' and len(result['pins'])==1 and result['pins'][0]['signalType']=='analog' and post['label']=='AI7' and post['row'] and abs(post['after']-100)<0.01 and post['saved']['type']=='analog_input' and sim['simulationOn'] and sim['quick'] and roundtrip['count']==1 and roundtrip['type']=='analog_input' and roundtrip['label']=='AI7')
out={'ok':ok,'initial':result,'post':post,'simulation':sim,'roundtrip':roundtrip,'pageErrors':errors}
print(json.dumps(out,ensure_ascii=False,indent=2))
raise SystemExit(0 if ok else 1)
