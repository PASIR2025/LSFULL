import re,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
LS='''<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});Object.defineProperty(window,'localStorage',{value:s,configurable:true});})();</script>'''
def inline(html):
 def sr(m):
  path=ROOT/m.group(1).replace('./','')
  return '<script>\n'+path.read_text()+'\n</script>' if path.exists() else m.group(0)
 def cr(m):
  path=ROOT/m.group(1).replace('./','')
  return '<style>\n'+path.read_text()+'\n</style>' if path.exists() else m.group(0)
 html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sr,html,flags=re.I)
 html=re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',cr,html,flags=re.I)
 return html
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 pg=b.new_page(viewport={'width':1400,'height':900})
 errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 html=LS+inline((ROOT/'index.html').read_text())
 html=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',html,flags=re.I)
 pg.set_content(html,wait_until='load',timeout=120000);pg.wait_for_timeout(4500)
 r=pg.evaluate('''() => {
   function reset(){ if(SimuPLCFBDSimulation.isRunning()) SimuPLCFBDSimulation.stop({silent:true}); clearAll(); }
   function wire(a,b,i){ const c=SimuPLCFBDWiring.create(a.output,b.inputs[i||0]); if(!c) throw new Error('wire'); return c; }
   const out={};
   reset();
   createNode('analog_input',150,200);createNode('gt',430,200);createNode('output',720,200);
   let [ai,gt,q]=nodes; ai.rawValue=3072; gt.threshold=50; ai.unit='%'; gt.unit='%';
   SimuPLCFBDAnalog.refreshAll();wire(ai,gt,0);wire(gt,q,0);SimuPLCFBDSimulation.start();SimuPLCFBDSimulation.scan();
   out.direct={ai:ai.value,gt:gt.value,q:q.value,name:ai.name,inputs:ai.inputs.length,display:ai.el.querySelector('.analog-value-display')?.innerText};
   SimuPLCFBDSimulation.stop({silent:true});
   reset();
   createNode('analog_input',100,180);createNode('scale',360,180);createNode('lte',620,180);createNode('output',880,180);
   [ai,sc,gt,q]=nodes; ai.rawValue=2048; ai.engMin=0;ai.engMax=10;sc.inMin=0;sc.inMax=10;sc.outMin=0;sc.outMax=100;gt.threshold=55;
   SimuPLCFBDAnalog.refreshAll();wire(ai,sc,0);wire(sc,gt,0);wire(gt,q,0);SimuPLCFBDSimulation.start();SimuPLCFBDSimulation.scan();
   out.scale={ai:ai.value,scale:sc.value,cmp:gt.value,q:q.value};SimuPLCFBDSimulation.stop({silent:true});
   reset();
   createNode('analog_input',100,180);createNode('hyst',380,180);createNode('output',680,180);
   [ai,hy,q]=nodes; hy.low=40;hy.high=60;wire(ai,hy,0);wire(hy,q,0);SimuPLCFBDSimulation.start();
   ai.rawValue=3000;SimuPLCFBDSimulation.scan();const high=[ai.value,hy.value,q.value];
   ai.rawValue=2048;SimuPLCFBDSimulation.scan();const middle=[ai.value,hy.value,q.value];
   ai.rawValue=1000;SimuPLCFBDSimulation.scan();const low=[ai.value,hy.value,q.value];
   out.hyst={high,middle,low};SimuPLCFBDSimulation.stop({silent:true});
   reset();
   createNode('analog_input',100,180);createNode('eq',380,180);let a=nodes[0],e=nodes[1];a.rawValue=1234;a.unit='°C';a.engMin=-20;a.engMax=80;e.threshold=10;e.tolerance=.5;e.unit='°C';SimuPLCFBDAnalog.refreshAll();wire(a,e,0);
   const saved=serializeFBD();loadFromData(saved);const saved2=serializeFBD();out.persist={types:saved2.nodes.map(n=>n.type),analog:saved2.nodes.map(n=>n.params.analog),count:saved2.settings.counts.analogInputCount,name:saved2.nodes[0].name};
   out.diag=SimuPLCFBDAnalog.getDiagnostics();
   return out;
 }''')
 print(json.dumps({'result':r,'errors':errs},ensure_ascii=False,indent=2))
 b.close()
 direct=r['direct']; scale=r['scale']; hyst=r['hyst']; persist=r['persist']
 ok=(not errs and direct['gt']==1 and direct['q']==1 and direct['inputs']==0 and abs(direct['ai']-75.01831501831502)<0.02 and scale['cmp']==1 and scale['q']==1 and 49.9 < scale['scale'] < 50.2 and hyst['high'][1:]==[1,1] and hyst['middle'][1:]==[1,1] and hyst['low'][1:]==[0,0] and persist['types']==['analog_input','eq'] and persist['count']==1 and persist['name']=='AI1' and persist['analog'][0]['unit']=='°C')
 if not ok: raise SystemExit(1)
