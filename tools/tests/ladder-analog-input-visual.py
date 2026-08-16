#!/usr/bin/env python3
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});Object.defineProperty(window,'localStorage',{value:s,configurable:true});})();</script>"""
def inline(html):
 def sr(m):
  p=ROOT/m.group(1).replace('./',''); return '<script>'+p.read_text(encoding='utf-8')+'</script>' if p.exists() else m.group(0)
 def cr(m):
  p=ROOT/m.group(1).replace('./',''); return '<style>'+p.read_text(encoding='utf-8')+'</style>' if p.exists() else m.group(0)
 html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sr,html,flags=re.I)
 return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',cr,html,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':800})
 page.set_content(MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8')),wait_until='load',timeout=180000)
 page.wait_for_timeout(1500)
 page.evaluate("""() => {resetDemoProject();setPendingType('analog_input');addElementAtPointer(420,270);const e=state.ladder.rungs[0].elements[0];e.rawValue=2700;e.engMin=0;e.engMax=150;e.unit='°C';e.reference='Sensor de temperatura';e.description='Sensor de temperatura';state.freeSelectedId=e.id;state.selectedId=e.id;draw();}""")
 page.wait_for_timeout(400)
 page.screenshot(path=str(ROOT/'docs/ladder-analog-input.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':667})
 page.wait_for_timeout(400)
 page.screenshot(path=str(ROOT/'docs/ladder-analog-input-mobile.png'),full_page=True)
 b.close()
