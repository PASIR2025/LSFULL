#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
LOCAL_STORAGE_MOCK="""<script>(function(){var data=new Map([['logicsoft_full_v1','1']]);var storage={getItem:function(k){k=String(k);return data.has(k)?data.get(k):null;},setItem:function(k,v){data.set(String(k),String(v));},removeItem:function(k){data.delete(String(k));},clear:function(){data.clear();},key:function(i){return Array.from(data.keys())[i]||null;}};Object.defineProperty(storage,'length',{get:function(){return data.size;}});try{Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}catch(e){}})();</script>"""
def inline_assets(html):
    def sr(m):
        src=m.group(1).split('?',1)[0].replace('./',''); p=ROOT/src
        return '<script>\n'+p.read_text(encoding='utf-8')+'\n</script>' if p.exists() else m.group(0)
    def cr(m):
        href=m.group(1).split('?',1)[0].replace('./',''); p=ROOT/href
        return '<style>\n'+p.read_text(encoding='utf-8')+'\n</style>' if p.exists() else m.group(0)
    html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',sr,html,flags=re.I)
    return re.sub(r'<link[^>]+href=["\']([^"\']+\.css(?:\?[^"\']*)?)["\'][^>]*>',cr,html,flags=re.I)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1400,'height':900}); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    html=LOCAL_STORAGE_MOCK+inline_assets((ROOT/'index.html').read_text(encoding='utf-8'))
    html=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',html,flags=re.I)
    page.set_content(html,wait_until='load',timeout=120000); page.wait_for_timeout(4500)
    result=page.evaluate('''async()=>{
      const mock={isConnected:()=>true,getState:()=>({ready:true,simulationOn:true,analogOutputs:{AO1:.69,AO2:12},analogMeta:{AO1:{min:0,max:3.3,unit:'V',kind:'ao',source:'TEST'},AO2:{min:4,max:20,unit:'mA',kind:'ao',source:'TEST'}},inputs:{},outputs:{},analogInputs:{},analogRuntime:{}}),startProcess:()=>Promise.resolve(),stopProcess:()=>Promise.resolve(),sendAnalogInput:()=>Promise.resolve(),sendInputs:()=>Promise.resolve(),requestState:()=>Promise.resolve(),requestStateThrottled:()=>Promise.resolve()}; window.SimuPLCExternalIO=mock; window.isFull=true; localStorage.setItem('logicsoft_full_v1','1');
      document.getElementById('modeHMIBtn').click();
      const project={type:'simuplc-hmi-v1',version:33,name:'AO normalización',mode:'operate',source:'fbd',elements:[
        {id:'v1',type:'analog-valve',label:'Válvula V',tag:'AO1',analogMin:0,analogMax:100,analogUnit:'%',analogDecimals:1,analogMode:'read',commandScaleMode:'auto',x:100,y:100,w:270,h:225},
        {id:'v2',type:'analog-valve',label:'Válvula mA',tag:'AO2',analogMin:0,analogMax:100,analogUnit:'%',analogDecimals:1,analogMode:'read',commandScaleMode:'auto',x:420,y:100,w:270,h:225},
        {id:'t1',type:'analog-tank',label:'Tanque',tag:'AI1',tag3:'AO1',tag4:'',analogValue:20,analogMin:0,analogMax:100,analogUnit:'%',analogDecimals:1,analogMode:'process',fillSpeed:15,drainSpeed:5,commandScaleMode:'auto',processEnabled:true,x:760,y:80,w:360,h:430}
      ]};
      window.SimuPLCHMI.loadProject(project); window.SimuPLCHMI.start();
      await new Promise(r=>setTimeout(r,1400));
      const p=window.SimuPLCHMI.getProject();
      const v1=document.querySelector('[data-id="v1"]'),v2=document.querySelector('[data-id="v2"]'),t=document.querySelector('[data-id="t1"]');
      return {ioSame:window.SimuPLCExternalIO===mock,ioState:window.SimuPLCExternalIO.getState(),running:window.SimuPLCHMI.isRunning(),op:window.SimuPLCHMI.isOperationMode(),v1Pct:v1&&v1.style.getPropertyValue('--analog-percent-num'),v1Text:v1&&v1.querySelector('[data-analog-power]')?.textContent,v2Pct:v2&&v2.style.getPropertyValue('--analog-percent-num'),v2Text:v2&&v2.querySelector('[data-analog-power]')?.textContent,tankValue:p.elements.find(e=>e.id==='t1')?.analogValue,tankFlow:t&&t.querySelector('.hmi-tank-flow')?.textContent};
    }''')
    print(json.dumps({'result':result,'errors':errors},ensure_ascii=False,indent=2)); b.close()
    ok=not errors and abs(float(result['v1Pct'])-20.909)<.2 and abs(float(result['v2Pct'])-50)<.2 and result['tankValue']>23 and '20.9%' in result['tankFlow']
    raise SystemExit(0 if ok else 1)
