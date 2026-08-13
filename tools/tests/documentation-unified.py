import html as html_lib,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
MOCK="""<script>(function(){var d=new Map();var s={getItem:k=>d.has(String(k))?d.get(String(k)):null,setItem:(k,v)=>d.set(String(k),String(v)),removeItem:k=>d.delete(String(k)),clear:()=>d.clear(),key:i=>Array.from(d.keys())[i]||null};Object.defineProperty(s,'length',{get:()=>d.size});try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});}catch(e){}})();</script>"""
def inline(src):
 def sc(m):
  p=ROOT/m.group(1).replace('./','');return '<script>\n'+p.read_text(encoding='utf8')+'\n</script>' if p.exists() else m.group(0)
 def css(m):
  p=ROOT/m.group(1).replace('./','');return '<style>\n'+p.read_text(encoding='utf8')+'\n</style>' if p.exists() else m.group(0)
 src=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sc,src,flags=re.I)
 return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>',css,src,flags=re.I)
ladder=MOCK+inline((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf8'))
parent=MOCK+inline((ROOT/'index.html').read_text(encoding='utf8'))
srcdoc=html_lib.escape(ladder,quote=True)
parent,n=re.subn(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',lambda m:m.group(1)+'src="about:blank" srcdoc="'+srcdoc+'"',parent,count=1,flags=re.I)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1400,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(parent,wait_until='load',timeout=180000);page.wait_for_function('window.SimuPLCProjectIO && window.SimuPLCEditors && window.SimuPLCFbdDocumentation',timeout=30000)
 page.evaluate('''async()=>{await SimuPLCEditorFrameBridge.waitUntilReady({maxWaitMs:12000});clearAll();createNode('input',300,250);SimuPLCFBDReferences.set(nodes[0],'Sensor de nivel');SimuPLCFbdDocumentation.setTexts([{id:'FTX',text:'SISTEMA DE BOMBEO',x:300,y:120,format:'title',fontSize:30,maxWidth:520,bold:true,color:'#fff',background:'#003366'}]);await SimuPLCEditors.loadLadderState({type:'ladder-free-pro-industrial',version:3,rungs:[{id:'r1',elements:[{id:'e1',type:'NO',label:'I1',x:300,y:200,description:'Pulsador marcha',reference:'Pulsador marcha',descriptionFormat:'comment'}]}],proWires:[],referenceTexts:[{id:'RT1',text:'CONTROL LADDER',x:400,y:100,format:'title',fontSize:30,maxWidth:520,bold:true,color:'#fff',background:'#003366'}]});}''')
 result=page.evaluate('''async()=>{const project=await SimuPLCProjectIO.captureCurrentProject('Prueba docs');const json=JSON.parse(JSON.stringify(project));await SimuPLCProjectIO.loadCanonical(json);const fbd=SimuPLCEditors.getFBDState();const ladder=await SimuPLCEditors.getLadderState();return {fbdDescription:json.editors.fbd.nodes[0].description,fbdTexts:json.editors.fbd.freeTexts,ladderDescription:json.editors.ladder.rungs[0].elements[0].description,ladderTexts:json.editors.ladder.referenceTexts,restoredFbdDescription:fbd.nodes[0].description,restoredFbdTexts:fbd.freeTexts,restoredLadderDescription:ladder.rungs[0].elements[0].description,restoredLadderTexts:ladder.referenceTexts};}''')
 print(json.dumps({'result':result,'errors':errors},ensure_ascii=False,indent=2));b.close()
 ok=not errors and result['fbdDescription']=='Sensor de nivel' and len(result['fbdTexts'])==1 and result['ladderDescription']=='Pulsador marcha' and len(result['ladderTexts'])==1 and result['restoredFbdDescription']=='Sensor de nivel' and len(result['restoredFbdTexts'])==1 and result['restoredLadderDescription']=='Pulsador marcha' and len(result['restoredLadderTexts'])==1
 raise SystemExit(0 if ok else 1)
