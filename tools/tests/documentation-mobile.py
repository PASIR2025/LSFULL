import re,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});Object.defineProperty(window,'localStorage',{value:s,configurable:true});})();</script>"""
def inline(h):
 def a(m):
  p=ROOT/m.group(1).replace('./','');return '<script>'+p.read_text()+'</script>' if p.exists() else m.group(0)
 def c(m):
  p=ROOT/m.group(1).replace('./','');return '<style>'+p.read_text()+'</style>' if p.exists() else m.group(0)
 h=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',a,h,flags=re.I)
 return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',c,h,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 out={};errs=[]
 pg=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);pg.on('pageerror',lambda e:errs.append(str(e)))
 h=MOCK+inline((ROOT/'index.html').read_text());h=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',h,flags=re.I)
 pg.set_content(h,wait_until='load',timeout=180000);pg.wait_for_timeout(5000);pg.evaluate('SimuPLCFbdDocumentation.beginText()')
 out['fbd']=pg.evaluate('''()=>{const card=document.querySelector('.fbd-text-card').getBoundingClientRect();return {left:card.left,right:card.right,top:card.top,bottom:card.bottom,w:innerWidth,h:innerHeight,visible:document.getElementById('fbdTextModal').classList.contains('show')}}''');pg.close()
 pg=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);pg.on('pageerror',lambda e:errs.append(str(e)));pg.set_content(MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text()),wait_until='load',timeout=180000);pg.wait_for_timeout(4500);pg.evaluate('SimuPLCReferenceText.add()')
 out['ladder']=pg.evaluate('''()=>{const card=document.querySelector('.reference-text-card').getBoundingClientRect();return {left:card.left,right:card.right,top:card.top,bottom:card.bottom,w:innerWidth,h:innerHeight,visible:document.getElementById('referenceTextOverlay').classList.contains('show')}}''');b.close()
 print(json.dumps({'out':out,'errors':errs},indent=2));ok=not errs and all(x['visible'] and x['left']>=0 and x['right']<=x['w']+1 and x['top']>=0 and x['bottom']<=x['h']+1 for x in out.values());raise SystemExit(0 if ok else 1)
