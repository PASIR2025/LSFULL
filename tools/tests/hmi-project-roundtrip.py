#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear()};Object.defineProperty(window,'localStorage',{value:s,configurable:true});})();</script>"""
def inline(html):
 def sr(m):
  p=ROOT/m.group(1).split('?',1)[0].replace('./','')
  return '<script>'+p.read_text(encoding='utf-8')+'</script>' if p.exists() else m.group(0)
 def cr(m):
  p=ROOT/m.group(1).split('?',1)[0].replace('./','')
  return '<style>'+p.read_text(encoding='utf-8')+'</style>' if p.exists() else m.group(0)
 html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sr,html,flags=re.I)
 html=re.sub(r'<link[^>]+href=["\']([^"\']+\.css(?:\?[^"\']*)?)["\'][^>]*>',cr,html,flags=re.I)
 return html
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 pg=b.new_page(viewport={'width':1400,'height':900});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 html=MOCK+inline((ROOT/'index.html').read_text(encoding='utf-8'));html=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',html,flags=re.I)
 pg.set_content(html,wait_until='load',timeout=120000);pg.wait_for_timeout(6500)
 result=pg.evaluate('''async()=>{
   clearAll();createNode('analog_input',220,180);createNode('pid',470,180);createNode('analog_output',760,180);
   SimuPLCHMI.applyTankTemplate();document.getElementById('modeHMIBtn').click();
   const before=SimuPLCHMI.getProject();
   const complete=await SimuPLCHMIProject.makeComplete('Roundtrip');
   SimuPLCHMI.newProject();clearAll();
   const ok=await SimuPLCHMIProject.loadComplete(complete);
   const after=SimuPLCHMI.getProject();
   return {ok,type:complete.type,active:complete.activeEditor,before:(before.elements||[]).length,after:(after.elements||[]).length,fbdTypes:(nodes||[]).map(n=>n.type),modeHmi:document.body.classList.contains('mode-hmi')};
 }''')
 print(json.dumps({'result':result,'errors':errs},ensure_ascii=False,indent=2));b.close()
 if errs or not result.get('ok') or result.get('type')!='simuplc-dual-project' or result.get('after')!=result.get('before') or 'pid' not in result.get('fbdTypes',[]):raise SystemExit(1)
