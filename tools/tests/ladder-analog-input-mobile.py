#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});Object.defineProperty(window,'localStorage',{value:s,configurable:true});})();</script>"""
def inline(h):
 def sr(m):
  p=ROOT/m.group(1).replace('./',''); return '<script>'+p.read_text(encoding='utf-8')+'</script>' if p.exists() else m.group(0)
 def cr(m):
  p=ROOT/m.group(1).replace('./',''); return '<style>'+p.read_text(encoding='utf-8')+'</style>' if p.exists() else m.group(0)
 h=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sr,h,flags=re.I)
 return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',cr,h,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':667},is_mobile=True,has_touch=True)
 errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=180000)
 page.wait_for_timeout(1600)
 page.evaluate("""() => {resetDemoProject();setPendingType('analog_input');addElementAtPointer(330,270);const e=state.ladder.rungs[0].elements[0];state.selectedId=e.id;state.freeSelectedId=e.id;openEditModalFromSelection();}""")
 page.wait_for_timeout(150)
 before=page.evaluate("""() => {const c=document.querySelector('#editOverlay .edit-card');const s=document.getElementById('saveEditModal');return {shown:editOverlay.classList.contains('show'),client:c.clientHeight,scroll:c.scrollHeight,overflow:getComputedStyle(c).overflowY,save:s.getBoundingClientRect().toJSON(),viewport:innerHeight};}""")
 page.locator('#ladderAiRawValue').fill('2048')
 page.locator('#ladderAiUnit').fill('bar')
 page.evaluate("""() => {const c=document.querySelector('#editOverlay .edit-card');c.scrollTop=c.scrollHeight;}""")
 page.wait_for_timeout(100)
 box=page.locator('#saveEditModal').bounding_box()
 page.locator('#saveEditModal').click()
 final=page.evaluate("""() => {const e=state.ladder.rungs[0].elements[0];return {closed:!editOverlay.classList.contains('show'),raw:e.rawValue,unit:e.unit};}""")
 b.close()
ok=not errs and before['shown'] and before['overflow'] in ('auto','scroll') and box and box['y']>=-1 and box['y']+box['height']<=667+1 and final=={'closed':True,'raw':2048,'unit':'bar'}
print(json.dumps({'ok':ok,'before':before,'saveBox':box,'final':final,'pageErrors':errs},ensure_ascii=False,indent=2))
raise SystemExit(0 if ok else 1)
