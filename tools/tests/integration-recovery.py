#!/usr/bin/env python3
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


def inline_assets(html: str) -> str:
    def script_repl(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<script>\n' + target.read_text(encoding='utf-8') + '\n</script>' if target.exists() else match.group(0)

    def css_repl(match):
        target = ROOT / match.group(1).replace('./', '')
        return '<style>\n' + target.read_text(encoding='utf-8') + '\n</style>' if target.exists() else match.group(0)

    html = re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>', script_repl, html, flags=re.I)
    return re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', css_repl, html, flags=re.I)


def storage_mock(seed=None) -> str:
    seed = seed or {}
    return """<script>
(function(){
  var initial=%s;
  var data=new Map(Object.entries(initial));
  var storage={
    getItem:function(k){k=String(k);return data.has(k)?data.get(k):null;},
    setItem:function(k,v){data.set(String(k),String(v));},
    removeItem:function(k){data.delete(String(k));},
    clear:function(){data.clear();},
    key:function(i){return Array.from(data.keys())[i]||null;}
  };
  Object.defineProperty(storage,'length',{get:function(){return data.size;}});
  Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
  window.__dumpStorage=function(){return Object.fromEntries(data.entries());};
})();
</script>""" % json.dumps(seed)


def main():
    main_html = inline_assets((ROOT / 'index.html').read_text(encoding='utf-8'))
    main_html = re.sub(
        r'(<iframe[^>]+id=["\']ladderFrame["\'][^>]+)src=["\'][^"\']+["\']',
        r'\1src="about:blank"',
        main_html,
        flags=re.I
    )
    ladder_html = inline_assets((ROOT / 'ladder_mobile_compact.html').read_text(encoding='utf-8'))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1400, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(storage_mock() + main_html, wait_until='load', timeout=120000)
        ladder_frame = page.frames[1]
        ladder_frame.set_content(storage_mock() + ladder_html, wait_until='load', timeout=120000)
        page.wait_for_function('window.SimuPLCRecovery && SimuPLCRecovery.getDiagnostics().ready', timeout=30000)

        fbd = page.evaluate('''async () => {
          clearAll();
          createNode('input', 150, 150);
          createNode('output', 450, 150);
          await SimuPLCRecovery.saveNow('integracion-fbd', {force:true, pending:true, allowSuspended:true});
          return {
            names:nodes.map(n => n.name),
            state:JSON.parse(localStorage.getItem('simuplc_recovery_state_v1'))
          };
        }''')

        ladder = ladder_frame.evaluate('''() => {
          if (!state.ladder.rungs.length) state.ladder.rungs.push({id:'r1', elements:[]});
          const element = makeElement('NO', 'I1');
          state.ladder.rungs[0].elements.push(element);
          if (typeof markModelDirty === 'function') markModelDirty();
          if (typeof draw === 'function') draw();
          SimuPLCLadderRecoveryBridge.notify('integracion');
          return {type:element.type, count:state.ladder.rungs[0].elements.length};
        }''')
        page.wait_for_timeout(2000)
        ladder_autosave = page.evaluate('''() => {
          const autosave=JSON.parse(localStorage.getItem('simuplc_autosave_project_v1'));
          const state=JSON.parse(localStorage.getItem('simuplc_recovery_state_v1'));
          return {
            count:autosave.project.editors.ladder.rungs.reduce((total,rung) => total + (rung.elements || []).length, 0),
            pending:state.pending
          };
        }''')

        invalid_import = page.evaluate('''async () => {
          const alerts=[];
          const api={confirm:async()=>true,prompt:async()=> 'x',alert:async(message)=>{alerts.push(String(message));return true;}};
          window.SimuPLCNativeModal=api;
          window.SimuPLCModal=api;
          const beforeNodes=nodes.map(node => node.name);
          const beforeBackups=SimuPLCRecovery.listBackups().length;
          const ok=await SimuPLCActions.importFile({text:async()=>'{archivo-danado'});
          return {
            ok,
            beforeNodes,
            afterNodes:nodes.map(node => node.name),
            beforeBackups,
            afterBackups:SimuPLCRecovery.listBackups().length,
            alert:alerts.join(' ')
          };
        }''')

        backup = page.evaluate('''async () => {
          const api={confirm:async()=>true,prompt:async()=> 'x',alert:async()=>true};
          window.SimuPLCNativeModal=api;
          window.SimuPLCModal=api;
          document.body.classList.remove('mode-ladder');
          const before=SimuPLCRecovery.listBackups().length;
          const ok=await SimuPLCActions.newProject();
          for(let i=0;i<10;i+=1) await SimuPLCRecovery.createBackup('limite-' + i);
          return {
            ok,
            before,
            after:SimuPLCRecovery.listBackups().length,
            nodes:nodes.length,
            state:JSON.parse(localStorage.getItem('simuplc_recovery_state_v1'))
          };
        }''')

        page.evaluate('''async () => {
          createNode('input', 200, 200);
          await SimuPLCRecovery.saveNow('antes-reinicio', {force:true, pending:true, allowSuspended:true});
        }''')
        seed = page.evaluate('__dumpStorage()')

        page2 = browser.new_page(viewport={'width': 1400, 'height': 900})
        restart_errors = []
        page2.on('pageerror', lambda error: restart_errors.append(str(error)))
        page2.set_content(storage_mock(seed) + main_html, wait_until='load', timeout=120000)
        ladder_frame2 = page2.frames[1]
        ladder_frame2.set_content(storage_mock() + ladder_html, wait_until='load', timeout=120000)
        page2.wait_for_selector('#nativeModalOverlay.show', timeout=30000)
        message = page2.locator('#nativeModalOverlay [data-role="message"]').inner_text()
        page2.locator('#nativeModalOverlay .native-modal-btn.primary').click()
        page2.wait_for_function("typeof nodes !== 'undefined' && nodes.some(n => n.name === 'I1')", timeout=30000)
        restored = page2.evaluate('''() => ({
          names:nodes.map(n => n.name),
          state:JSON.parse(localStorage.getItem('simuplc_recovery_state_v1')),
          diagnostics:SimuPLCRecovery.getDiagnostics()
        })''')

        result = {
            'fbd': fbd,
            'ladder': ladder,
            'ladderAutosave': ladder_autosave,
            'invalidImport': invalid_import,
            'backup': backup,
            'recoveryMessage': message,
            'restored': restored,
            'pageErrors': errors,
            'restartErrors': restart_errors
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))

        ok = (
            not errors
            and not restart_errors
            and fbd['state']['pending']
            and ladder['count'] >= 1
            and ladder_autosave['count'] >= 1
            and ladder_autosave['pending']
            and invalid_import['ok'] is False
            and invalid_import['beforeNodes'] == invalid_import['afterNodes']
            and invalid_import['beforeBackups'] == invalid_import['afterBackups']
            and 'dañado' in invalid_import['alert'].lower()
            and backup['ok']
            and backup['after'] == 8
            and backup['after'] > backup['before']
            and backup['nodes'] == 0
            and backup['state']['pending'] is False
            and 'trabajo sin guardar' in message.lower()
            and 'I1' in restored['names']
        )
        browser.close()
        raise SystemExit(0 if ok else 1)


if __name__ == '__main__':
    main()
