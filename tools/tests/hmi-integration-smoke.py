#!/usr/bin/env python3
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
LOCAL_STORAGE_MOCK="""<script>(function(){var data=new Map();var storage={getItem:function(k){k=String(k);return data.has(k)?data.get(k):null;},setItem:function(k,v){data.set(String(k),String(v));},removeItem:function(k){data.delete(String(k));},clear:function(){data.clear();},key:function(i){return Array.from(data.keys())[i]||null;}};Object.defineProperty(storage,'length',{get:function(){return data.size;}});try{Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}catch(e){}})();</script>"""

def inline_assets(html):
    def script_repl(m):
        src=m.group(1).split('?',1)[0].replace('./','')
        p=ROOT/src
        return '<script>\n'+p.read_text(encoding='utf-8')+'\n</script>' if p.exists() else m.group(0)
    def css_repl(m):
        href=m.group(1).split('?',1)[0].replace('./','')
        p=ROOT/href
        return '<style>\n'+p.read_text(encoding='utf-8')+'\n</style>' if p.exists() else m.group(0)
    html=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',script_repl,html,flags=re.I)
    html=re.sub(r'<link[^>]+href=["\']([^"\']+\.css(?:\?[^"\']*)?)["\'][^>]*>',css_repl,html,flags=re.I)
    return html

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':900})
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        html=LOCAL_STORAGE_MOCK+inline_assets((ROOT/'index.html').read_text(encoding='utf-8'))
        html=re.sub(r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',r'\1src="about:blank"',html,flags=re.I)
        page.set_content(html,wait_until='load',timeout=120000)
        page.wait_for_timeout(6500)
        checks=page.evaluate('''async () => {
          const out={};
          out.hmiButton=!!document.getElementById('modeHMIBtn');
          out.hmiHost=!!document.getElementById('hmiHost');
          out.hmiApi=!!window.SimuPLCHMI;
          out.projectApi=!!window.SimuPLCHMIProject;
          out.externalIo=!!window.SimuPLCExternalIO;
          out.analogInput=!!document.querySelector('#sidebar [data-type="analog_input"]');
          out.pid=!!document.querySelector('#sidebar [data-type="pid"]');
          document.getElementById('modeHMIBtn').click();
          await new Promise(r=>setTimeout(r,350));
          out.modeHmi=document.body.classList.contains('mode-hmi');
          out.hmiVisible=getComputedStyle(document.getElementById('hmiHost')).display!=='none';
          window.SimuPLCHMI.applyMotorTemplate();
          await new Promise(r=>setTimeout(r,250));
          const hmi=window.SimuPLCHMI.getProject();
          out.hmiElementCount=(hmi.elements||[]).length;
          const complete=await window.SimuPLCHMIProject.makeComplete('Prueba integrada');
          out.completeHasHmi=!!(complete.editors&&complete.editors.hmi);
          out.completeHasFbd=!!(complete.editors&&complete.editors.fbd);
          out.completeHasLadder=('ladder' in (complete.editors||{}));
          document.getElementById('modeFBDBtn').click();
          out.modeFbd=document.body.classList.contains('mode-fbd');
          return out;
        }''')
        page.close()

        ladder=browser.new_page(viewport={'width':1200,'height':800})
        ladder_errors=[]
        ladder.on('pageerror',lambda e: ladder_errors.append(str(e)))
        lhtml=LOCAL_STORAGE_MOCK+inline_assets((ROOT/'ladder_mobile_compact.html').read_text(encoding='utf-8'))
        ladder.set_content(lhtml,wait_until='load',timeout=120000)
        ladder.wait_for_timeout(2500)
        ladder_checks=ladder.evaluate('''() => ({bridge:!!window.SimuPLCHmiLadderRuntime, health:typeof SimuPLCLadderHealth==='function'?SimuPLCLadderHealth():null})''')
        ladder.close();browser.close()
    result={'checks':checks,'ladder':ladder_checks,'pageErrors':errors,'ladderErrors':ladder_errors}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    ok=(not errors and not ladder_errors and checks.get('hmiButton') and checks.get('hmiApi') and checks.get('modeHmi') and checks.get('hmiVisible') and checks.get('hmiElementCount',0)>=4 and checks.get('completeHasHmi') and checks.get('completeHasFbd') and checks.get('analogInput') and checks.get('pid') and ladder_checks.get('bridge'))
    raise SystemExit(0 if ok else 1)

if __name__=='__main__':main()
